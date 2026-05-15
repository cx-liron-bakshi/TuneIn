const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const passport = require('passport');
const registerController = require('../controllers/authControllers/registerController');
const loginController = require('../controllers/authControllers/loginController');
const googleAuthController = require('../controllers/authControllers/googleAuthController');

// Temporary memory storage for multer
// We'll only use this to parse the multipart form data, not for storing
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Registration route (with profile pic upload)
router.post('/register', upload.single('profilePic'), registerController.register);

// Login route
router.post('/login', loginController.login);

// --- Google OAuth Routes ---

// 1. התחלת התהליך (מפנה לגוגל)
router.get('/google', passport.authenticate('google', { 
  scope: ['profile', 'email'],
  prompt: 'select_account'  // תמיד הצג מסך בחירת חשבון
}));

// 2. נתיב Callback (גוגל מחזיר לכאן)
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth?error=google_failed`,
    session: true
  }),
  googleAuthController.googleCallback
);

// 2.5. Exchange one-time code for token (used by frontend after OAuth redirect)
router.post('/google/exchange', googleAuthController.exchangeCode);

// 3. Logout route (מנקה את ה-session)
router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ message: 'Logout failed' });
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destroy error:', err);
        return res.status(500).json({ message: 'Failed to destroy session' });
      }
      res.clearCookie('connect.sid'); // Clear the session cookie
      res.status(200).json({ message: 'Logged out successfully' });
    });
  });
});

module.exports = router;