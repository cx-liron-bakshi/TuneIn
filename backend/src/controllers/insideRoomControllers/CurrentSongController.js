const Room = require('../../models/Room');
const SkipVotingService = require('./VotingSystem/SkipVotingService');
const ViewerTrackingService = require('./VotingSystem/ViewerTrackingService');
const UpdateUserPoints = require('./UpdateUserPoints');
const TimerManager = require('./helpers/TimerManager');
const Emitter = require('./helpers/RoomSocketEmitter');

const TRANSITION_DELAY = 5000;
const roomsInCountdown = new Set();
const roomsPaused = new Set();

exports.isCountdownActive = (roomId) => roomsInCountdown.has(roomId);
exports.isRoomPaused = (roomId) => roomsPaused.has(roomId);

function processPoints(song, source) {
  if (!song) return;
  if (source === 'natural_end') {
    UpdateUserPoints.awardNaturalEndPoints(song).catch(e => console.error('[POINTS]', e.message));
  } else if (source === 'SkipSong') {
    UpdateUserPoints.deductSkippedSongPoints(song).catch(e => console.error('[POINTS]', e.message));
  }
}

exports.playNextSong = async (roomId, io, source = 'unknown') => {
  if (roomsInCountdown.has(roomId)) return;

  try {
    SkipVotingService.clearRoomSkipVotes(roomId);
    TimerManager.clearAll(roomId);

    const room = await Room.findById(roomId);
    processPoints(room?.currentSong, source);

    if (!room || room.songqueue.length === 0) {
      await Room.findByIdAndUpdate(roomId, { currentSong: null });
      Emitter.currentSongUpdated(io, roomId, null, Date.now());
      return;
    }

    const nextSong = room.songqueue[0];
    const updatedQueue = room.songqueue.slice(1);

    roomsInCountdown.add(roomId);
    await Room.findByIdAndUpdate(roomId, { songqueue: updatedQueue });

    Emitter.queueUpdated(io, roomId, updatedQueue, source);
    Emitter.countdownStarted(io, roomId, TRANSITION_DELAY / 1000, nextSong, source);

    setTimeout(async () => {
      try {
        roomsInCountdown.delete(roomId);
        const exactStartTime = Date.now();
        const songWithMetadata = { ...nextSong, startTime: exactStartTime, triggerSource: source };
        await Room.findByIdAndUpdate(roomId, { currentSong: songWithMetadata });
        Emitter.currentSongUpdated(io, roomId, songWithMetadata, exactStartTime);

        const liveViewers = await ViewerTrackingService.getLiveViewersCount(roomId, io);
        Emitter.skipVoteUpdate(io, roomId, {
          liveViewers,
          skipCount: SkipVotingService.getSkipCount(roomId),
          threshold: SkipVotingService.calculateThreshold(liveViewers),
          source
        });

      } catch (error) {
        console.error(`[TRANSITION ERROR] Room ${roomId}:`, error);
        roomsInCountdown.delete(roomId);
        TimerManager.clearAll(roomId);
      }
    }, TRANSITION_DELAY);

    if (nextSong.duration) {
      // +1000 for any small delays
      const songTimerDelay = TRANSITION_DELAY + (nextSong.duration * 1000) + 1000;
      const timer = setTimeout(() => {
        exports.playNextSong(roomId, io, 'natural_end');
      }, songTimerDelay);
      TimerManager.setSongDurationTimer(roomId, timer, songTimerDelay);
    }
  } catch (error) {
    console.error(`[playNextSong ERROR] Room ${roomId}:`, error);
    roomsInCountdown.delete(roomId);
    TimerManager.clearAll(roomId);
  }
};

// Skip current song
exports.skipSong = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Allow skip even when paused
    roomsPaused.delete(roomId);

    const io = req.app.get('socketio');
    await exports.playNextSong(roomId, io, "SkipSong");

    return res.status(200).json({ message: 'Song skipped successfully' });
  } catch (error) {
    console.error('Error skipping song:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Pause current song (creator only)
exports.pauseSong = async (req, res) => {
  try {
    const { roomId } = req.params;

    if (roomsPaused.has(roomId)) {
      return res.status(400).json({ error: 'Song is already paused' });
    }

    if (roomsInCountdown.has(roomId)) {
      return res.status(400).json({ error: 'Cannot pause during song transition' });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.currentSong) return res.status(400).json({ error: 'No song is currently playing' });

    if (String(room.creator) !== String(req.user.userId)) {
      return res.status(403).json({ error: 'Only the room creator can pause' });
    }

    const pausedAt = Date.now();
    const elapsedAtPause = Math.floor((pausedAt - room.currentSong.startTime) / 1000);
    const remainingMs = TimerManager.pauseTimer(roomId);

    roomsPaused.add(roomId);

    const updatedSong = {
      ...room.currentSong,
      pausedAt,
      elapsedAtPause,
      remainingMs
    };

    await Room.findByIdAndUpdate(roomId, { currentSong: updatedSong });

    const io = req.app.get('socketio');
    Emitter.songPaused(io, roomId, { pausedAt, elapsedAtPause });

    return res.status(200).json({ message: 'Song paused', elapsedAtPause, remainingMs });
  } catch (error) {
    console.error('Error pausing song:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Resume current song (creator only)
exports.resumeSong = async (req, res) => {
  try {
    const { roomId } = req.params;

    if (!roomsPaused.has(roomId)) {
      return res.status(400).json({ error: 'Song is not paused' });
    }

    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.currentSong) return res.status(400).json({ error: 'No song is currently playing' });

    if (String(room.creator) !== String(req.user.userId)) {
      return res.status(403).json({ error: 'Only the room creator can resume' });
    }

    roomsPaused.delete(roomId);

    const resumeTime = Date.now();
    const elapsedAtPause = room.currentSong.elapsedAtPause || 0;
    const remainingMs = room.currentSong.remainingMs || 0;

    // Adjust startTime so (Date.now() - effectiveStartTime) === elapsedAtPause at resume moment
    const effectiveStartTime = resumeTime - (elapsedAtPause * 1000);

    const updatedSong = {
      ...room.currentSong,
      startTime: effectiveStartTime,
      pausedAt: null,
      elapsedAtPause: null,
      remainingMs: null
    };

    await Room.findByIdAndUpdate(roomId, { currentSong: updatedSong });

    // Re-arm the natural-end timer with remaining time
    if (remainingMs > 0) {
      const io = req.app.get('socketio');
      TimerManager.resumeTimer(roomId, remainingMs + 1000, () => {
        exports.playNextSong(roomId, io, 'natural_end');
      });
    }

    const io = req.app.get('socketio');
    Emitter.songResumed(io, roomId, { song: updatedSong, serverTime: resumeTime });

    return res.status(200).json({ message: 'Song resumed', effectiveStartTime });
  } catch (error) {
    console.error('Error resuming song:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// Get current song for a room
exports.getCurrentSong = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    return res.status(200).json({
      currentSong: room.currentSong,
      serverTime: Date.now()
    });
  } catch (error) {
    console.error('Error getting current song:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};
