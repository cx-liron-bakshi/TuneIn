import React from 'react';
import { Box, Typography, Button } from '@mui/material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#121212',
          color: 'white',
          gap: 2
        }}>
          <Typography variant="h5">Something went wrong</Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            An unexpected error occurred. Please try refreshing the page.
          </Typography>
          <Button
            variant="contained"
            onClick={() => window.location.reload()}
            sx={{ mt: 2, backgroundColor: 'rgba(29, 185, 84, 0.8)', '&:hover': { backgroundColor: 'rgba(29, 185, 84, 1)' } }}
          >
            Refresh Page
          </Button>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
