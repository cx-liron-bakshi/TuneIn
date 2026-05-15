import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Paper } from '@mui/material';
import axios from 'axios';
import MediaPlayer from './MediaPlayer';
import SongWidget from './SongWidget';
import { useSocket } from '../Context/SocketContext';
import SkipSong from './SkipSong/SkipSong';
import CountDownMessage from './CountDownMessage';

import { INTRO_VIDEO_ID } from '../../../constants';

const CurrentSong = () => {
  const [currentSong, setCurrentSong] = useState(null);
  const [isIntroPlaying, setIsIntroPlaying] = useState(false);
  const [serverTimeDiff, setServerTimeDiff] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [countdownData, setCountdownData] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const initialStartTimeRef = useRef(0);
  const pauseRetryRef = useRef(null);
  const { newSocket, roomId } = useSocket();

  // Helper: calculate and store time sync data
  const syncTimeData = useCallback((serverTime, song) => {
    const diff = serverTime - Date.now();
    setServerTimeDiff(diff);
    if (song) {
      initialStartTimeRef.current = Math.floor((Date.now() + diff - song.startTime) / 1000);
    }
    return diff;
  }, []);

  // Socket listeners
  useEffect(() => {
    if (!newSocket || !roomId) return;

    const handleSongUpdate = (data) => {
      setLoading(false);
      setIsPaused(false);
      if (data.currentSong) {
        syncTimeData(data.serverTime, data.currentSong);
        setCurrentSong(data.currentSong);
        setIsIntroPlaying(false);
        setCountdownData({ countdown: 0, nextSong: null, clear: Date.now() });
      } else {
        setCurrentSong(null);
      }
    };

    const handleCountdown = (data) => {
      setCountdownData({ countdown: data.countdown, nextSong: data.nextSong });
    };

    const handleSongPaused = (data) => {
      setCurrentSong(prev => prev ? { ...prev, pausedAt: data.pausedAt, elapsedAtPause: data.elapsedAtPause } : prev);
      setIsPaused(true);
      window.pauseYouTubePlayer?.();
    };

    const handleSongResumed = (data) => {
      const diff = data.serverTime - Date.now();
      setServerTimeDiff(diff);
      initialStartTimeRef.current = data.song?.elapsedAtPause || 0;
      setCurrentSong(data.song); // startTime = effectiveStartTime → triggers SongWidget remount via key
      setIsPaused(false);
      window.playYouTubePlayer?.();
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
  }, [newSocket, roomId, syncTimeData]);

  // When isPaused becomes true, ensure the YouTube player is paused.
  // Retries until window.pauseYouTubePlayer is available (player may not be ready yet on initial load).
  useEffect(() => {
    clearTimeout(pauseRetryRef.current);
    if (!isPaused) return;

    const tryPause = () => {
      if (window.pauseYouTubePlayer?.() === true) return;
      pauseRetryRef.current = setTimeout(tryPause, 300);
    };
    pauseRetryRef.current = setTimeout(tryPause, 300);

    return () => clearTimeout(pauseRetryRef.current);
  }, [isPaused]);

  // Fetch current song on initial load
  useEffect(() => {
    if (!roomId) return;

    const fetchCurrentSong = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      try {
        setLoading(true);
        const { data } = await axios.get(`${process.env.REACT_APP_API_URL}/api/song/${roomId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (data.currentSong) {
          const paused = Boolean(data.currentSong.pausedAt);
          setIsPaused(paused);
          if (paused) {
            // For paused songs, freeze the start position at the exact elapsed time when paused
            const diff = data.serverTime - Date.now();
            setServerTimeDiff(diff);
            initialStartTimeRef.current = data.currentSong.elapsedAtPause || 0;
          } else {
            syncTimeData(data.serverTime, data.currentSong);
          }
          setCurrentSong(data.currentSong);
          setIsIntroPlaying(false);
        } else {
          setIsIntroPlaying(true);
        }
      } catch (err) {
        console.error('Error fetching current song:', err);
        setError('Failed to load the current song');
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentSong();
  }, [roomId, syncTimeData]);

  const getElapsedSeconds = useCallback(() => {
    if (!currentSong?.startTime) return 0;
    // While paused, return the frozen elapsed value
    if (isPaused && currentSong.elapsedAtPause != null) return currentSong.elapsedAtPause;
    return Math.floor((Date.now() + serverTimeDiff - currentSong.startTime) / 1000);
  }, [currentSong, serverTimeDiff, isPaused]);


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

      {/* Header with SkipSong */}
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

      <Paper sx={{ p: { xs: 1.5, md: 1.5, lg: 1, xl: 1 }, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.4)', maxWidth: '100%', overflow: 'hidden', display: (currentSong || isIntroPlaying) ? 'flex' : 'none', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 }}>
        <Box sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', overflow: 'hidden', pb: { xl: 2 } }}>
          <Box sx={{ width: { xs: '100%', xl: '90%' }, maxWidth: '100%', maxHeight: '100%', aspectRatio: '16/9', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <MediaPlayer
              videoId={currentSong?.id || (isIntroPlaying ? INTRO_VIDEO_ID : null)}
              startTime={currentSong ? initialStartTimeRef.current : 0}
              muted={isIntroPlaying}
              onEnded={() => setIsIntroPlaying(false)}
            />
          </Box>
        </Box>

        {currentSong && (
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
        )}
      </Paper>

      {!currentSong && !isIntroPlaying && (
        <Box sx={{ p: { xs: 3, md: 4 }, textAlign: 'center', bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2, position: 'relative' }}>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: { xs: '0.9rem', md: '1rem' } }}>
            No song is currently playing.
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mt: 1, fontSize: { xs: '0.8rem', md: '0.875rem' } }}>
            Add songs to the queue to get started!
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default CurrentSong;
