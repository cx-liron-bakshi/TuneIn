import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, CircularProgress } from '@mui/material';
import axios from 'axios';
import QueueBar from '../Components/RoomPage/QueueBar/QueueBar';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../Components/AuthPage/AuthContext';
import CurrentSong from '../Components/RoomPage/CurrentSong/CurrentSong';
import ChatPanel from '../Components/RoomPage/ChatPanel/ChatPanel';
import { SocketProvider } from '../Components/RoomPage/Context/SocketContext';
import io from 'socket.io-client';

const RoomPage = () => {
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [roomSocket, setRoomSocket] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    const fetchRoomData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('authToken');
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/rooms/${roomId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setRoom(response.data);
        setError(null);
      } catch (err) {
        console.error("Error fetching room data:", err);
        if (err.response && err.response.status === 404) {
          alert("There's no such room.");
          navigate('/home');
        } else if (err.response && err.response.status === 401) {
          logout();
          navigate('/auth');
        } else {
          setError("Failed to load the room. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    if (roomId) {
      fetchRoomData();
    }
  }, [roomId, navigate, logout]);

  // Create socket when RoomPage mounts
  useEffect(() => {
    if (!roomId) {
      console.error('No roomId provided for socket connection');
      return;
    }

    console.log('RoomPage: Creating socket connection for room:', roomId);
    console.log('Creator of the room:', room?.creator);
    

    const token = localStorage.getItem('authToken');
    const newSocket = io(process.env.REACT_APP_API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    newSocket.on('connect', () => {
      console.log('RoomPage socket connected successfully');
    });

    newSocket.on('disconnect', () => {
      console.log('RoomPage socket disconnected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('RoomPage socket connection error:', error);
    });

    setRoomSocket(newSocket);

    return () => {
      console.log('RoomPage: Cleaning up socket connection');
      newSocket.disconnect();
      setRoomSocket(null);
    };
  }, [roomId]);

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <CircularProgress color="primary" />
    </Box>
  );

  if (error) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'error.main' }}>
      <Typography variant="h6">{error}</Typography>
    </Box>
  );

  return (
    <SocketProvider newSocket={roomSocket} roomId={roomId} roomCreator={room?.creator}>
      <Box sx={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#121212',
        color: 'white',
        overflow: 'hidden',
        position: 'fixed',
        top: 0,
        left: 0
      }}>
        {/* Left Sidebar */}
        <QueueBar roomName={room?.name} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

        {/* Main content area */}
        <Box sx={{
          width: '100%',
          height: {
            xs: '100dvh',  // Dynamic viewport height for mobile (accounts for browser UI)
            sm: '100dvh',  // Dynamic viewport height for small devices
            md: '100vh',   // Standard viewport height for tablets and up
            lg: '100vh',
            xl: '100vh'
          },
          padding: {
            xs: '4px 4px 4px 50px',    // Mobile: Reduced padding for more space
            sm: '6px 6px 6px 50px',    // Small: Space only for toggle button
            md: isSidebarOpen ? '12px 12px 12px 340px' : '12px 12px 12px 60px', // Medium: Adjust for sidebar
            lg: isSidebarOpen ? '16px 16px 16px 340px' : '16px 16px 16px 60px', // Large: Adjust for sidebar
            xl: isSidebarOpen ? '20px 20px 20px 340px' : '20px 20px 20px 60px'  // XL: Adjust for sidebar
          },
          transition: 'padding-left 0.3s ease-in-out', // Smooth transition matching sidebar
          display: 'flex',
          flexDirection: 'column',
          alignItems: {
            xs: 'center',   // Center on mobile
            sm: 'center',   // Center on small tablets
            md: 'center',   // Center on medium tablets
            lg: 'stretch',  // Normal alignment on desktop
            xl: 'stretch'   // Normal alignment on large desktop
          },
          overflow: 'hidden',
          boxSizing: 'border-box'
        }}>

          {/* Content Container */}
          <Box sx={{
            width: {
              xs: '100%',     // Full width on mobile
              sm: '100%',     // Full width on small tablets
              md: '100%',     // Full width on medium tablets
              lg: '100%',     // Full width on desktop
              xl: '100%'      // Full width on XL
            },
            maxWidth: 'none',
            height: '100%',
            display: 'flex',
            flexDirection: {
              xs: 'column',    // Mobile: Stack vertically
              sm: 'column',    // Small tablets: Stack vertically  
              md: 'row',       // Medium tablets: Side by side
              lg: 'row',       // Laptops: Side by side
              xl: 'row'        // Desktops: Side by side
            },
            gap: { // Gap between components
              xs: 0.25,  // Minimal gap on mobile to maximize space
              sm: 0.5,   // Small gap on small devices
              md: 2,     // Medium gap on tablets
              lg: 4,     
              xl: 5      
            },
            overflow: 'hidden',
            boxSizing: 'border-box',
            margin: '0 auto'
          }}>

            {/* Current Song Section */}
            <Box sx={{
              flex: {
                xs: '1 1 auto',        // Mobile: Take available space
                sm: '1 1 auto',        // Small: Take available space
                md: '1 1 70%',         // Medium: 70% width (side by side)
                lg: '1 1 75%',         // Large: 75% width
                xl: '1 1 70%'          // XL: 70% width for better balance
              },
              minHeight: {
                xs: 0,                 // Allow flex shrinking on mobile
                sm: 0,
                md: 0,
                lg: 0,
                xl: 0
              },
              height: {
                xs: '58%',             // Mobile: Reduced to give ChatPanel more reliable space
                sm: '62%',             // Small: Adjusted
                md: '100%',            // Medium: Full height (side by side)
                lg: '100%',            // Large: Full height (side by side)
                xl: '100%'             // XL: Full height (side by side)
              },
              maxHeight: {
                xs: '58%',             // Enforce max height on mobile
                sm: '62%',             // Enforce max height on small
                md: 'calc(100vh - 24px)',  // Account for padding on tablets
                lg: 'calc(100vh - 32px)',  // Account for padding on desktop
                xl: 'calc(100vh - 40px)'   // Account for padding on large desktop
              },
              display: 'flex',
              flexDirection: 'column',
              // **FIX**: Disable scroll on XL, keep for other sizes
              overflow: {
                xs: 'auto',    // Allow scrolling on mobile
                sm: 'auto',    // Allow scrolling on small devices
                md: 'auto',    // Allow scrolling on medium devices
                lg: 'auto',    // Allow scrolling on large devices
                xl: 'auto'     // Allow scrolling on XL screens if needed
              },
              boxSizing: 'border-box',
              // Custom scrollbar styling (for non-XL screens)
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
              <CurrentSong />
            </Box>

            {/* Chat Panel Section - With extra right spacing on XL */}
            <Box sx={{
              flex: {
                xs: '1 1 auto',        // Mobile: Take remaining space
                sm: '1 1 auto',        // Small: Take remaining space
                md: '0 0 30%',         // Medium: 30% width (side by side)
                lg: '0 0 25%',         // Large: 25% width
                xl: '0 0 30%'          // XL: 30% width for balance
              },
              minHeight: {
                xs: '250px',           // Ensure minimum usable height on mobile
                sm: '280px',           // Ensure minimum usable height on small
                md: 0,                 // No min height needed (side by side)
                lg: 0,
                xl: 0
              },
              height: {
                xs: '42%',             // Mobile: Increased to prevent cutoff
                sm: '38%',             // Small: Adjusted
                md: '100%',            // Medium: Full height (side by side)
                lg: '100%',            // Large: Full height (side by side)
                xl: '100%'             // XL: Full height (side by side)
              },
              maxHeight: {
                xs: '42%',             // Enforce max height on mobile
                sm: '38%',             // Enforce max height on small
                md: 'calc(100vh - 24px)',  // Account for padding on tablets
                lg: 'calc(100vh - 32px)',  // Account for padding on desktop
                xl: 'calc(100vh - 40px)'   // Account for padding on large desktop
              },
              // **FIX**: Extra right margin on XL for better spacing
              marginRight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}>
              <ChatPanel roomId={roomId} />
            </Box>

          </Box>
        </Box>
      </Box>
    </SocketProvider>
  );
};

export default RoomPage;
