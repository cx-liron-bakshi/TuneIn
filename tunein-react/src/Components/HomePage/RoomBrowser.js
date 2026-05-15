import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  CircularProgress,
  FormControlLabel,
  Radio,
  RadioGroup,
  Paper,
  Divider,
  useTheme
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import axios from 'axios';
import RoomCard from './RoomCard';
import CreateRoomModal from './CreateRoomModal';

const RoomBrowser = () => {
  const [rooms, setRooms] = useState([]);
  const [filteredRooms, setFilteredRooms] = useState([]);
  const [userGenres, setUserGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [filterMode, setFilterMode] = useState('all'); // 'all' or 'recommended'
  const [genresLoading, setGenresLoading] = useState(false);

  useEffect(() => {
    fetchRooms();
    fetchUserGenres();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [rooms, userGenres, filterMode]);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      const userId = localStorage.getItem('userId');
      if (!token || !userId) {
        setError('Authentication required. Please log in again.');
        setLoading(false);
        return;
      }
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/rooms`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        params: {
          userId: userId
        }
      });
      const data = response.data;
      setRooms(data.rooms || data);
      setError(null);
    } catch (err) {
      console.error('Error fetching rooms:', err);
      setError('Failed to load rooms. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserGenres = async () => {
    setGenresLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/user/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setUserGenres(response.data.genres || []);
    } catch (err) {
      console.error('Error fetching user genres:', err);
      // Don't show error for genres fetch failure, just continue with empty genres
    } finally {
      setGenresLoading(false);
    }
  };

  const applyFilter = () => {
    if (filterMode === 'all') {
      setFilteredRooms(rooms);
    } else if (filterMode === 'recommended') {
      if (userGenres.length === 0) {
        setFilteredRooms([]);
        return;
      }

      const recommended = rooms.filter(room => {
        if (!room.genres || room.genres.length === 0) return false;

        // Check if room has at least 1 genre in common with user genres
        return room.genres.some(roomGenre =>
          userGenres.some(userGenre =>
            userGenre.toLowerCase() === roomGenre.toLowerCase()
          )
        );
      });

      setFilteredRooms(recommended);
    }
  };

  const handleFilterChange = async (event) => {
    const newFilterMode = event.target.value;
    setFilterMode(newFilterMode);
    
    // If switching to recommended, refresh user genres to get latest preferences
    if (newFilterMode === 'recommended') {
      await fetchUserGenres();
    }
  };

  const handleCreateRoom = async (roomData) => {
    try {
      const token = localStorage.getItem('authToken');

      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const response = await axios.post(`${process.env.REACT_APP_API_URL}/api/rooms`, roomData, {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      // Refresh rooms after creation
      fetchRooms();

    } catch (error) {
      console.error('Error creating room:', error);
    }
  };

  const getFilterStats = () => {
    const total = rooms.length;
    const recommended = rooms.filter(room => {
      if (!room.genres || room.genres.length === 0 || userGenres.length === 0) return false;
      return room.genres.some(roomGenre =>
        userGenres.some(userGenre =>
          userGenre.toLowerCase() === roomGenre.toLowerCase()
        )
      );
    }).length;

    return { total, recommended };
  };

  const getCommonGenres = () => {
    if (userGenres.length === 0 || filteredRooms.length === 0) return [];

    const roomGenres = new Set();
    filteredRooms.forEach(room => {
      if (room.genres) {
        room.genres.forEach(genre => roomGenres.add(genre.toLowerCase()));
      }
    });

    return userGenres.filter(userGenre =>
      roomGenres.has(userGenre.toLowerCase())
    );
  };

  const stats = getFilterStats();
  const commonGenres = getCommonGenres();
  const theme = useTheme();



  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'center', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ flex: 1, textAlign: 'center', color: theme.palette.text.primary }}>
          Music Rooms
        </Typography>
        <Box sx={{ ml: { sm: 'auto' }, mt: { xs: 1, sm: 0 }, mr: { xs: 0, sm: 6 } }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenCreateModal(true)}
          >
            Create Room
          </Button>
        </Box>
      </Box>

      {/* Filter Controls */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: theme.palette.background.paper }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <FilterListIcon sx={{ mr: 1, color: theme.palette.text.primary }} />
          <Typography variant="h6" sx={{ color: theme.palette.text.primary }}>Filter Rooms</Typography>
        </Box>
        <RadioGroup
          row
          value={filterMode}
          onChange={handleFilterChange}
          sx={{ mb: 1 }}
        >
          <FormControlLabel
            value="all"
            control={<Radio />}
            label={`All Rooms (${stats.total})`}
          />
          <FormControlLabel
            value="recommended"
            control={<Radio />}
            label={
              genresLoading
                ? "Loading recommendations..."
                : userGenres.length === 0
                  ? "Recommended (Set your genres in profile)"
                  : `Recommended for You (${stats.recommended})`
            }
            disabled={genresLoading || userGenres.length === 0}
          />
        </RadioGroup>
        {filterMode === 'recommended' && commonGenres.length > 0 && (
          <Typography variant="caption" color="textSecondary">
            Based on your genres: {commonGenres.join(', ')}
          </Typography>
        )}
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Typography color="error" sx={{ textAlign: 'center', my: 4 }}>
          {error}
        </Typography>
      ) : (
        <Grid container spacing={3}>
          {filteredRooms.length > 0 ? (
            filteredRooms.map((room) => (
              <Grid item xs={12} sm={6} md={4} key={room._id}>
                <RoomCard room={room} />
              </Grid>
            ))
          ) : (
            <Box sx={{ width: '100%', textAlign: 'center', my: 4 }}>
              <Typography variant="h6" color="textSecondary">
                {filterMode === 'recommended'
                  ? userGenres.length === 0
                    ? "Set your favorite genres in your profile to get personalized recommendations!"
                    : "No rooms match your preferences. Try creating one or switch to 'All Rooms'!"
                  : "No rooms available. Create one to get started!"
                }
              </Typography>
            </Box>
          )}
        </Grid>
      )}

      <CreateRoomModal
        open={openCreateModal}
        onClose={() => setOpenCreateModal(false)}
        onSubmit={handleCreateRoom}
      />
    </Box>
  );
};

export default RoomBrowser;