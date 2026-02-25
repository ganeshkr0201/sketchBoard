const mongoose = require('mongoose');

const canvasStrokeSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['draw', 'erase'],
    required: true
  },
  points: [{
    x: Number,
    y: Number
  }],
  color: String,
  brushSize: Number,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const roomSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  roomName: {
    type: String,
    required: true,
    default: 'Untitled Room'
  },
  isPrivate: {
    type: Boolean,
    default: false
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  waitingRoom: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    userName: String,
    requestedAt: {
      type: Date,
      default: Date.now
    }
  }],
  permissions: {
    draw: {
      mode: {
        type: String,
        enum: ['host-only', 'public', 'custom'],
        default: 'public'
      },
      allowedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }]
    },
    chat: {
      mode: {
        type: String,
        enum: ['host-only', 'public', 'custom'],
        default: 'public'
      },
      allowedUsers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }]
    }
  },
  canvasData: [canvasStrokeSchema],
  chatHistory: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    userName: String,
    message: String,
    messageType: {
      type: String,
      enum: ['text', 'file'],
      default: 'text'
    },
    fileData: {
      fileName: String,
      originalName: String,
      filePath: String,
      fileSize: Number,
      mimeType: String,
      cloudinaryId: String,
      isCloudStorage: {
        type: Boolean,
        default: false
      }
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  files: [{
    fileName: String,
    originalName: String,
    filePath: String,
    fileSize: Number,
    mimeType: String,
    cloudinaryId: String,
    isCloudStorage: {
      type: Boolean,
      default: false
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Room', roomSchema);
