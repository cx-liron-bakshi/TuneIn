const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const { uploadToImgur } = require('../../utils/imgurUploader');

function parseGenres(genresStr) {
  return genresStr
    ? genresStr.split(',').map(g => g.replace('#', '').trim()).filter(Boolean)
    : [];
}

exports.register = async (req, res) => {
  try {
    const { email, nickname, password, retypePassword, genres } = req.body;

    // Validate required fields
    if (!email || !nickname || !password || !retypePassword) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    if (password !== retypePassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    // Check uniqueness
    if (await User.findOne({ email })) {
      return res.status(400).json({ message: 'Email already in use.' });
    }
    if (await User.findOne({ nickname })) {
      return res.status(400).json({ message: 'Nickname already in use.' });
    }

    // Check if file exists
    if (!req.file) {
      return res.status(400).json({ message: 'Profile picture is required.' });
    }

    // Upload profile picture to Imgur
    let profilePicUrl;
    try {
      profilePicUrl = await uploadToImgur(req.file.buffer);
    } catch (imgurError) {
      return res.status(500).json({ message: 'Failed to upload profile picture.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      email,
      nickname,
      password: hashedPassword,
      genres: parseGenres(genres),
      profilePic: profilePicUrl  // Store the Imgur URL instead of local path
    });

    await user.save();
    res.status(201).json({ message: 'User registered successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error.' });
  }
};