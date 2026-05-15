const axios = require('axios');
const Room = require('../../models/Room');
const User = require('../../models/User');
const CurrentSongController = require('./CurrentSongController');

exports.addSongToQueue = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { song } = req.body;

    if (!song || !song.title || !song.id || !song.addedby) {
      return res.status(400).json({ error: 'Invalid song data' });
    }

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    room.songqueue.push(song);
    await room.save();

    const io = req.app.get('socketio');

    io.to(`room-${roomId}`).emit('queueUpdated', { queue: room.songqueue });

    // If no song is currently playing, start playing this one
    if (!room.currentSong && room.songqueue.length === 1 && !CurrentSongController.isCountdownActive(roomId)) {
      // Play the first song
      await CurrentSongController.playNextSong(roomId, io, "initialSongAdded");
    }

    return res.status(200).json({ message: 'Song added to queue successfully' });
  } catch (err) {
    console.error('Error adding song to queue:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.importPlaylistToQueue = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { playlistUrl, limit } = req.body;

    // 1. Validate and parse playlist ID from URL
    if (!playlistUrl || typeof playlistUrl !== 'string') {
      return res.status(400).json({ error: 'Playlist URL is required' });
    }

    let listId;
    try {
      const parsed = new URL(playlistUrl);
      const allowedHosts = ['www.youtube.com', 'youtube.com', 'music.youtube.com', 'm.youtube.com'];
      if (!allowedHosts.includes(parsed.hostname)) {
        return res.status(400).json({ error: 'Only YouTube URLs are allowed' });
      }
      listId = parsed.searchParams.get('list');
      if (!listId) {
        const videoId = parsed.searchParams.get('v');
        if (videoId) listId = `RD${videoId}`;
      }
    } catch (_) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    if (!listId) return res.status(400).json({ error: 'No playlist found in URL' });

    const apiKey = process.env.YOUTUBE_API_KEY;
    const maxResults = (limit && Number.isInteger(limit) && limit > 0 && limit <= 50) ? limit : 50;

    // 2. Fetch playlist items up to maxResults
    const itemsRes = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
      params: { part: 'snippet', playlistId: listId, maxResults, key: apiKey }
    });
    const items = itemsRes.data.items || [];
    if (!items.length) return res.status(400).json({ error: 'Playlist is empty or private' });

    // 3. Batch-fetch durations (one videos.list call for all IDs)
    const videoIds = items.map(i => i.snippet.resourceId.videoId).join(',');
    const detailsRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { part: 'contentDetails', id: videoIds, key: apiKey }
    });
    const durationMap = {};
    for (const v of detailsRes.data.items) {
      const m = v.contentDetails.duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
      const h = parseInt(m[1]) || 0, min = parseInt(m[2]) || 0, s = parseInt(m[3]) || 0;
      durationMap[v.id] = h * 3600 + min * 60 + s;
    }

    // 4. Get username from auth token (req.user populated by auth middleware)
    const user = await User.findById(req.user.userId).select('nickname');
    const username = user?.nickname || 'Unknown';

    // 5. Format songs — skip unavailable videos (no duration entry)
    const songs = items
      .filter(i => durationMap[i.snippet.resourceId.videoId])
      .map(i => ({
        title: i.snippet.title,
        artist: i.snippet.videoOwnerChannelTitle || '',
        thumbnail: i.snippet.thumbnails?.default?.url || '',
        id: i.snippet.resourceId.videoId,
        addedby: username,
        duration: durationMap[i.snippet.resourceId.videoId]
      }));

    if (!songs.length) return res.status(400).json({ error: 'No playable songs found in playlist' });

    // 6. Bulk push + save
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    room.songqueue.push(...songs);
    await room.save();

    // 7. Emit single queueUpdated
    const io = req.app.get('socketio');
    io.to(`room-${roomId}`).emit('queueUpdated', { queue: room.songqueue });

    // 8. Start playback if nothing playing
    if (!room.currentSong && !CurrentSongController.isCountdownActive(roomId)) {
      await CurrentSongController.playNextSong(roomId, io, 'initialSongAdded');
    }

    return res.status(200).json({ message: `${songs.length} songs added to queue`, count: songs.length });
  } catch (err) {
    console.error('Error importing playlist:', err);
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.getRoomQueue = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findById(roomId).select('songqueue');

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.status(200).json({
      queue: room.songqueue,
      queueLength: room.songqueue.length
    });

  } catch (err) {
    console.error('Get room queue error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.removeSongFromQueue = async (req, res) => {
  try {
    const { roomId, songIndex } = req.params;

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (songIndex < 0 || songIndex >= room.songqueue.length) {
      return res.status(400).json({ message: 'Invalid song index' });
    }

    const removedSong = room.songqueue.splice(songIndex, 1)[0];
    await room.save();

    const io = req.app.get('socketio');
    if (io) {
      io.to(`room-${roomId}`).emit('queueUpdated', {
        queue: room.songqueue,
        queueLength: room.songqueue.length,
        action: 'songRemoved',
        removedSong: removedSong,
        removedIndex: songIndex
      });
    }

    res.status(200).json({
      message: 'Song removed from queue',
      removedSong: removedSong,
      queueLength: room.songqueue.length
    });

  } catch (err) {
    console.error('Remove song from queue error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};