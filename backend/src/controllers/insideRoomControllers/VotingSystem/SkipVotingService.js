// In-memory storage for room skip votes
const roomSkipVotes = new Map();

class SkipVotingService {
  // Helper function for consistent threshold calculation
  static calculateThreshold(liveViewers) {
    if (liveViewers <= 1) return 1;
    if (liveViewers === 2) return 2;
    return Math.floor(liveViewers / 2) + 1;
  }

  // Get skip votes for a room
  static getSkipVotes(roomId) {
    return roomSkipVotes.get(roomId) || new Set();
  }

  // Initialize skip votes for a room
  static initializeSkipVotes(roomId) {
    if (!roomSkipVotes.has(roomId)) {
      roomSkipVotes.set(roomId, new Set());
    }
    return roomSkipVotes.get(roomId);
  }

  // **FIXED**: Proper toggle functionality
  static toggleUserVote(roomId, userId) {
    const skipVotes = this.initializeSkipVotes(roomId);
    
    let action;
    if (skipVotes.has(userId)) {
      // User already voted - remove their vote
      skipVotes.delete(userId);
      action = 'removed';
    } else {
      // User hasn't voted - add their vote
      skipVotes.add(userId);
      action = 'added';
    }
    
    return { action, skipCount: skipVotes.size };
  }

  // Keep addUserVote for specific cases
  static addUserVote(roomId, userId) {
    const skipVotes = this.initializeSkipVotes(roomId);
    
    if (skipVotes.has(userId)) {
      return { action: 'already_voted', skipCount: skipVotes.size };
    }
    
    skipVotes.add(userId);
    return { action: 'added', skipCount: skipVotes.size };
  }

  // Remove user vote specifically
  static removeUserVote(roomId, userId) {
    const skipVotes = roomSkipVotes.get(roomId);
    if (!skipVotes || !skipVotes.has(userId)) {
      return { action: 'not_voted', skipCount: skipVotes ? skipVotes.size : 0 };
    }
    
    skipVotes.delete(userId);
    return { action: 'removed', skipCount: skipVotes.size };
  }

  // Check if user has voted
  static hasUserVoted(roomId, userId) {
    const skipVotes = roomSkipVotes.get(roomId);
    const hasVoted = skipVotes ? skipVotes.has(userId) : false;
    return hasVoted;
  }

  // Get skip vote count
  static getSkipCount(roomId) {
    const skipVotes = roomSkipVotes.get(roomId);
    return skipVotes ? skipVotes.size : 0;
  }

  // Enhanced threshold checking with logging
  static async checkAndTriggerSkip(roomId, liveViewers, authHeader, io) {
    const skipCount = this.getSkipCount(roomId);
    const threshold = this.calculateThreshold(liveViewers);

    if (skipCount >= threshold && liveViewers > 0) {
      try {
        // Call playNextSong directly instead of making HTTP request to self
        const CurrentSongController = require('../CurrentSongController');
        await CurrentSongController.playNextSong(roomId, io, 'SkipSong');

        // Emit skip notification
        io.to(`room-${roomId}`).emit('songSkippedByVote', {
          reason: 'majority_vote',
          voteCount: skipCount,
          threshold
        });

        return true;
      } catch (skipError) {
        console.error('[SKIP ERROR] Error triggering skip:', skipError.message);
        return false;
      }
    }

    return false;
  }

  // **ENHANCED**: Clear skip votes for a room
  static clearRoomSkipVotes(roomId) {
    roomSkipVotes.delete(roomId);
  }

  // Remove user from skip votes (when user leaves)
  static removeUserFromSkipVotes(roomId, userId) {
    const skipVotes = roomSkipVotes.get(roomId);
    if (skipVotes && skipVotes.has(userId)) {
      skipVotes.delete(userId);
      return true;
    }
    return false;
  }

  // Get detailed voting info for debugging
  static getVotingInfo(roomId) {
    const skipVotes = roomSkipVotes.get(roomId) || new Set();
    return {
      roomId,
      voterIds: Array.from(skipVotes),
      voteCount: skipVotes.size,
      timestamp: Date.now()
    };
  }

  // **NEW**: Debug method to see all room votes
  static getAllRoomVotes() {
    const allVotes = {};
    for (const [roomId, votes] of roomSkipVotes.entries()) {
      allVotes[roomId] = Array.from(votes);
    }
    return allVotes;
  }
}

module.exports = SkipVotingService;