import { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  CircularProgress,
  Typography,
} from '@mui/material';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import axios from 'axios';

const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: 'white',
    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
    '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.4)' },
    '&.Mui-focused fieldset': { borderColor: '#1DB954' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' },
  '& .MuiInputLabel-root.Mui-focused': { color: '#1DB954' },
};

const PlaylistImport = () => {
  const [url, setUrl] = useState('');
  const [limit, setLimit] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const handleImport = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('No auth token found');

      const pathParts = window.location.pathname.split('/');
      const roomId = pathParts[pathParts.indexOf('room') + 1];
      if (!roomId) throw new Error('No roomId found in URL path');

      const parsedLimit = parseInt(limit);
      const body = { playlistUrl: url.trim() };
      if (!isNaN(parsedLimit) && parsedLimit > 0) body.limit = parsedLimit;

      const res = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/queue/${roomId}/import-playlist`,
        body,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccessMsg(`${res.data.count} songs added to queue!`);
      setUrl('');
      setLimit('');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to import playlist. Check the URL and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      <form onSubmit={handleImport}>
        {/* URL input — full width */}
        <TextField
          fullWidth
          variant="outlined"
          size="small"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          label="Playlist URL"
          placeholder="youtube.com/playlist?list=..."
          InputLabelProps={{ shrink: true }}
          InputProps={{ sx: { bgcolor: 'rgba(255, 255, 255, 0.05)', fontSize: '0.8rem' } }}
          sx={{ ...inputSx, mb: 0.5 }}
        />
        <Typography variant="caption" sx={{ display: 'block', color: 'rgba(255,255,255,0.35)', mb: 1.5, fontSize: '0.7rem' }}>
          Supports YouTube &amp; YouTube Music playlists · paste a single song for radio mode
        </Typography>

        {/* Max songs + Import button on same row */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            variant="outlined"
            size="small"
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            label="Max songs"
            placeholder="50"
            inputProps={{ min: 1, max: 50 }}
            InputLabelProps={{ shrink: true }}
            InputProps={{ sx: { bgcolor: 'rgba(255, 255, 255, 0.05)', fontSize: '0.8rem' } }}
            sx={{
              ...inputSx,
              width: '110px',
              flexShrink: 0,
              '& input[type=number]': { MozAppearance: 'textfield' },
              '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                WebkitAppearance: 'none',
              },
            }}
          />

          <Button
            type="submit"
            variant="contained"
            disabled={loading || !url.trim()}
            startIcon={loading ? null : <PlaylistAddIcon sx={{ fontSize: '18px !important' }} />}
            sx={{
              flexGrow: 1,
              bgcolor: '#1DB954',
              '&:hover': { bgcolor: '#1AA34A' },
              '&:disabled': { bgcolor: 'rgba(29,185,84,0.3)', color: 'rgba(255,255,255,0.4)' },
              height: '40px',
              fontSize: '0.78rem',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            {loading ? <CircularProgress size={18} color="inherit" /> : 'Import'}
          </Button>
        </Box>
      </form>

      {error && (
        <Typography color="error" variant="caption" sx={{ mt: 1, display: 'block' }}>
          {error}
        </Typography>
      )}

      {successMsg && (
        <Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#1DB954', fontWeight: 600 }}>
          {successMsg}
        </Typography>
      )}
    </Box>
  );
};

export default PlaylistImport;
