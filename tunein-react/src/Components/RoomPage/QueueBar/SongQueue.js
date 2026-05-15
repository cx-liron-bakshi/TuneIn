import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  CircularProgress
} from '@mui/material';
import axios from 'axios';
import SongCard from './SongCard';
import { useSocket } from '../Context/SocketContext';

const SongQueue = () => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUsername, setCurrentUsername] = useState('');
  const { newSocket, roomId } = useSocket();

  // Get current user's username
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) return;

        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/user/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCurrentUsername(response.data.nickname);
      } catch (err) {
        console.error('Error fetching current user:', err);
      }
    };

    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (!newSocket || !roomId) {
      return;
    }

    // Listen for queue updates
    newSocket.on('queueUpdated', (data) => {
      setQueue(data.queue || []);
    });

    // Cleanup listener
    return () => {
      if (newSocket) {
        newSocket.off('queueUpdated');
      }
    };
  }, [newSocket, roomId]); // Dependencies: re-run when socket or roomId changes



  // Fetch queue data (initial load)
  const fetchQueue = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('authToken');

      if (!roomId || !token) return; // Use roomId from context

      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/queue/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setQueue(response.data.queue || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching queue:', err);
      setError('Failed to load queue');
    } finally {
      setLoading(false);
    }
  };

  // Load queue on component mount
  useEffect(() => {
    fetchQueue();
  }, []);

  // Handle removing song from queue
  const handleRemoveSong = async (song, index) => {
    try {
      const token = localStorage.getItem('authToken');

      await axios.delete(`${process.env.REACT_APP_API_URL}/api/queue/${roomId}/${index}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // No need to manually refresh - socket will handle the update
    } catch (err) {
      console.error('Error removing song:', err);
    }
  };

  // Format song data for SongCard (replace artist with username)
  const formatSongForQueue = (song) => {
    return {
      ...song,
      artist: song.addedby,
      channelTitle: song.addedby
    };
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Typography
        variant="h6"
        sx={{
          color: 'white',
          mb: 2,
          fontWeight: 600
        }}
      >
        Song Queue ({queue.length})
      </Typography>

      {error && (
        <Typography
          color="error"
          variant="caption"
          sx={{ mt: 1 }}
        >
          {error}
        </Typography>
      )}

      {queue.length === 0 ? (
        <Typography
          variant="body2"
          sx={{
            color: 'rgba(255,255,255,0.6)',
            textAlign: 'center',
            py: 4
          }}
        >
          No songs in queue. Add some songs to get started!
        </Typography>
      ) : (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1, color: 'rgba(255,255,255,0.8)' }}>
            Current Queue:
          </Typography>
          <List sx={{ p: 0 }}>
            {queue.map((song, index) => {
              const canRemove = currentUsername === song.addedby;

              return (
                <SongCard
                  key={song.id}
                  song={formatSongForQueue(song)}
                  context={canRemove ? 'queue' : 'display'}
                  onAction={canRemove ? (s) => handleRemoveSong(s, index) : null}
                  disabled={false}
                />
              );
            })}
          </List>
        </Box>
      )}
    </Box>
  );
};

export default SongQueue;