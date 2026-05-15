// src/controllers/authControllers/googleAuthController.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Temporary store for one-time auth codes (code -> { token, userId, expiresAt })
const authCodes = new Map();

// Clean up expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of authCodes) {
    if (now > data.expiresAt) authCodes.delete(code);
  }
}, 5 * 60 * 1000);

const googleCallback = (req, res) => {
  try {
    if (!req.user) {
      throw new Error('User authentication failed via Google');
    }

    const payload = { userId: req.user._id, email: req.user.email };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Generate a one-time code instead of sending token in URL
    const code = crypto.randomBytes(32).toString('hex');
    authCodes.set(code, {
      token,
      userId: req.user._id.toString(),
      expiresAt: Date.now() + 60 * 1000 // expires in 60 seconds
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = new URL(`${frontendUrl}/auth/callback`);
    redirectUrl.searchParams.set('code', code);

    res.redirect(redirectUrl.toString());

  } catch (err) {
    console.error('Error in Google Auth Controller:', err);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth?error=true`);
  }
};

// Exchange one-time code for token
const exchangeCode = (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Code is required' });
  }

  const data = authCodes.get(code);
  if (!data) {
    return res.status(401).json({ error: 'Invalid or expired code' });
  }

  // Delete code immediately (one-time use)
  authCodes.delete(code);

  if (Date.now() > data.expiresAt) {
    return res.status(401).json({ error: 'Code has expired' });
  }

  res.json({ token: data.token, userId: data.userId });
};

module.exports = {
  googleCallback,
  exchangeCode
};
