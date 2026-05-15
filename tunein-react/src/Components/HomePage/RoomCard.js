import React, { useState } from 'react';
import { 
  Card, 
  CardContent, 
  CardMedia, 
  Typography, 
  CardActionArea, 
  Box,
  Chip,
  useTheme
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PeopleIcon from '@mui/icons-material/People';
import { DEFAULT_ROOM_IMAGE } from '../../constants';

const RoomCard = ({ room }) => {
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  const theme = useTheme();

  const handleCardClick = () => {
    navigate(`/room/${room._id}`);
  };

  // Use only the capacity field from the room data
  const displayViewers = room.capacity || 0;

  return (
    <Card sx={{ 
      maxWidth: '100%', 
      height: '100%',
      display: 'flex', 
      flexDirection: 'column',
      position: 'relative',
      backgroundColor: theme.palette.background.paper
    }}> 
      <CardActionArea 
        onClick={handleCardClick} 
        sx={{ 
          flexGrow: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'stretch',
          cursor: 'pointer',
          transition: 'transform 0.2s',
          '&:hover': {
            transform: 'scale(1.02)',
          }
        }}
      >
        {/* Live Viewer Count Badge */}
        <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
          <Chip
            icon={<PeopleIcon sx={{ fontSize: '16px !important' }} />}
            label={displayViewers}
            size="small"
            sx={{
              backgroundColor: displayViewers > 0 ? '#4caf50' : '#757575',
              color: 'white',
              fontWeight: 'bold',
              '& .MuiChip-icon': {
                color: 'white'
              }
            }}
          />
        </Box>

        <CardMedia
          component="img"
          height="140"
          loading="lazy"
          image={imageError ? DEFAULT_ROOM_IMAGE : room.image}
          alt={room.name}
          onError={() => setImageError(true)}
          sx={{ objectFit: 'cover' }}
        />
        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Typography gutterBottom variant="h5" component="div" sx={{ fontWeight: 'bold' }}>
              {room.name}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            {room.genres?.slice(0, 3).map((genre, index) => (
              <Chip 
                key={index}
                label={genre}
                size="small"
                variant="outlined"
                sx={{ 
                  backgroundColor: '#FF0000', 
                  color: 'white',
                  fontSize: '0.65rem',
                  height: 20
                }}
              />
            ))}
            {room.genres?.length > 3 && (
              <Chip 
                label={`+${room.genres.length - 3}`}
                size="small"
                variant="outlined"
                sx={{ 
                  fontSize: '0.65rem',
                  height: 20
                }}
              />
            )}
          </Box>

          {/* Room Stats */}
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <PeopleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              {displayViewers} {displayViewers === 1 ? 'listener' : 'listeners'}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', mt: 'auto' }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              Created by: {room.creator?.nickname || "Unknown"}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default React.memo(RoomCard);