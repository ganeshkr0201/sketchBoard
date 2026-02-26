const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId; // Password required only if not OAuth user
    }
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true // Allows null values while maintaining uniqueness
  },
  avatar: {
    type: String, // URL to profile picture
    default: null
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  themePreference: {
    type: String,
    enum: ['light', 'dark'],
    default: 'light'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });

module.exports = mongoose.model('User', userSchema);
