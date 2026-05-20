import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

const PLAYER_CHECK_DELAY = 900;
const MAX_PLAY_CHECKS = 4;

const MediaPlayer = ({
    videoId,
    mode = 'idle',
    startTime = 0,
    volume = 100,
    shouldPlay = false,
    onEnded,
    onBlocked
}) => {
    const playerRef = useRef(null);
    const youtubePlayerRef = useRef(null);
    const lastVideoIdRef = useRef(null);
    const latestPropsRef = useRef({ videoId, mode, startTime, volume, shouldPlay, onEnded, onBlocked });
    const playCheckRef = useRef(null);
    const [playerInstance, setPlayerInstance] = useState(null);
    const [playerReady, setPlayerReady] = useState(false);
    const [apiLoaded, setApiLoaded] = useState(!!window.YT);

    useEffect(() => {
        latestPropsRef.current = { videoId, mode, startTime, volume, shouldPlay, onEnded, onBlocked };
    }, [videoId, mode, startTime, volume, shouldPlay, onEnded, onBlocked]);

    const clearPlayCheck = () => {
        if (playCheckRef.current) {
            clearTimeout(playCheckRef.current);
            playCheckRef.current = null;
        }
    };

    const getPlayerState = () => {
        try {
            return youtubePlayerRef.current?.getPlayerState?.() ?? null;
        } catch {
            return null;
        }
    };

    const checkPlayback = (attempt = 0) => {
        clearPlayCheck();
        playCheckRef.current = setTimeout(() => {
            const player = youtubePlayerRef.current;
            const latest = latestPropsRef.current;
            if (!player || !latest.shouldPlay || latest.mode === 'paused') return;

            const state = getPlayerState();
            if (state === window.YT?.PlayerState?.PLAYING) return;

            if (attempt < MAX_PLAY_CHECKS) {
                try { player.playVideo(); } catch {}
                checkPlayback(attempt + 1);
                return;
            }

            latest.onBlocked?.();
        }, PLAYER_CHECK_DELAY);
    };

    const applyVolume = (player = youtubePlayerRef.current) => {
        if (!player) return false;
        try {
            player.setVolume(Math.max(0, Math.min(100, volume)));
            player.unMute?.();
            return true;
        } catch {
            return false;
        }
    };

    const loadVideo = (targetVideoId, targetStartTime = 0, playAfterLoad = false) => {
        const player = youtubePlayerRef.current;
        if (!player || !targetVideoId || !playerReady) return false;

        const safeStartTime = Math.max(0, Math.floor(targetStartTime || 0));
        try {
            applyVolume(player);
            if (lastVideoIdRef.current !== targetVideoId) {
                if (playAfterLoad) {
                    player.loadVideoById({ videoId: targetVideoId, startSeconds: safeStartTime });
                } else {
                    player.cueVideoById({ videoId: targetVideoId, startSeconds: safeStartTime });
                }
                lastVideoIdRef.current = targetVideoId;
            } else {
                player.seekTo(safeStartTime, true);
            }

            if (playAfterLoad) {
                player.playVideo();
                checkPlayback();
            }
            return true;
        } catch {
            return false;
        }
    };

    // Load YouTube API
    useEffect(() => {
        if (window.YT?.Player) {
            setApiLoaded(true);
            return;
        }

        const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
        const previousReady = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            previousReady?.();
            setApiLoaded(true);
        };

        if (!existingScript) {
            const tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, document.getElementsByTagName('script')[0]);
        }

        return () => {
            if (window.onYouTubeIframeAPIReady === previousReady) return;
            window.onYouTubeIframeAPIReady = previousReady || null;
        };
    }, []);

    // Create player instance once.
    useEffect(() => {
        if (!window.YT?.Player || !apiLoaded || youtubePlayerRef.current) return;

        youtubePlayerRef.current = new window.YT.Player(playerRef.current, {
            height: '100%',
            width: '100%',
            videoId: videoId || '',
            playerVars: {
                autoplay: 0,
                controls: 1,
                disablekb: 0,
                fs: 0,
                rel: 0,
                start: Math.max(0, Math.floor(startTime || 0)),
                modestbranding: 1,
                playsinline: 1,
                origin: window.location.origin
            },
            events: {
                onReady: (event) => {
                    lastVideoIdRef.current = videoId || null;
                    setPlayerReady(true);
                    setPlayerInstance(event.target);
                    applyVolume(event.target);
                    if (latestPropsRef.current.shouldPlay && videoId) {
                        event.target.playVideo();
                        checkPlayback();
                    }
                },
                onStateChange: (event) => {
                    const latest = latestPropsRef.current;
                    if (event.data === window.YT.PlayerState.ENDED) {
                        if (latest.mode === 'idle' && latest.videoId) {
                            loadVideo(latest.videoId, 0, latest.shouldPlay);
                            return;
                        }
                        latest.onEnded?.();
                    }
                    if (event.data === window.YT.PlayerState.PLAYING) {
                        clearPlayCheck();
                    }
                },
                onAutoplayBlocked: () => latestPropsRef.current.onBlocked?.(),
                onError: (event) => console.error('YouTube player error:', event.data)
            }
        });

        return () => {
            clearPlayCheck();
            if (youtubePlayerRef.current) {
                youtubePlayerRef.current.destroy();
                youtubePlayerRef.current = null;
            }
            setPlayerInstance(null);
            setPlayerReady(false);
        };
    }, [apiLoaded]);

    // Volume changes must not reload or seek the video.
    useEffect(() => {
        if (!playerInstance || !playerReady) return;
        applyVolume(playerInstance);
    }, [volume, playerInstance, playerReady]);

    // Apply prop-driven playback changes without destroying the iframe.
    useEffect(() => {
        if (!playerInstance || !playerReady || !videoId) return;

        applyVolume(playerInstance);

        if (mode === 'paused') {
            loadVideo(videoId, startTime, false);
            try { playerInstance.pauseVideo(); } catch {}
            return;
        }

        loadVideo(videoId, startTime, shouldPlay);
    }, [videoId, startTime, mode, shouldPlay, playerInstance, playerReady]);

    // Expose player helpers globally for CurrentSong and legacy callers.
    useEffect(() => {
        const helpers = {
            getCurrentTime: () => {
                if (youtubePlayerRef.current && playerReady) {
                    try { return youtubePlayerRef.current.getCurrentTime(); }
                    catch { return null; }
                }
                return null;
            },
            getPlayerState,
            getVideoId: () => {
                if (youtubePlayerRef.current && playerReady) {
                    try { return youtubePlayerRef.current.getVideoData()?.video_id || null; }
                    catch { return null; }
                }
                return null;
            },
            setVolume: (nextVolume) => {
                if (youtubePlayerRef.current && playerReady) {
                    try {
                        youtubePlayerRef.current.setVolume(Math.max(0, Math.min(100, nextVolume)));
                        youtubePlayerRef.current.unMute?.();
                        return true;
                    } catch { return false; }
                }
                return false;
            },
            load: (targetVideoId, targetStartTime = 0) => loadVideo(targetVideoId, targetStartTime, false),
            loadAndPlay: (targetVideoId, targetStartTime = 0) => loadVideo(targetVideoId, targetStartTime, true),
            seekTo: (time) => {
                if (youtubePlayerRef.current && playerReady) {
                    try { youtubePlayerRef.current.seekTo(Math.max(0, Math.floor(time || 0)), true); return true; }
                    catch { return false; }
                }
                return false;
            },
            pause: () => {
                if (youtubePlayerRef.current && playerReady) {
                    try { youtubePlayerRef.current.pauseVideo(); return true; }
                    catch { return false; }
                }
                return false;
            },
            play: () => {
                if (youtubePlayerRef.current && playerReady) {
                    try {
                        applyVolume();
                        youtubePlayerRef.current.playVideo();
                        checkPlayback();
                        return true;
                    } catch { return false; }
                }
                return false;
            }
        };

        window.tuneInYouTubePlayer = helpers;
        window.getYouTubePlayerCurrentTime = helpers.getCurrentTime;
        window.setYouTubePlayerCurrentTime = helpers.seekTo;
        window.pauseYouTubePlayer = helpers.pause;
        window.playYouTubePlayer = helpers.play;

        return () => {
            if (window.tuneInYouTubePlayer === helpers) {
                window.tuneInYouTubePlayer = null;
                window.getYouTubePlayerCurrentTime = null;
                window.setYouTubePlayerCurrentTime = null;
                window.pauseYouTubePlayer = null;
                window.playYouTubePlayer = null;
            }
        };
    }, [playerReady, volume]);

    return (
        <Box>
            <Box sx={{ position: 'relative', paddingTop: '56.25%', overflow: 'hidden', borderRadius: 1 }}>
                <Box ref={playerRef} sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
            </Box>
        </Box>
    );
};

export default MediaPlayer;
