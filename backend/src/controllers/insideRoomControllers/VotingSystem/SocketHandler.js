const jwt = require('jsonwebtoken');
const LiveViewersController = require('./LiveViewersController');
const SkipVotingService = require('./SkipVotingService');

class SocketHandler {
  static setupSocketHandlers(io) {
    // Authenticate socket connections via JWT
    io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        next();
      } catch (err) {
        return next(new Error('Invalid or expired token'));
      }
    });

    io.on('connection', (socket) => {

      // Handle room joining with enhanced tracking
      socket.on('joinRoom', async (roomId) => {
        socket.join(`room-${roomId}`);
        socket.roomId = roomId;

        // Update viewer count and emit to all users
        await this.updateRoomViewerCount(roomId, io, 'user_joined');
      });

      // Handle room leaving with cleanup
      socket.on('leaveRoom', async (roomId) => {
        socket.leave(`room-${roomId}`);

        // Remove user from skip votes and update counts
        const userId = socket.userId;
        if (userId) {
          LiveViewersController.removeUserFromSkipVotes(roomId, userId);
        }

        // Update viewer count for remaining users
        await this.updateRoomViewerCount(roomId, io, 'user_left');
      });

      // Handle disconnect with proper cleanup
      socket.on('disconnect', async () => {
        // Clean up if user was in a room
        if (socket.roomId) {
          const roomId = socket.roomId;
          const userId = socket.userId;

          // Remove from skip votes
          if (userId) {
            LiveViewersController.removeUserFromSkipVotes(roomId, userId);
          }

          // Update viewer count for remaining users
          await this.updateRoomViewerCount(roomId, io, 'user_disconnected');
        }
      });

    });
  }

  // Update room viewer count and emit updates
  static async updateRoomViewerCount(roomId, io, reason = 'update') {
    try {
      // Get current live viewers
      const roomSockets = await io.in(`room-${roomId}`).fetchSockets();
      const liveViewers = roomSockets.length;
      
      // **CRITICAL FIX**: Update room capacity in database
      const ViewerTrackingService = require('./ViewerTrackingService');
      await ViewerTrackingService.updateRoomCapacity(roomId, liveViewers);
      
      // Emit viewer count update
      io.to(`room-${roomId}`).emit('viewerCountUpdate', {
        liveViewers,
        reason
      });

      // Also emit updated skip threshold since viewer count changed
      const skipCount = SkipVotingService.getSkipCount(roomId);
      const threshold = SkipVotingService.calculateThreshold(liveViewers);
      
      io.to(`room-${roomId}`).emit('skipVoteUpdate', {
        liveViewers,
        skipCount,
        threshold,
        reason: `viewer_${reason}`
      });

    } catch (error) {
      console.error(`[SOCKET] Error updating viewer count for room ${roomId}:`, error);
    }
  }

  // Force update all clients in a room (useful for manual triggers)
  static async forceUpdateRoom(roomId, io, reason = 'manual_update') {
    await this.updateRoomViewerCount(roomId, io, reason);
  }

  // Get current viewer count for a room
  static async getRoomViewerCount(roomId, io) {
    try {
      const roomSockets = await io.in(`room-${roomId}`).fetchSockets();
      return roomSockets.length;
    } catch (error) {
      console.error(`[SOCKET] Error getting viewer count for room ${roomId}:`, error);
      return 0;
    }
  }
}

module.exports = SocketHandler;