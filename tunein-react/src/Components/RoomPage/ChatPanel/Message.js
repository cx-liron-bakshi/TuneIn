import React from 'react';
import { Box, Typography, Avatar } from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';

const Message = ({ message, onUsernameClick, showCreatorBadge }) => {
  // Format video timestamp
  const formatVideoTime = (seconds) => {
    if (!seconds && seconds !== 0) return null;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Safe fallback for userName
  const userName = message.userName || 'Anonymous';
  const userMessage = message.message || '';

  // Handle username click
  const handleUsernameClick = () => {
    if (onUsernameClick && userName !== 'Anonymous') {
      onUsernameClick(userName);
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        {/* User profile picture or avatar */}
        {message.userPicture ? (
          <Box
            component="img"
            src={message.userPicture}
            alt={userName}
            sx={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              objectFit: 'cover',
              border: '1px solid rgba(255,255,255,0.2)',
              flexShrink: 0
            }}
          />
        ) : (
          <Avatar 
            sx={{ 
              width: 28, 
              height: 28, 
              fontSize: '0.8rem',
              bgcolor: `hsl(${userName.charCodeAt(0) * 10}, 60%, 50%)`,
              flexShrink: 0
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </Avatar>
        )}
        
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Typography 
              variant="caption" 
              onClick={handleUsernameClick}
              sx={{ 
                color: `hsl(${userName.charCodeAt(0) * 10}, 60%, 70%)`,
                fontWeight: 600,
                fontSize: '0.75rem',
                cursor: userName !== 'Anonymous' ? 'pointer' : 'default',
                '&:hover': userName !== 'Anonymous' ? {
                  color: `hsl(${userName.charCodeAt(0) * 10}, 70%, 80%)`,
                  textDecoration: 'underline'
                } : {}
              }}
            >
              {userName}
            </Typography>
            
            {/* Creator Badge */}
            {showCreatorBadge && (
              <VerifiedIcon 
                sx={{ 
                  color: '#1976d2', 
                  fontSize: 12, 
                  ml: 0.3 
                }} 
              />
            )}
            
            {/* Video timestamp */}
            {message.videoTimestamp !== null && message.videoTimestamp !== undefined && (
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '0.7rem',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  px: 0.5,
                  py: 0.2,
                  borderRadius: 0.5
                }}
              >
                {formatVideoTime(message.videoTimestamp)}
              </Typography>
            )}
          </Box>
          
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'white',
              fontSize: '0.875rem',
              lineHeight: 1.4,
              wordBreak: 'break-word'
            }}
          >
            {userMessage}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default React.memo(Message);