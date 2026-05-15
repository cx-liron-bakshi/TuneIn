const Room = require('../../models/Room');
const xss = require('xss');

// Send message to room chat
exports.sendMessage = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { message, videoTimestamp, userPicture, nickname } = req.body;
    const userId = req.user.userId;

    // Validate message
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (message.length > 50) {
      return res.status(400).json({ error: 'Message too long (max 50 characters)' });
    }

    // Verify room exists and user has access
    const room = await Room.findById(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Create message object
    const chatMessage = {
      id: `${Date.now()}-${userId}`,
      userId,
      userName: nickname || req.user.username,
      userPicture: userPicture || null,
      message: xss(message.trim()),
      timestamp: Date.now(),
      videoTimestamp: videoTimestamp || null
    };

    // Get socketio instance and emit to room
    const io = req.app.get('socketio');
    io.to(`room-${roomId}`).emit('newChatMessage', chatMessage);

    return res.status(200).json({ 
      success: true,
      message: 'Message sent successfully',
      chatMessage 
    });

  } catch (error) {
    console.error('Error sending chat message:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};