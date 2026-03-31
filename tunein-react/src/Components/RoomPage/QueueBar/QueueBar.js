import { useState } from 'react';
import { Box, Typography, IconButton, Tabs, Tab } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import SearchSong from './SearchSong';
import PlaylistImport from './PlaylistImport';
import SongQueue from './SongQueue';

const QueueBar = ({ roomName, isOpen, setIsOpen }) => {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <>
        <IconButton
          onClick={() => setIsOpen(v => !v)}
          aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
          sx={{
            position: 'fixed',
            left: isOpen ? { 
              xs: '240px',  // Top right of mobile sidebar
              md: '260px'   // Top right of desktop sidebar
            } : '10px',     // Left edge when closed
            // Keep the button at the top but slightly lower on larger screens
            top: { xs: '6px', sm: '10px', md: '14px', lg: '18px' },
            // Keep a consistent small size (not scaling)
            width: 36,
            height: 36,
            backgroundColor: 'rgba(33,33,33,0.97)',
            color: 'white',
            zIndex: 1300,   // Higher z-index to stay above sidebar
            borderRadius: '50%',
            boxShadow: 2,
            transition: 'left 0.3s ease-in-out, top 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: 'rgba(33,33,33,1)',
            }
          }}
          size="small"
        >
          {isOpen 
            ? <CloseIcon sx={{ fontSize: '20px' }} /> 
            : <MenuIcon sx={{ fontSize: '20px' }} />
          }
        </IconButton>

        {/* Sidebar - responsive behavior */}
      <Box sx={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: { 
          xs: '280px', // Mobile width
          md: '300px'  // Desktop width
        },
        backgroundColor: 'rgba(33, 33, 33, 0.97)',
        color: 'white',
        padding: { 
          xs: '15px',
          md: '20px'
        },
        overflow: 'hidden',
        boxShadow: '2px 0px 10px rgba(0, 0, 0, 0.5)',
        boxSizing: 'border-box',
        zIndex: { 
          xs: 1200, // High z-index on mobile to overlay content
          md: 1000   // Normal z-index on desktop
        },
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        transition: 'transform 0.3s ease-in-out',
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
      }}>
        
          <Box sx={{ 
            width: '100%', 
            pt: 0, 
            pb: 2, 
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            mb: 2
          }}>
            <Typography
              variant="h6"
              sx={{
                color: 'white',
                fontWeight: 'bold',
                textAlign: 'center',
                fontSize: { 
                  xs: '1rem',    // Smaller font on mobile
                  md: '1.25rem'  // Normal font on desktop
                },
                // Add some padding to avoid overlap with close button
                pr: 4,
                pt: 0  // Added padding-top to make it slightly higher
              }}
            >
              {roomName || 'Loading...'}
            </Typography>
          </Box>

          {/* Content */}
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            height: 'calc(100% - 80px)', // Account for header space
            overflow: 'hidden'
          }}
        >
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            sx={{
              mb: 1,
              minHeight: 36,
              '& .MuiTabs-indicator': { backgroundColor: '#1DB954' },
              '& .MuiTab-root': {
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.75rem',
                minHeight: 36,
                padding: '6px 12px',
                textTransform: 'none',
              },
              '& .Mui-selected': { color: '#1DB954 !important' },
            }}
          >
            <Tab label="Search" />
            <Tab label="Import Playlist" />
          </Tabs>

          {activeTab === 0 ? <SearchSong /> : <PlaylistImport />}
          
          <Box sx={{ 
            mt: 2, 
            flexGrow: 1, 
            overflow: 'auto', 
            width: '100%',
            // Custom scrollbar for better mobile experience
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(255,255,255,0.3)',
              borderRadius: '3px',
              '&:hover': {
                background: 'rgba(255,255,255,0.5)',
              }
            },
          }}>
            <SongQueue />
          </Box>
        </Box>
      </Box>

      {/* Backdrop for mobile - close sidebar when clicking outside */}
      {isOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 999,
            display: { xs: 'block', md: 'none' }, // Only show on mobile
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default QueueBar;