const User = require('../../models/User');

// Award points for natural song completion
exports.awardNaturalEndPoints = async (previousSong) => {
  try {
    if (!previousSong || !previousSong.addedby) return;

    const user = await User.findOne({ nickname: previousSong.addedby });
    if (!user) {
      console.error(`[POINTS ERROR] User "${previousSong.addedby}" not found when awarding points`);
      return;
    }

    user.points = (user.points || 0) + 1;
    await user.save();
  } catch (error) {
    console.error(`[POINTS ERROR] Exception when awarding points to ${previousSong?.addedby}:`, error.message);
  }
};

// Deduct points for skipped song
exports.deductSkippedSongPoints = async (previousSong) => {
  try {
    if (!previousSong || !previousSong.addedby) return;

    const user = await User.findOne({ nickname: previousSong.addedby });
    if (!user) {
      console.error(`[POINTS ERROR] User "${previousSong.addedby}" not found when deducting points`);
      return;
    }

    user.points = Math.max(0, (user.points || 0) - 1);
    await user.save();
  } catch (error) {
    console.error(`[POINTS ERROR] Exception when deducting points from ${previousSong?.addedby}:`, error.message);
  }
};
