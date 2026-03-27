const roomTimers = new Map();

module.exports = {
  clearAll(roomId) {
    const timers = roomTimers.get(roomId);
    if (!timers) return;
    if (timers.songDurationTimer) clearTimeout(timers.songDurationTimer);
    roomTimers.delete(roomId);
  },

  setSongDurationTimer(roomId, timer, delayMs) {
    const timers = roomTimers.get(roomId) || {};
    timers.songDurationTimer = timer;
    timers.scheduledAt = Date.now();
    timers.delayMs = delayMs;
    roomTimers.set(roomId, timers);
  },

  // Returns remaining milliseconds and clears the timer (for pause)
  pauseTimer(roomId) {
    const timers = roomTimers.get(roomId);
    if (!timers?.songDurationTimer) return 0;
    const elapsed = Date.now() - timers.scheduledAt;
    const remainingMs = Math.max(0, timers.delayMs - elapsed);
    clearTimeout(timers.songDurationTimer);
    roomTimers.delete(roomId);
    return remainingMs;
  },

  // Re-arms the timer with remaining time (for resume)
  resumeTimer(roomId, remainingMs, callback) {
    const timer = setTimeout(callback, remainingMs);
    this.setSongDurationTimer(roomId, timer, remainingMs);
  }
};
