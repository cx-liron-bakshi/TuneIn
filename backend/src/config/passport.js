// src/config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const { downloadAndUploadToImgur } = require('../utils/imgurUploader');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.OAUTH_CLIENT_ID,
      clientSecret: process.env.OAUTH_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 1. חפש לפי googleId (התחברות חוזרת)
        let user = await User.findOne({ googleId: profile.id });
        if (user) return done(null, user);

        // Get Google profile picture URL and upload to Imgur
        let imgurProfilePicUrl = '/default-profile.png';
        if (profile.photos && profile.photos[0] && profile.photos[0].value) {
          try {
            // Download Google profile picture and upload to Imgur
            imgurProfilePicUrl = await downloadAndUploadToImgur(profile.photos[0].value);
          } catch (imgurError) {
            console.error('Failed to upload Google profile picture to Imgur:', imgurError.message);
            // Continue with default picture if Imgur upload fails
          }
        }

        // 2. חפש לפי אימייל (קישור חשבון בפעם ראשונה)
        user = await User.findOne({ email: profile.emails[0].value });
        if (user) { 
          user.googleId = profile.id;
          // Only update profile pic if we successfully uploaded to Imgur and user doesn't have one
          if (imgurProfilePicUrl !== '/default-profile.png' && 
              (!user.profilePic || user.profilePic === '/default-profile.png')) {
            user.profilePic = imgurProfilePicUrl;
          }
          await user.save();
          return done(null, user);
        }

        // 3. משתמש חדש
        const newUser = new User({
          googleId: profile.id,
          email: profile.emails[0].value,
          nickname: profile.displayName || profile.emails[0].value.split('@')[0],
          profilePic: imgurProfilePicUrl,
        });
        await newUser.save();
        return done(null, newUser);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
