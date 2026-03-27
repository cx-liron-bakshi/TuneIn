module.exports = {
  emit(io, roomId, event, data) {
    io.to(`room-${roomId}`).emit(event, data);
  },

  currentSongUpdated(io, roomId, song, serverTime) {
    this.emit(io, roomId, 'currentSongUpdated', { currentSong: song, serverTime });
  },

  queueUpdated(io, roomId, queue, source) {
    this.emit(io, roomId, 'queueUpdated', { queue, source });
  },

  countdownStarted(io, roomId, countdown, nextSong, source) {
    this.emit(io, roomId, 'nextSongCountdown', { countdown, nextSong, source });
  },

  skipVoteUpdate(io, roomId, data) {
    this.emit(io, roomId, 'skipVoteUpdate', { ...data, reason: 'new_song_started' });
  },

  songPaused(io, roomId, data) {
    this.emit(io, roomId, 'songPaused', data);
  },

  songResumed(io, roomId, data) {
    this.emit(io, roomId, 'songResumed', data);
  }
};
