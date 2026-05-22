import React, { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

const MediaPlayer = ({ videoId, startTime = 0, muted = false, loop = false, onEnded, onLoop }) => {
    const playerRef = useRef(null);
    const youtubePlayerRef = useRef(null);
    const loopRef = useRef(loop);
    const onEndedRef = useRef(onEnded);
    const onLoopRef = useRef(onLoop);
    const [playerInstance, setPlayerInstance] = useState(null);
    const [playerReady, setPlayerReady] = useState(false);
    const [apiLoaded, setApiLoaded] = useState(!!window.YT);
    const isInitialLoadRef = useRef(true);

    useEffect(() => {
        loopRef.current = loop;
        onEndedRef.current = onEnded;
        onLoopRef.current = onLoop;
    }, [loop, onEnded, onLoop]);

    // Handle muted prop changes
    useEffect(() => {
        if (playerInstance?.mute && playerInstance?.unMute) {
            muted ? playerInstance.mute() : playerInstance.unMute();
        }
    }, [muted, playerInstance]);

    // Handle new songs (videoId changes)
    useEffect(() => {
        if (!playerInstance || !videoId) return;
        if (isInitialLoadRef.current) {
            isInitialLoadRef.current = false;
            return;
        }
        playerInstance.loadVideoById({ videoId, startSeconds: 0 });
    }, [videoId, playerInstance]);

    // Expose player time functions globally
    useEffect(() => {
        window.getYouTubePlayerCurrentTime = () => {
            if (youtubePlayerRef.current && playerReady) {
                try { return youtubePlayerRef.current.getCurrentTime(); }
                catch { return null; }
            }
            return null;
        };

        window.setYouTubePlayerCurrentTime = (time) => {
            if (youtubePlayerRef.current && playerReady) {
                try { youtubePlayerRef.current.seekTo(time, true); return true; }
                catch { return false; }
            }
            return false;
        };

        window.pauseYouTubePlayer = () => {
            if (youtubePlayerRef.current && playerReady) {
                try { youtubePlayerRef.current.pauseVideo(); return true; }
                catch { return false; }
            }
            return false;
        };

        window.playYouTubePlayer = () => {
            if (youtubePlayerRef.current && playerReady) {
                try { youtubePlayerRef.current.playVideo(); return true; }
                catch { return false; }
            }
            return false;
        };

        return () => {
            window.getYouTubePlayerCurrentTime = null;
            window.setYouTubePlayerCurrentTime = null;
            window.pauseYouTubePlayer = null;
            window.playYouTubePlayer = null;
        };
    }, [playerReady]);

    // Load YouTube API
    useEffect(() => {
        if (window.YT) {
            setApiLoaded(true);
            return;
        }

        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        window.onYouTubeIframeAPIReady = () => setApiLoaded(true);
        document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, document.getElementsByTagName('script')[0]);

        return () => { window.onYouTubeIframeAPIReady = null; };
    }, []);

    // Create player instance
    useEffect(() => {
        if (!window.YT?.Player || !apiLoaded) return;

        if (youtubePlayerRef.current) youtubePlayerRef.current.destroy();

        isInitialLoadRef.current = !!videoId;

        youtubePlayerRef.current = new window.YT.Player(playerRef.current, {
            height: '100%',
            width: '100%',
            videoId: videoId || '',
            playerVars: {
                autoplay: 1,
                controls: 1,
                disablekb: 0,
                fs: 0,
                rel: 0,
                start: startTime || 0,
                modestbranding: 1,
                playsinline: 1,
                mute: muted ? 1 : 0
            },
            events: {
                onReady: (event) => {
                    setPlayerReady(true);
                    setPlayerInstance(event.target);
                    if (videoId) event.target.playVideo();
                },
                onStateChange: (event) => {
                    if (event.data === window.YT.PlayerState.ENDED) {
                        if (loopRef.current) {
                            try {
                                event.target.seekTo(0, true);
                                event.target.playVideo();
                                onLoopRef.current?.();
                            } catch (error) {
                                console.error('Error looping YouTube video:', error);
                            }
                            return;
                        }
                        if (onEndedRef.current) onEndedRef.current();
                    }
                },
                onError: (event) => console.error('YouTube player error:', event.data)
            }
        });

        return () => {
            if (youtubePlayerRef.current) {
                youtubePlayerRef.current.destroy();
                youtubePlayerRef.current = null;
            }
            setPlayerInstance(null);
            setPlayerReady(false);
        };
    }, [apiLoaded]);

    // Idle player when no video
    useEffect(() => {
        if (!playerInstance || videoId) return;
        try {
            playerInstance.stopVideo();
            playerInstance.clearVideo?.();
        } catch {}
    }, [videoId, playerInstance]);

    return (
        <Box>
            <Box sx={{ position: 'relative', paddingTop: '56.25%', overflow: 'hidden', borderRadius: 1 }}>
                <Box ref={playerRef} sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
            </Box>
        </Box>
    );
};

export default MediaPlayer;
