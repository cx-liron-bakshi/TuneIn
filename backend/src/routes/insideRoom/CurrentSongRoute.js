const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const CurrentSongController = require('../../controllers/insideRoomControllers/CurrentSongController');

// Get current song for a room
router.get('/:roomId', auth, CurrentSongController.getCurrentSong);

// Skip current song
router.post('/:roomId/skip', auth, CurrentSongController.skipSong);

// Pause / resume current song (creator only)
router.post('/:roomId/pause', auth, CurrentSongController.pauseSong);
router.post('/:roomId/resume', auth, CurrentSongController.resumeSong);

module.exports = router;