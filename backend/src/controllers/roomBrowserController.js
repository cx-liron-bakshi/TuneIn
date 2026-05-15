const Room = require('../models/Room');
const User = require('../models/User');
const axios = require('axios');
const FormData = require('form-data');

// Function to upload image to Imgur - reusing from registerController
async function uploadToImgur(imageBuffer) {
  try {
    const formData = new FormData();
    formData.append('image', imageBuffer.toString('base64'));
    
    const response = await axios.post('https://api.imgur.com/3/image', formData, {
      headers: {
        Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`,
        ...formData.getHeaders()
      }
    });
    
    if (response.data.success) {
      return response.data.data.link;
    } else {
      throw new Error('Failed to upload image to Imgur');
    }
  } catch (error) {
    console.error('Imgur upload error:', error?.response?.data || error.message);
    throw new Error('Failed to upload image to Imgur');
  }
}

// Create a new room
exports.createRoom = async (req, res) => {
  try {
    const { name, isHidden } = req.body;
    const genres = req.body.genres || [];
    const creatorId = req.user.userId; // From auth middleware

    // Validate required fields
    if (!name) {
      return res.status(400).json({ message: 'Room name is required' });
    }
    
    // Validate genres (if provided)
    if (genres.length > 5) {
      return res.status(400).json({ message: 'Maximum 5 genres allowed' });
    }
    
    // Check if user exists
    const user = await User.findById(creatorId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Handle room image upload
    if (!req.file) {
      return res.status(400).json({ message: 'Room image is required' });
    }
    
    // Upload image to Imgur
    let imageUrl;
    try {
      imageUrl = await uploadToImgur(req.file.buffer);
    } catch (imgurError) {
      return res.status(500).json({ message: 'Failed to upload room image' });
    }
    
    // Create and save new room
    const newRoom = new Room({
      name,
      genres,
      image: imageUrl,
      creator: creatorId,
      isHidden: isHidden === 'true' || isHidden === true
    });
    
    await newRoom.save();
    
    // Populate creator details to return
    const populatedRoom = await Room.findById(newRoom._id)
      .populate('creator', 'nickname profilePic');
    
    res.status(201).json(populatedRoom);
  } catch (err) {
    console.error('Room creation error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all rooms (non-hidden only for public, all for creator)
exports.getRooms = async (req, res) => {
  try {
    const userId = req.user?.userId; // If authenticated
    
    let query = { isHidden: false }; // Default: only non-hidden rooms
    
    // If authenticated, include user's hidden rooms
    if (userId) {
      query = { 
        $or: [
          { isHidden: false },
          { creator: userId, isHidden: true } // Include user's own hidden rooms
        ]
      };
    }
    
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [rooms, total] = await Promise.all([
      Room.find(query)
        .populate('creator', 'nickname profilePic')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Room.countDocuments(query)
    ]);

    res.json({
      rooms,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Room fetch error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getRoomById = async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId)
      .populate('creator', 'nickname profilePic');
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};