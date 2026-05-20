import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Alert, Box, Button, Paper, Slider, Stack, Snackbar, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import axios from 'axios';
import MediaPlayer from './MediaPlayer';
import SongWidget from './SongWidget';
import { useSocket } from '../Context/SocketContext';
import SkipSong from './SkipSong/SkipSong';
import CountDownMessage from './CountDownMessage';

const IDLE_AUDIO_VIDEO_ID = 'aZ5KJdoiQag';
const IDLE_VOLUME = 1;
const DEFAULT_ACTIVE_VOLUME = 40;
const SYNC_DRIFT_TOLERANCE_SECONDS = 3;
const ROOM_VOLUME_KEY = 'tuneinRoomVolume';

const getInitialVolume = () => {
  try {
    const storedVolume = Number(sessionStorage.getItem(ROOM_VOLUME_KEY));
    if (Number.isFinite(storedVolume)) {
      return Math.max(0, Math.min(100, storedVolume));
    }
  } catch {}
  return DEFAULT_ACTIVE_VOLUME;
};

const CurrentSong = () => {
  const [currentSong, setCurrentSong] = useState(null);
  const [serverTimeDiff, setServerTimeDiff] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [countdownData, setCountdownData] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const [showAudioGate, setShowAudioGate] = useState(true);
  const [activeVolume, setActiveVolume] = useState(getInitialVolume);
  const initialStartTimeRef = useRef(0);
  const pauseRetryRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const latestPlaybackRef = useRef({ currentSong: null, isPaused: false, serverTimeDiff: 0 });
  const { newSocket, roomId, isConnected, isReconnecting, connectionVersion } = useSocket();

  useEffect(() => {
    audioUnlockedRef.current = audioUnlocked;
  }, [audioUnlocked]);

  useEffect(() => {
    latestPlaybackRef.current = { currentSong, isPaused, serverTimeDiff };
  }, [currentSong, isPaused, serverTimeDiff]);

  const getElapsedForSong = useCallback((song, diff, paused) => {
    if (!song?.startTime) return 0;
    if (paused && song.elapsedAtPause != null) return song.elapsedAtPause;
    return Math.max(0, Math.floor((Date.now() + diff - song.startTime) / 1000));
  }, []);

  const syncTimeData = useCallback((serverTime, song) => {
    const diff = serverTime - Date.now();
    setServerTimeDiff(diff);
    if (song) {
      initialStartTimeRef.current = getElapsedForSong(song, diff, Boolean(song.pausedAt));
    } else {
      initialStartTimeRef.current = 0;
    }
    return diff;
  }, [getElapsedForSong]);

  useEffect(() => {
    try {
      sessionStorage.setItem(ROOM_VOLUME_KEY, String(activeVolume));
    } catch {}
    if (audioUnlockedRef.current && currentSong) {
      window.tuneInYouTubePlayer?.setVolume?.(activeVolume);
    }
  }, [activeVolume, currentSong]);

  const commandPlayback = useCallback((song, paused, diff, options = {}) => {
    if (!audioUnlockedRef.current) return false;

    const player = window.tuneInYouTubePlayer;
    if (!player) return false;

    setPlaybackBlocked(false);
    const effectiveDiff = diff ?? latestPlaybackRef.current.serverTimeDiff;
    const force = Boolean(options.force);

    if (song) {
      const elapsed = getElapsedForSong(song, effectiveDiff, paused);
      const currentVideoId = player.getVideoId?.();
      const currentTime = player.getCurrentTime?.();
      const drift = Number.isFinite(currentTime) ? Math.abs(currentTime - elapsed) : Infinity;

      player.setVolume?.(activeVolume);
      if (paused) {
        const loaded = currentVideoId !== song.id
          ? player.load?.(song.id, elapsed)
          : (force || drift > SYNC_DRIFT_TOLERANCE_SECONDS ? player.seekTo?.(elapsed) : true);
        player.pause?.();
        return Boolean(loaded);
      }

      if (currentVideoId !== song.id) {
        return Boolean(player.loadAndPlay?.(song.id, elapsed));
      }

      if (force || drift > SYNC_DRIFT_TOLERANCE_SECONDS) {
        player.seekTo?.(elapsed);
      }

      const playerState = player.getPlayerState?.();
      if (playerState !== window.YT?.PlayerState?.PLAYING) {
        return Boolean(player.play?.());
      }
      return true;
    }

    player.setVolume?.(IDLE_VOLUME);
    if (player.getVideoId?.() !== IDLE_AUDIO_VIDEO_ID || force) {
      return Boolean(player.loadAndPlay?.(IDLE_AUDIO_VIDEO_ID, 0));
    }
    if (player.getPlayerState?.() !== window.YT?.PlayerState?.PLAYING) {
      return Boolean(player.play?.());
    }
    return true;
  }, [activeVolume, getElapsedForSong]);

  const applyCurrentSongPayload = useCallback((data, options = {}) => {
    const song = data.currentSong || null;
    const diff = syncTimeData(data.serverTime, song);
    const paused = Boolean(song?.pausedAt);

    setIsPaused(paused);
    setCurrentSong(song);
    setLoading(false);
    if (song) {
      setCountdownData({ countdown: 0, nextSong: null, clear: Date.now() });
    }

    commandPlayback(song, paused, diff, options.playbackOptions);
  }, [commandPlayback, syncTimeData]);

  const reconcileCurrentSong = useCallback(async (reason = 'manual', options = {}) => {
    if (!roomId) return;
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
      if (options.showLoading) setLoading(true);
      const { data } = await axios.get(`${process.env.REACT_APP_API_URL}/api/song/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      applyCurrentSongPayload(data, options);
      setError(null);
      console.log('[PLAYBACK] Reconciled current song:', reason);
    } catch (err) {
      console.error('Error reconciling current song:', err);
      setError('Failed to load the current song');
      setLoading(false);
    }
  }, [applyCurrentSongPayload, roomId]);

  const unlockAudio = useCallback(() => {
    audioUnlockedRef.current = true;
    setAudioUnlocked(true);
    setShowAudioGate(false);
    setPlaybackBlocked(false);
    reconcileCurrentSong('audio-unlock', { playbackOptions: { force: true } });
  }, [reconcileCurrentSong]);

  const handlePlaybackBlocked = useCallback(() => {
    if (!audioUnlockedRef.current) {
      setShowAudioGate(true);
      return;
    }
    setPlaybackBlocked(true);
  }, []);

  // Socket listeners
  useEffect(() => {
    if (!newSocket || !roomId) return;

    const handleSongUpdate = (data) => {
      applyCurrentSongPayload(data);
    };

    const handleCountdown = (data) => {
      setCountdownData({ countdown: data.countdown, nextSong: data.nextSong });
    };

    const handleSongPaused = (data) => {
      setCurrentSong(prev => {
        const updatedSong = prev ? { ...prev, pausedAt: data.pausedAt, elapsedAtPause: data.elapsedAtPause } : prev;
        if (updatedSong) {
          commandPlayback(updatedSong, true, undefined, { force: true });
        }
        return updatedSong;
      });
      setIsPaused(true);
      window.tuneInYouTubePlayer?.pause?.();
    };

    const handleSongResumed = (data) => {
      const diff = syncTimeData(data.serverTime, data.song);
      setCurrentSong(data.song);
      setIsPaused(false);
      commandPlayback(data.song, false, diff, { force: true });
    };

    newSocket.on('currentSongUpdated', handleSongUpdate);
    newSocket.on('nextSongCountdown', handleCountdown);
    newSocket.on('songPaused', handleSongPaused);
    newSocket.on('songResumed', handleSongResumed);

    return () => {
      newSocket.off('currentSongUpdated', handleSongUpdate);
      newSocket.off('nextSongCountdown', handleCountdown);
      newSocket.off('songPaused', handleSongPaused);
      newSocket.off('songResumed', handleSongResumed);
    };
  }, [newSocket, roomId, applyCurrentSongPayload, commandPlayback, syncTimeData]);

  // When isPaused becomes true, ensure the YouTube player is paused.
  useEffect(() => {
    clearTimeout(pauseRetryRef.current);
    if (!isPaused) return;

    const tryPause = () => {
      if (window.tuneInYouTubePlayer?.pause?.() === true) return;
      pauseRetryRef.current = setTimeout(tryPause, 300);
    };
    pauseRetryRef.current = setTimeout(tryPause, 300);

    return () => clearTimeout(pauseRetryRef.current);
  }, [isPaused]);

  // Initial load and reconnect recovery.
  useEffect(() => {
    reconcileCurrentSong('initial-load', { showLoading: true });
  }, [reconcileCurrentSong]);

  useEffect(() => {
    if (connectionVersion > 0) {
      reconcileCurrentSong('socket-connect');
    }
  }, [connectionVersion, reconcileCurrentSong]);

  useEffect(() => {
    const reconcileIfVisible = () => {
      if (document.visibilityState === 'visible') {
        reconcileCurrentSong('visibility-visible');
      }
    };
    const reconcilePageShow = () => reconcileCurrentSong('pageshow');
    const reconcileFocus = () => reconcileCurrentSong('window-focus');

    document.addEventListener('visibilitychange', reconcileIfVisible);
    window.addEventListener('pageshow', reconcilePageShow);
    window.addEventListener('focus', reconcileFocus);

    return () => {
      document.removeEventListener('visibilitychange', reconcileIfVisible);
      window.removeEventListener('pageshow', reconcilePageShow);
      window.removeEventListener('focus', reconcileFocus);
    };
  }, [reconcileCurrentSong]);

  const getElapsedSeconds = useCallback(() => {
    return getElapsedForSong(currentSong, serverTimeDiff, isPaused);
  }, [currentSong, getElapsedForSong, serverTimeDiff, isPaused]);

  const playerMode = currentSong ? (isPaused ? 'paused' : 'active') : 'idle';
  const playerVideoId = currentSong?.id || IDLE_AUDIO_VIDEO_ID;
  const playerStartTime = currentSong ? initialStartTimeRef.current : 0;
  const playerVolume = currentSong ? activeVolume : IDLE_VOLUME;
  const shouldPlay = audioUnlocked && !isPaused;

  if (loading) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ color: 'white', mb: 2, fontWeight: 600 }}>
          Now Playing
        </Typography>
        <Box sx={{ p: 4, textAlign: 'center', bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)' }}>Loading...</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: { xs: 2, md: 2, lg: 1 }, width: '100%', minHeight: 'fit-content', maxHeight: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 1.5, md: 1.5, lg: 1 }, minHeight: { xs: '32px', md: '36px' }, gap: 1, flexShrink: 0 }}>
        <Typography variant="h6" sx={{ color: 'white', fontWeight: 600, fontSize: { xs: '1.1rem', md: '1.25rem' }, lineHeight: { xs: '32px', md: '36px' }, display: 'flex', alignItems: 'center' }}>
          Now Playing
        </Typography>
        {currentSong && (
          <Box sx={{ display: 'flex', alignItems: 'flex-start', height: { xs: '32px', md: '36px' }, justifyContent: 'flex-end' }}>
            <SkipSong onSkip={() => setError(null)} isPaused={isPaused} />
          </Box>
        )}
      </Box>

      {error && (
        <Typography color="error" variant="caption" sx={{ display: 'block', mb: 1 }}>{error}</Typography>
      )}

      <SongWidget
        key={currentSong?.id || 'no-song'}
        currentSong={currentSong}
        getElapsedSeconds={getElapsedSeconds}
        isPaused={isPaused}
      />

      <CountDownMessage countdownData={countdownData} />

      <Paper sx={{ p: { xs: 1.5, md: 1.5, lg: 1, xl: 1 }, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.4)', maxWidth: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>
        {showAudioGate && (
          <Box sx={{ mb: 1.5, p: 1.5, borderRadius: 1, bgcolor: 'rgba(25, 118, 210, 0.16)', border: '1px solid rgba(144, 202, 249, 0.35)', display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Box>
              <Typography variant="subtitle2" sx={{ color: 'white', fontWeight: 700, lineHeight: 1.2 }}>
                Enable room audio
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.8rem', mt: 0.25 }}>
                Starts synced playback or low-volume idle audio.
              </Typography>
            </Box>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={unlockAudio}
              sx={{ flexShrink: 0, fontWeight: 700 }}
            >
              Start listening
            </Button>
          </Box>
        )}

        <Box sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', overflow: 'hidden', pb: { xl: 2 } }}>
          <Box sx={{ width: { xs: '100%', xl: '90%' }, maxWidth: '100%', maxHeight: '100%', aspectRatio: '16/9', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <MediaPlayer
              videoId={playerVideoId}
              mode={playerMode}
              startTime={playerStartTime}
              volume={playerVolume}
              shouldPlay={shouldPlay}
              onEnded={() => {
                if (currentSong) setError(null);
              }}
              onBlocked={handlePlaybackBlocked}
            />
          </Box>
        </Box>

        {currentSong ? (
          <Box sx={{ mt: { xs: 1.5, md: 1.5, lg: 1, xl: 0.5 }, flexShrink: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 500, fontSize: { xs: '0.9rem', md: '1rem' }, lineHeight: 1.3 }}>
                  {currentSong.title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: { xs: '0.8rem', md: '0.875rem' } }}>
                  Added by: {currentSong.addedby}
                </Typography>
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ mt: { xs: 1.5, md: 1.5, lg: 1, xl: 0.5 }, flexShrink: 0 }}>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: { xs: '0.9rem', md: '1rem' } }}>
              No song is currently playing.
            </Typography>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mt: 0.5, fontSize: { xs: '0.8rem', md: '0.875rem' } }}>
              Idle room audio is ready at low volume.
            </Typography>
          </Box>
        )}

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1.25, px: 0.5, flexShrink: 0 }}>
          <VolumeUpIcon sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 20 }} />
          <Slider
            size="small"
            min={0}
            max={100}
            value={activeVolume}
            onChange={(_, value) => setActiveVolume(Array.isArray(value) ? value[0] : value)}
            aria-label="Room volume"
            sx={{ color: '#90caf9', maxWidth: 220 }}
          />
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', minWidth: 34 }}>
            {activeVolume}%
          </Typography>
        </Stack>
      </Paper>

      <Snackbar
        open={playbackBlocked}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={unlockAudio}>
              Unlock audio
            </Button>
          }
          sx={{ alignItems: 'center' }}
        >
          Playback needs one tap to continue.
        </Alert>
      </Snackbar>

      <Snackbar
        open={Boolean(newSocket) && (!isConnected || isReconnecting)}
        message="Reconnecting playback..."
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      />
    </Box>
  );
};

export default CurrentSong;
