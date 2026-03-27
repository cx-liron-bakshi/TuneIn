import React, { useState } from 'react';
import { Button, CircularProgress, useMediaQuery, useTheme } from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import axios from 'axios';
import { useSocket } from '../../Context/SocketContext';

const PauseButton = ({ isPaused }) => {
  const { roomId } = useSocket();
  const [loading, setLoading] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  const handleToggle = async () => {
    if (loading) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const action = isPaused ? 'resume' : 'pause';
      await axios.post(
        `${process.env.REACT_APP_API_URL}/api/song/${roomId}/${action}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (error) {
      console.error('Pause/resume error:', error);
    } finally {
      setLoading(false);
    }
  };

  const icon = isPaused ? <PlayArrowIcon /> : <PauseIcon />;

  return (
    <Button
      variant="contained"
      startIcon={!isMobile && (loading ? <CircularProgress size={16} /> : icon)}
      onClick={handleToggle}
      disabled={loading}
      size="small"
      sx={{
        bgcolor: isPaused ? '#4caf50' : '#ff9800',
        color: 'white',
        '&:hover': {
          bgcolor: isPaused ? '#388e3c' : '#f57c00'
        },
        '&:disabled': {
          backgroundColor: isPaused ? 'rgba(76, 175, 80, 0.3)' : 'rgba(255, 152, 0, 0.3)',
        },
        textTransform: 'none',
        minWidth: isMobile ? '36px' : '110px',
        height: '36px',
        ...(isMobile && {
          padding: '6px',
          '& .MuiButton-startIcon': {
            display: 'none'
          }
        })
      }}
    >
      {isMobile ? (
        loading ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : (isPaused ? '▶' : '⏸')
      ) : (
        loading ? (isPaused ? 'Resuming...' : 'Pausing...') : (isPaused ? 'Resume' : 'Pause')
      )}
    </Button>
  );
};

export default PauseButton;
