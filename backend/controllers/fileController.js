const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Room = require('../models/Room');

// Cloud storage setup
let storage;
let cloudinary;

if (process.env.NODE_ENV === 'production' && process.env.CLOUDINARY_CLOUD_NAME) {
  // Use Cloudinary for production
  cloudinary = require('cloudinary').v2;
  const { CloudinaryStorage } = require('multer-storage-cloudinary');
  
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: 'sketchboard-files',
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'zip', 'rar', 'mp4', 'mp3', 'wav'],
      resource_type: 'auto',
    },
  });
  
  console.log('Using Cloudinary storage for file uploads');
} else {
  // Use local storage for development
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.log('Creating uploads directory:', uploadsDir);
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
      cb(null, uniqueName);
    }
  });
  
  console.log('Using local storage for file uploads');
}

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /\.(jpeg|jpg|png|gif|pdf|doc|docx|txt|zip|rar|mp4|mp3|wav)$/i;
    const allowedMimes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain', 'application/zip', 'application/x-rar-compressed',
      'video/mp4', 'audio/mpeg', 'audio/wav'
    ];
    
    const extname = allowedTypes.test(file.originalname);
    const mimetype = allowedMimes.includes(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed types: ${allowedTypes}`));
    }
  }
}).single('file');

// Helper function to check chat permission
const checkChatPermission = (room, userId) => {
  const userIdStr = String(userId);
  const hostIdStr = String(room.host);

  // Host always has permission
  if (userIdStr === hostIdStr) {
    return true;
  }

  // Check chat permission mode
  const chatPerms = room.permissions.chat;
  if (!chatPerms || chatPerms.mode === 'public') {
    return true;
  }

  if (chatPerms.mode === 'host-only') {
    return false;
  }

  if (chatPerms.mode === 'custom') {
    return chatPerms.allowedUsers.some(
      allowedUserId => String(allowedUserId) === userIdStr
    );
  }

  return false;
};

exports.uploadFile = async (req, res) => {
  console.log('=== FILE UPLOAD REQUEST ===');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Using cloud storage:', !!cloudinary);
  
  upload(req, res, async (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ 
        message: 'File upload error', 
        error: err.message,
        details: err.code || 'Unknown error'
      });
    }

    console.log('File received:', req.file);
    console.log('Request body:', req.body);

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
      const { roomId } = req.body;
      
      if (!roomId) {
        return res.status(400).json({ message: 'Room ID is required' });
      }
      
      console.log('Looking for room:', roomId);
      const room = await Room.findOne({ roomId });
      if (!room) {
        console.log('Room not found:', roomId);
        return res.status(404).json({ message: 'Room not found' });
      }

      console.log('Room found, checking permissions for user:', req.userId);
      // Check if user has chat permission
      const hasPermission = checkChatPermission(room, req.userId);
      if (!hasPermission) {
        console.log('Permission denied for user:', req.userId);
        // Delete uploaded file if no permission (only for local storage)
        if (!cloudinary && req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({ message: 'You do not have permission to share files in this room' });
      }

      console.log('Permission granted, processing file...');
      
      // Prepare file data based on storage type
      let fileData;
      if (cloudinary) {
        // Cloudinary storage
        fileData = {
          fileName: req.file.filename || req.file.public_id,
          originalName: req.file.originalname,
          filePath: req.file.path, // Cloudinary URL
          fileSize: req.file.bytes || req.file.size,
          mimeType: req.file.mimetype || req.file.format,
          uploadedBy: req.userId,
          cloudinaryId: req.file.public_id,
          isCloudStorage: true
        };
      } else {
        // Local storage
        fileData = {
          fileName: req.file.filename,
          originalName: req.file.originalname,
          filePath: req.file.path,
          fileSize: req.file.size,
          mimeType: req.file.mimetype,
          uploadedBy: req.userId,
          isCloudStorage: false
        };
      }

      // Add to files array
      room.files.push(fileData);
      
      // Add to chat history as file message
      const user = await require('../models/User').findById(req.userId);
      if (!user) {
        console.log('User not found:', req.userId);
        return res.status(404).json({ message: 'User not found' });
      }

      const chatMessage = {
        userId: req.userId,
        userName: user.name,
        message: `Shared a file: ${req.file.originalname}`,
        messageType: 'file',
        fileData: fileData,
        timestamp: new Date()
      };
      
      room.chatHistory.push(chatMessage);
      room.lastActivity = new Date();
      await room.save();

      console.log('File upload successful:', fileData.fileName);
      res.json({
        message: 'File uploaded successfully',
        file: {
          fileName: fileData.fileName,
          originalName: fileData.originalName,
          fileSize: fileData.fileSize,
          mimeType: fileData.mimeType,
          uploadedBy: user.name,
          uploadedAt: new Date(),
          isCloudStorage: fileData.isCloudStorage
        },
        chatMessage: chatMessage
      });
    } catch (error) {
      console.error('Server error during file upload:', error);
      // Clean up uploaded file on error (only for local storage)
      if (!cloudinary && req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ 
        message: 'Server error', 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });
};

exports.downloadFile = async (req, res) => {
  try {
    const { roomId, fileName } = req.params;
    
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check if user is participant in the room
    const isParticipant = room.participants.includes(req.userId) || String(room.host) === String(req.userId);
    if (!isParticipant) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Find file in room's files
    const fileRecord = room.files.find(f => f.fileName === fileName);
    if (!fileRecord) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (fileRecord.isCloudStorage && cloudinary) {
      // For Cloudinary files, redirect to the direct URL
      return res.redirect(fileRecord.filePath);
    } else {
      // For local files
      const filePath = path.resolve(fileRecord.filePath);
      
      // Check if file exists on disk
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'File not found on server' });
      }

      // Set appropriate headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${fileRecord.originalName}"`);
      res.setHeader('Content-Type', fileRecord.mimeType || 'application/octet-stream');
      
      // Stream the file
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
