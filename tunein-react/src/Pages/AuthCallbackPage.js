// src/Pages/AuthCallbackPage.js
import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../Components/AuthPage/AuthContext';
import { Box, CircularProgress, Typography } from '@mui/material';
import axios from 'axios';

export default function AuthCallbackPage() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const exchangeCode = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get('code');

      if (!code) {
        navigate('/auth?error=callback_failed', { replace: true });
        return;
      }

      try {
        const response = await axios.post(
          `${process.env.REACT_APP_API_URL}/api/auth/google/exchange`,
          { code }
        );
        const { token, userId } = response.data;
        login(token, userId);
        navigate('/home', { replace: true });
      } catch (err) {
        navigate('/auth?error=callback_failed', { replace: true });
      }
    };

    exchangeCode();
  }, [login, location.search, navigate]);

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
      <CircularProgress />
      <Typography ml={2}>Logging you in...</Typography>
    </Box>
  );
}
