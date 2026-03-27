import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, LinearProgress, Paper, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import SyncIcon from '@mui/icons-material/Sync';

// Custom styled progress bar (YouTube-style)
const StyledLinearProgress = styled(LinearProgress)(({ theme }) => ({
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    '& .MuiLinearProgress-bar': {
        borderRadius: 3,
        backgroundColor: '#ff0000',
    },
}));

const SyncButton = styled(Button)(({ theme }) => ({
    minWidth: 'auto',
    padding: '4px 8px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    fontSize: '0.7rem',
    fontWeight: 500,
    border: '1px solid rgba(255, 255, 255, 0.2)',
    '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
    },
    '&:disabled': {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        color: 'rgba(255, 255, 255, 0.3)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
    }
}));

const SongWidget = ({ currentSong, getElapsedSeconds, isPaused = false }) => {
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [syncStatus, setSyncStatus] = useState('idle'); // 'idle', 'syncing', 'success', 'error'
    const intervalRef = useRef(null);
    const timeoutRef = useRef(null);

    // Format time in MM:SS format
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Sync function to synchronize MediaPlayer
    const handleSync = () => {
        if (!currentSong || typeof window.setYouTubePlayerCurrentTime !== 'function') {
            setSyncStatus('error');
            setTimeout(() => setSyncStatus('idle'), 2000);
            return;
        }

        setSyncStatus('syncing');
        
        try {
            const widgetCurrentTime = getElapsedSeconds();
            const success = window.setYouTubePlayerCurrentTime(widgetCurrentTime);
            setSyncStatus(success ? 'success' : 'error');
        } catch (error) {
            console.error('[SYNC] Error:', error);
            setSyncStatus('error');
        }

        setTimeout(() => setSyncStatus('idle'), 2000);
    };

    // Update progress and current time
    const updateProgress = () => {
        if (!currentSong || !currentSong.duration) return;

        const elapsed = getElapsedSeconds();
        const songDuration = currentSong.duration;

        // Cap elapsed time at duration (no negative values)
        const cappedElapsed = Math.min(Math.max(elapsed, 0), songDuration);

        setCurrentTime(cappedElapsed);
        setDuration(songDuration);

        // Calculate progress percentage (0-100)
        const progressPercentage = (cappedElapsed / songDuration) * 100;
        setProgress(progressPercentage);

        // Stop the timer when song is finished
        if (elapsed >= songDuration) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }
    };

    // Initialize widget when currentSong changes
    useEffect(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        setSyncStatus('idle');

        if (!currentSong) {
            setProgress(0);
            setCurrentTime(0);
            setDuration(0);
            return;
        }

        setDuration(currentSong.duration || 0);

        // Immediate update avoids 0:00 flash on resume and new-joiner load
        updateProgress();

        timeoutRef.current = setTimeout(() => {
            timeoutRef.current = null;
            updateProgress();
            intervalRef.current = setInterval(updateProgress, 1000);
        }, 500);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [currentSong?.id, currentSong?.startTime]);

    // Stop progress interval when song is paused
    useEffect(() => {
        if (!isPaused) return;
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    }, [isPaused]);

    if (!currentSong) return null;

    const getSyncButtonContent = () => {
        switch (syncStatus) {
            case 'syncing':
                return { text: 'Syncing...', icon: <SyncIcon sx={{ fontSize: 14, animation: 'rotate 1s linear infinite' }} /> };
            case 'success':
                return { text: 'Synced!', icon: <SyncIcon sx={{ fontSize: 14, color: '#4caf50' }} /> };
            case 'error':
                return { text: 'Error', icon: <SyncIcon sx={{ fontSize: 14, color: '#f44336' }} /> };
            default:
                return { text: 'Sync', icon: <SyncIcon sx={{ fontSize: 14 }} /> };
        }
    };

    const syncButtonContent = getSyncButtonContent();

    return (
        <Paper
            sx={{
                p: { xs: 2, lg: 1.5, xl: 1 },
                mb: { xs: 2, lg: 1.5, xl: 1 },
                borderRadius: 2,
                bgcolor: 'rgba(0,0,0,0.8)',
                border: '1px solid rgba(255,255,255,0.1)',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Song Info */}
            <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                {/* Thumbnail */}
                {currentSong.thumbnail && (
                    <Box
                        component="img"
                        src={currentSong.thumbnail}
                        alt={currentSong.title}
                        sx={{
                            width: 60,
                            height: 60,
                            borderRadius: 1,
                            objectFit: 'cover',
                            flexShrink: 0
                        }}
                    />
                )}

                {/* Song title */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                        variant="subtitle1"
                        sx={{
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '1.1rem',
                            lineHeight: 1.2
                        }}
                        noWrap
                    >
                        {currentSong.title}
                    </Typography>
                </Box>

                {/* Sync Button */}
                <SyncButton
                    onClick={handleSync}
                    disabled={syncStatus === 'syncing'}
                    startIcon={syncButtonContent.icon}
                    size="small"
                >
                    {syncButtonContent.text}
                </SyncButton>
            </Box>

            {/* Progress Bar */}
            <Box sx={{ mb: 1 }}>
                <StyledLinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{ mb: 1 }}
                />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.75rem', fontWeight: 500 }}>
                        {formatTime(currentTime)}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: '0.75rem', fontWeight: 500 }}>
                        {formatTime(duration)}
                    </Typography>
                </Box>
            </Box>

            <style>{`@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </Paper>
    );
};

export default SongWidget;