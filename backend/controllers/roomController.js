const Room = require('../models/Room');
const { v4: uuidv4 } = require('uuid');

exports.createRoom = async (req, res) => {
  try {
    const { roomName, isPrivate } = req.body;
    const roomId = uuidv4().substring(0, 8);
    
    const room = new Room({
      roomId,
      roomName: roomName || 'Untitled Room',
      isPrivate: isPrivate || false,
      host: req.userId,
      participants: [req.userId],
      permissions: {
        mode: isPrivate ? 'host-only' : 'public',
        allowedUsers: []
      }
    });

    await room.save();

    res.status(201).json({
      roomId: room.roomId,
      roomName: room.roomName,
      isPrivate: room.isPrivate,
      host: room.host
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.joinRoom = async (req, res) => {
  try {
    const { roomId } = req.body;

    const room = await Room.findOne({ roomId, isActive: true });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check if room is private
    if (room.isPrivate && String(room.host) !== String(req.userId)) {
      // Check if user is already in waiting room
      const alreadyWaiting = room.waitingRoom.some(
        w => String(w.userId) === String(req.userId)
      );

      if (!alreadyWaiting) {
        return res.status(403).json({ 
          message: 'This is a private room. Waiting for host approval.',
          requiresApproval: true,
          roomId: room.roomId,
          roomName: room.roomName
        });
      } else {
        return res.status(403).json({ 
          message: 'You are in the waiting room. Please wait for host approval.',
          requiresApproval: true,
          roomId: room.roomId,
          roomName: room.roomName
        });
      }
    }

    if (!room.participants.includes(req.userId)) {
      room.participants.push(req.userId);
      room.lastActivity = new Date();
      await room.save();
    }

    res.json({
      roomId: room.roomId,
      roomName: room.roomName,
      isPrivate: room.isPrivate,
      host: room.host,
      canvasData: room.canvasData,
      chatHistory: room.chatHistory
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findOne({ roomId })
      .populate('host', 'name email')
      .populate('participants', 'name email');

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json(room);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.saveCanvas = async (req, res) => {
  try {
    const { roomId, canvasData } = req.body;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    room.canvasData = canvasData;
    await room.save();

    res.json({ message: 'Canvas saved successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getUserRooms = async (req, res) => {
  try {
    const rooms = await Room.find({
      participants: req.userId,
      isActive: true
    })
    .sort({ lastActivity: -1 })
    .limit(10)
    .select('roomId roomName host participants lastActivity createdAt')
    .populate('host', 'name');

    const roomsWithDetails = rooms.map(room => ({
      roomId: room.roomId,
      roomName: room.roomName,
      host: room.host.name,
      isHost: String(room.host._id) === String(req.userId),
      participants: room.participants.length,
      lastActivity: room.lastActivity,
      createdAt: room.createdAt
    }));

    res.json(roomsWithDetails);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


exports.updatePermissions = async (req, res) => {
  try {
    const { roomId, permissionType, mode, allowedUsers } = req.body;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Only host can change permissions
    if (String(room.host) !== String(req.userId)) {
      return res.status(403).json({ message: 'Only the host can change permissions' });
    }

    // Update specific permission type (draw or chat)
    if (permissionType === 'draw') {
      room.permissions.draw.mode = mode;
      room.permissions.draw.allowedUsers = mode === 'custom' ? allowedUsers : [];
    } else if (permissionType === 'chat') {
      room.permissions.chat.mode = mode;
      room.permissions.chat.allowedUsers = mode === 'custom' ? allowedUsers : [];
    } else {
      return res.status(400).json({ message: 'Invalid permission type' });
    }

    await room.save();

    res.json({
      message: 'Permissions updated successfully',
      permissions: room.permissions
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.getPermissions = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findOne({ roomId })
      .select('permissions host')
      .populate('permissions.allowedUsers', 'name email');

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    res.json({
      permissions: room.permissions,
      host: room.host,
      isHost: String(room.host) === String(req.userId)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


exports.deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Only host can delete the room
    if (String(room.host) !== String(req.userId)) {
      return res.status(403).json({ message: 'Only the host can delete this room' });
    }

    // Mark room as inactive instead of deleting (for history)
    room.isActive = false;
    await room.save();

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};
