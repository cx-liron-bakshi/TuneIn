import { createContext, useCallback, useContext, useState, useEffect } from 'react';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children, newSocket, roomId, roomCreator}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [connectionVersion, setConnectionVersion] = useState(0);

  const identifyAndJoinRoom = useCallback(() => {
    if (!newSocket || !roomId) return;

    const userId = localStorage.getItem('userId');
    if (userId) {
      newSocket.emit('setUserId', userId);
      console.log('[SOCKET CONTEXT] Set user ID:', userId);
    }

    newSocket.emit('joinRoom', roomId, (response) => {
      if (response?.ok) {
        console.log('[SOCKET CONTEXT] Joined room:', response.roomId);
      }
    });
  }, [newSocket, roomId]);

  // Monitor the socket connection status
  useEffect(() => {
    if (!newSocket) {
      setIsConnected(false);
      setIsReconnecting(false);
      return;
    }

    const handleConnect = () => {
      setIsConnected(true);
      setIsReconnecting(false);
      setConnectionVersion((version) => version + 1);
      identifyAndJoinRoom();
    };
    const handleDisconnect = () => {
      setIsConnected(false);
      setIsReconnecting(true);
    };
    const handleReconnectAttempt = () => setIsReconnecting(true);

    newSocket.on('connect', handleConnect);
    newSocket.on('disconnect', handleDisconnect);
    newSocket.io.on('reconnect_attempt', handleReconnectAttempt);

    // Set initial state
    setIsConnected(newSocket.connected);
    setIsReconnecting(!newSocket.connected);
    if (newSocket.connected) {
      identifyAndJoinRoom();
      setConnectionVersion((version) => version + 1);
    }

    return () => {
      newSocket.off('connect', handleConnect);
      newSocket.off('disconnect', handleDisconnect);
      newSocket.io.off('reconnect_attempt', handleReconnectAttempt);
    };
  }, [newSocket, identifyAndJoinRoom]);

  const value = {
    newSocket,        // The actual socket instance
    isConnected,   // Connection status
    isReconnecting,
    connectionVersion,
    roomId,         // Room ID for convenience
    roomCreator    // Room creator for additional context
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
