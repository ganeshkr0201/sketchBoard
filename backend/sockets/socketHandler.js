const Room = require('../models/Room');

// Track active screen shares per room
const activeScreenShares = new Map(); // roomId -> { userId, userName }

// Helper function to check if user has permission to draw
const checkDrawPermission = (room, userId) => {
  const userIdStr = String(userId);
  const hostIdStr = String(room.host);

  // Host always has permission
  if (userIdStr === hostIdStr) {
    return true;
  }

  // Check draw permission mode
  const drawPerms = room.permissions.draw || room.permissions; // Backward compatibility
  if (drawPerms.mode === 'public') {
    return true;
  }

  if (drawPerms.mode === 'host-only') {
    return false;
  }

  if (drawPerms.mode === 'custom') {
    return drawPerms.allowedUsers.some(
      allowedUserId => String(allowedUserId) === userIdStr
    );
  }

  return false;
};

// Helper function to check if user has permission to chat
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

const socketHandler = (io) => {
  const rooms = new Map(); // Map<roomId, Map<userId, Set<socketId>>>

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', async ({ roomId, userId, userName }) => {
      socket.join(roomId);
      
      // Convert userId to string for consistent comparison
      const userIdStr = String(userId);
      
      console.log('=== JOIN ROOM ===');
      console.log('User joining:', { roomId, userId: userIdStr, userName, socketId: socket.id });
      
      // Initialize room structure if it doesn't exist
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Map());
      }
      
      const roomUsers = rooms.get(roomId);
      
      // Track multiple sockets for the same user
      if (!roomUsers.has(userIdStr)) {
        roomUsers.set(userIdStr, { userName, sockets: new Set() });
        console.log('New user added to room');
      } else {
        console.log('Existing user, adding new socket');
      }
      roomUsers.get(userIdStr).sockets.add(socket.id);

      console.log('Current room state:');
      roomUsers.forEach((data, uid) => {
        console.log(`  User ${uid} (${data.userName}): ${data.sockets.size} socket(s)`);
      });

      // Get unique users (not socket count)
      const users = Array.from(roomUsers.entries()).map(([uid, data]) => ({
        userId: uid,
        userName: data.userName,
        socketCount: data.sockets.size
      }));

      console.log('Emitting users:', users);
      console.log('=================\n');

      io.to(roomId).emit('update-users', users);
      
      // Only emit user-joined if this is the first socket for this user
      if (roomUsers.get(userIdStr).sockets.size === 1) {
        socket.to(roomId).emit('user-joined', { userId: userIdStr, userName });
      }

      const room = await Room.findOne({ roomId });
      if (room) {
        room.lastActivity = new Date();
        await room.save();
        socket.emit('canvas-state', room.canvasData);
        socket.emit('chat-history', room.chatHistory);
        
        // Check if someone is sharing screen in this room
        const screenSharing = activeScreenShares.get(roomId);
        
        socket.emit('room-info', { 
          roomName: room.roomName,
          host: room.host,
          isPrivate: room.isPrivate,
          permissions: room.permissions,
          screenSharing: screenSharing || null
        });
        
        // If user is host, send waiting room list
        if (String(room.host) === userIdStr) {
          socket.emit('waiting-room-update', room.waitingRoom);
        }
      }
    });

    socket.on('request-join', async ({ roomId, userId, userName }) => {
      console.log('=== JOIN REQUEST ===');
      console.log('User requesting to join:', { roomId, userId, userName });
      
      try {
        const room = await Room.findOne({ roomId });
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Check if already in waiting room
        const alreadyWaiting = room.waitingRoom.some(
          w => String(w.userId) === String(userId)
        );

        if (!alreadyWaiting) {
          room.waitingRoom.push({
            userId,
            userName,
            requestedAt: new Date()
          });
          await room.save();
          console.log(`User ${userName} added to waiting room`);
        }

        // Notify host
        const roomUsers = rooms.get(roomId);
        if (roomUsers && roomUsers.has(String(room.host))) {
          const hostData = roomUsers.get(String(room.host));
          hostData.sockets.forEach(socketId => {
            io.to(socketId).emit('waiting-room-update', room.waitingRoom);
            io.to(socketId).emit('join-request', {
              userId,
              userName,
              message: `${userName} wants to join the room`
            });
          });
        }

        socket.emit('waiting-for-approval', {
          message: 'Waiting for host approval...',
          roomName: room.roomName
        });
        
        console.log('===========================\n');
      } catch (error) {
        console.error('Error handling join request:', error);
        socket.emit('error', { message: 'Failed to process join request' });
      }
    });

    socket.on('approve-join', async ({ roomId, userId, userName }) => {
      console.log('=== APPROVE JOIN ===');
      console.log('Approving user:', { roomId, userId, userName });
      
      try {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        // Remove from waiting room
        room.waitingRoom = room.waitingRoom.filter(
          w => String(w.userId) !== String(userId)
        );
        
        // Add to participants
        if (!room.participants.includes(userId)) {
          room.participants.push(userId);
        }
        
        await room.save();

        // Notify the approved user
        io.emit('join-approved', { roomId, userId });

        // Update waiting room for host
        const roomUsers = rooms.get(roomId);
        if (roomUsers && roomUsers.has(String(room.host))) {
          const hostData = roomUsers.get(String(room.host));
          hostData.sockets.forEach(socketId => {
            io.to(socketId).emit('waiting-room-update', room.waitingRoom);
          });
        }

        console.log(`User ${userName} approved to join room ${roomId}`);
        console.log('===========================\n');
      } catch (error) {
        console.error('Error approving join:', error);
      }
    });

    socket.on('reject-join', async ({ roomId, userId, userName }) => {
      console.log('=== REJECT JOIN ===');
      console.log('Rejecting user:', { roomId, userId, userName });
      
      try {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        // Remove from waiting room
        room.waitingRoom = room.waitingRoom.filter(
          w => String(w.userId) !== String(userId)
        );
        await room.save();

        // Notify the rejected user
        io.emit('join-rejected', { 
          roomId, 
          userId,
          message: 'Your request to join was denied by the host'
        });

        // Update waiting room for host
        const roomUsers = rooms.get(roomId);
        if (roomUsers && roomUsers.has(String(room.host))) {
          const hostData = roomUsers.get(String(room.host));
          hostData.sockets.forEach(socketId => {
            io.to(socketId).emit('waiting-room-update', room.waitingRoom);
          });
        }

        console.log(`User ${userName} rejected from room ${roomId}`);
        console.log('===========================\n');
      } catch (error) {
        console.error('Error rejecting join:', error);
      }
    });

    socket.on('draw', async ({ roomId, drawData }) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        // Check if user has permission to draw
        const userId = drawData.userId;
        const hasPermission = checkDrawPermission(room, userId);

        if (!hasPermission) {
          socket.emit('permission-denied', { message: 'You do not have permission to draw' });
          return;
        }

        // Broadcast to other users in the room
        socket.to(roomId).emit('draw', drawData);
        
        // Save to database
        room.canvasData.push(drawData);
        await room.save();
      } catch (error) {
        console.error('Error saving draw data:', error);
      }
    });

    socket.on('erase', async ({ roomId, eraseData }) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        // Check if user has permission to erase
        const userId = eraseData.userId;
        const hasPermission = checkDrawPermission(room, userId);

        if (!hasPermission) {
          socket.emit('permission-denied', { message: 'You do not have permission to erase' });
          return;
        }

        // Broadcast to other users in the room
        socket.to(roomId).emit('erase', eraseData);
        
        // Save to database
        room.canvasData.push(eraseData);
        await room.save();
      } catch (error) {
        console.error('Error saving erase data:', error);
      }
    });

    socket.on('clear-board', async ({ roomId, userId }) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        // Check if user has permission to clear
        const hasPermission = checkDrawPermission(room, userId);

        if (!hasPermission) {
          socket.emit('permission-denied', { message: 'You do not have permission to clear the board' });
          return;
        }

        // Broadcast to all users in the room including sender
        io.to(roomId).emit('clear-board');
        
        // Clear canvas data in database
        room.canvasData = [];
        await room.save();
      } catch (error) {
        console.error('Error clearing canvas data:', error);
      }
    });

    socket.on('delete-canvas', async ({ roomId, userId }) => {
      console.log('=== DELETE CANVAS EVENT RECEIVED ===');
      console.log('Room ID:', roomId);
      console.log('User ID:', userId);
      
      try {
        const room = await Room.findOne({ roomId });
        if (!room) {
          console.log('Room not found:', roomId);
          return;
        }

        console.log('Room found. Host:', room.host);
        console.log('Requesting user:', userId);
        console.log('Host comparison:', String(room.host), '===', String(userId), '?', String(room.host) === String(userId));

        // Only host can delete canvas permanently
        if (String(room.host) !== String(userId)) {
          console.log('Permission denied - not the host');
          socket.emit('permission-denied', { message: 'Only the host can delete the canvas permanently' });
          return;
        }

        console.log('=== DELETE CANVAS AUTHORIZED ===');
        console.log('Room ID:', roomId);
        console.log('Host ID:', userId);
        console.log('Current canvas data length:', room.canvasData?.length || 0);

        // Broadcast to all users in the room including sender
        console.log('Broadcasting canvas-deleted event to room:', roomId);
        io.to(roomId).emit('canvas-deleted', {
          message: 'Canvas has been permanently deleted by the host'
        });
        
        // Permanently delete canvas data from database
        room.canvasData = [];
        room.lastActivity = new Date();
        await room.save();

        console.log('Canvas permanently deleted for room:', roomId);
        console.log('New canvas data length:', room.canvasData.length);
      } catch (error) {
        console.error('Error deleting canvas:', error);
        socket.emit('error', { message: 'Failed to delete canvas' });
      }
    });

    socket.on('undo', async ({ roomId, userId }) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        const hasPermission = checkDrawPermission(room, userId);

        if (!hasPermission) {
          socket.emit('permission-denied', { message: 'You do not have permission to undo' });
          return;
        }

        console.log('Undo event received on server for room:', roomId);
        io.to(roomId).emit('undo');
      } catch (error) {
        console.error('Error in undo:', error);
      }
    });

    socket.on('redo', async ({ roomId, userId }) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        const hasPermission = checkDrawPermission(room, userId);

        if (!hasPermission) {
          socket.emit('permission-denied', { message: 'You do not have permission to redo' });
          return;
        }

        console.log('Redo event received on server for room:', roomId);
        io.to(roomId).emit('redo');
      } catch (error) {
        console.error('Error in redo:', error);
      }
    });

    socket.on('send-message', async ({ roomId, userId, userName, message }) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        // Check if user has permission to chat
        const hasPermission = checkChatPermission(room, userId);

        if (!hasPermission) {
          socket.emit('permission-denied', { message: 'You do not have permission to send messages' });
          return;
        }

        const messageData = {
          userId,
          userName,
          message,
          messageType: 'text',
          timestamp: new Date()
        };

        io.to(roomId).emit('receive-message', messageData);

        room.chatHistory.push(messageData);
        await room.save();
      } catch (error) {
        console.error('Error sending message:', error);
      }
    });

    socket.on('file-shared', async ({ roomId, fileData, userName }) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        const fileMessage = {
          userId: fileData.uploadedBy,
          userName: userName,
          message: `Shared a file: ${fileData.originalName}`,
          messageType: 'file',
          fileData: fileData,
          timestamp: new Date()
        };

        // Broadcast file message to all users in the room
        io.to(roomId).emit('receive-message', fileMessage);
      } catch (error) {
        console.error('Error broadcasting file message:', error);
      }
    });

    socket.on('update-permissions', async ({ roomId, permissionType, mode, allowedUsers }) => {
      try {
        const room = await Room.findOne({ roomId });
        if (!room) return;

        // Update specific permission type
        if (permissionType === 'draw') {
          room.permissions.draw.mode = mode;
          room.permissions.draw.allowedUsers = mode === 'custom' ? allowedUsers : [];
        } else if (permissionType === 'chat') {
          room.permissions.chat.mode = mode;
          room.permissions.chat.allowedUsers = mode === 'custom' ? allowedUsers : [];
        }

        await room.save();

        // Broadcast permission update to all users in the room
        io.to(roomId).emit('permissions-updated', {
          permissions: room.permissions,
          host: room.host
        });
      } catch (error) {
        console.error('Error updating permissions:', error);
      }
    });

    socket.on('destroy-room', async ({ roomId, userId }) => {
      console.log('=== DESTROY ROOM REQUEST ===');
      console.log('Room ID:', roomId);
      console.log('User ID:', userId);
      
      try {
        const room = await Room.findOne({ roomId });
        if (!room) {
          console.log('Room not found');
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        console.log('Room found. Host:', room.host);
        console.log('Requesting user:', userId);

        // Only host can destroy the room
        if (String(room.host) !== String(userId)) {
          console.log('Permission denied - not the host');
          socket.emit('error', { message: 'Only the host can destroy this room' });
          return;
        }

        console.log('Permission granted - destroying room');

        // Mark room as inactive
        room.isActive = false;
        await room.save();

        console.log('Room marked as inactive');

        // Notify all users in the room that it's being destroyed
        io.to(roomId).emit('room-destroyed', { 
          message: 'This room has been closed by the host',
          roomId 
        });

        console.log('Room destroyed notification sent to all users');
        console.log('===========================\n');
      } catch (error) {
        console.error('Error destroying room:', error);
        socket.emit('error', { message: 'Failed to destroy room' });
      }
    });

    socket.on('kick-user', async ({ roomId, targetUserId, targetUserName }) => {
      console.log('=== KICK USER REQUEST ===');
      console.log('Room ID:', roomId);
      console.log('Target User ID:', targetUserId);
      console.log('Target User Name:', targetUserName);
      
      try {
        const room = await Room.findOne({ roomId });
        if (!room) {
          socket.emit('error', { message: 'Room not found' });
          return;
        }

        // Find the target user's socket(s)
        const roomUsers = rooms.get(roomId);
        if (roomUsers && roomUsers.has(String(targetUserId))) {
          const userData = roomUsers.get(String(targetUserId));
          
          console.log(`Found user ${targetUserName} with ${userData.sockets.size} socket(s)`);
          
          // Send kick notification to all sockets of the target user
          userData.sockets.forEach(socketId => {
            console.log(`Sending kick notification to socket ${socketId}`);
            io.to(socketId).emit('kicked', {
              message: `You have been removed from the room by the host`
            });
            
            // Force disconnect the socket from the room
            const targetSocket = io.sockets.sockets.get(socketId);
            if (targetSocket) {
              targetSocket.leave(roomId);
            }
          });

          // Remove user from room tracking
          roomUsers.delete(String(targetUserId));
          console.log(`User ${targetUserName} removed from room tracking`);

          // Update user list for remaining users
          const users = Array.from(roomUsers.entries()).map(([uid, data]) => ({
            userId: uid,
            userName: data.userName,
            socketCount: data.sockets.size
          }));

          console.log(`Broadcasting updated user list. Remaining users: ${users.length}`);
          io.to(roomId).emit('update-users', users);
          
          // Also notify remaining users that someone was kicked
          socket.to(roomId).emit('user-kicked', {
            userName: targetUserName,
            message: `${targetUserName} was removed from the room`
          });
          
          console.log(`User ${targetUserName} successfully kicked from room ${roomId}`);
          console.log('===========================\n');
        } else {
          console.log('User not found in room');
          socket.emit('error', { message: 'User not found in room' });
        }
      } catch (error) {
        console.error('Error kicking user:', error);
        socket.emit('error', { message: 'Failed to kick user' });
      }
    });

    socket.on('file-uploaded', ({ roomId, fileData }) => {
      io.to(roomId).emit('file-received', fileData);
    });

    socket.on('offer', ({ roomId, offer }) => {
      socket.to(roomId).emit('offer', { offer, from: socket.id });
    });

    socket.on('answer', ({ roomId, answer, to }) => {
      io.to(to).emit('answer', { answer, from: socket.id });
    });

    socket.on('ice-candidate', ({ roomId, candidate, to }) => {
      io.to(to).emit('ice-candidate', { candidate, from: socket.id });
    });

    socket.on('start-screen-share', ({ roomId }) => {
      socket.to(roomId).emit('start-screen-share', { from: socket.id });
    });

    socket.on('stop-screen-share', ({ roomId }) => {
      socket.to(roomId).emit('stop-screen-share', { from: socket.id });
    });

    socket.on('leave-room', ({ roomId, userId }) => {
      socket.leave(roomId);
      
      const userIdStr = String(userId);
      
      if (rooms.has(roomId)) {
        const roomUsers = rooms.get(roomId);
        
        if (roomUsers.has(userIdStr)) {
          const userData = roomUsers.get(userIdStr);
          userData.sockets.delete(socket.id);
          
          console.log('User leaving:', { roomId, userId: userIdStr, remainingSockets: userData.sockets.size });
          
          // Only remove user if they have no more active sockets
          if (userData.sockets.size === 0) {
            roomUsers.delete(userIdStr);
            socket.to(roomId).emit('user-left', { userId: userIdStr });
          }
          
          const users = Array.from(roomUsers.entries()).map(([uid, data]) => ({
            userId: uid,
            userName: data.userName,
            socketCount: data.sockets.size
          }));
          
          io.to(roomId).emit('update-users', users);
        }
      }
    });

    socket.on('start-screen-share', async ({ roomId, userId, userName }) => {
      try {
        console.log('User started screen sharing:', { roomId, userId, userName });
        
        const room = await Room.findOne({ roomId });
        if (!room) {
          console.log('Room not found for screen share');
          return;
        }

        // Check if user has draw permission
        const hasPermission = checkDrawPermission(room, userId);
        if (!hasPermission) {
          socket.emit('permission-denied', { 
            message: 'You need draw permission to share your screen' 
          });
          return;
        }

        // Store active screen share
        activeScreenShares.set(roomId, { userId, userName });
        console.log('Stored screen share for room:', roomId);

        // Notify all users in the room except the sender
        socket.to(roomId).emit('screen-share-started', {
          userId,
          userName
        });

        console.log('Screen share started notification sent');
      } catch (error) {
        console.error('Error starting screen share:', error);
      }
    });

    socket.on('stop-screen-share', async ({ roomId, userId }) => {
      try {
        console.log('User stopped screen sharing:', { roomId, userId });
        
        // Remove active screen share
        activeScreenShares.delete(roomId);
        console.log('Removed screen share for room:', roomId);
        
        // Notify all users in the room
        io.to(roomId).emit('screen-share-stopped', {
          userId
        });

        console.log('Screen share stopped notification sent');
      } catch (error) {
        console.error('Error stopping screen share:', error);
      }
    });

    socket.on('request-screen-share', ({ roomId, requesterId, targetUserId }) => {
      console.log('Screen share requested by:', requesterId, 'from:', targetUserId);
      // Send request to specific user or broadcast to room
      if (targetUserId) {
        // Find the target user's socket and send directly
        const targetSocket = Array.from(io.sockets.sockets.values())
          .find(s => s.userId === targetUserId && s.rooms.has(roomId));
        
        if (targetSocket) {
          targetSocket.emit('request-screen-share', {
            requesterId,
            targetUserId
          });
          console.log('Sent screen share request to specific user:', targetUserId);
        } else {
          console.log('Target user not found, broadcasting to room');
          socket.to(roomId).emit('request-screen-share', {
            requesterId,
            targetUserId
          });
        }
      } else {
        // Broadcast to the room so the sharer can respond
        socket.to(roomId).emit('request-screen-share', {
          requesterId
        });
      }
    });

    socket.on('screen-share-offer', ({ roomId, userId, userName, offer, targetUserId }) => {
      console.log('Screen share offer from:', userId, 'to:', targetUserId || 'all');
      
      // Send offer with userId so receiver knows who it's from
      socket.to(roomId).emit('screen-share-offer', {
        userId,
        userName,
        offer
      });
    });

    socket.on('screen-share-answer', ({ roomId, answer, userId, targetUserId }) => {
      console.log('Screen share answer from:', userId, 'to:', targetUserId);
      
      // Send answer back with userId
      socket.to(roomId).emit('screen-share-answer', {
        userId,
        answer,
        targetUserId
      });
    });

    socket.on('ice-candidate', ({ roomId, candidate, userId }) => {
      console.log('ICE candidate from:', userId, 'for room:', roomId);
      
      // Broadcast ICE candidate with userId
      socket.to(roomId).emit('ice-candidate', {
        userId,
        candidate
      });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      
      rooms.forEach((roomUsers, roomId) => {
        roomUsers.forEach((userData, userId) => {
          if (userData.sockets.has(socket.id)) {
            userData.sockets.delete(socket.id);
            
            console.log('Socket disconnected:', { roomId, userId, remainingSockets: userData.sockets.size });
            
            // Only remove user if they have no more active sockets
            if (userData.sockets.size === 0) {
              roomUsers.delete(userId);
              io.to(roomId).emit('user-left', { userId });
              
              // Check if this user was sharing screen
              const screenShare = activeScreenShares.get(roomId);
              if (screenShare && screenShare.userId === userId) {
                console.log('User who was sharing screen disconnected, stopping share');
                activeScreenShares.delete(roomId);
                io.to(roomId).emit('screen-share-stopped', { userId });
              }
            }
            
            const users = Array.from(roomUsers.entries()).map(([uid, data]) => ({
              userId: uid,
              userName: data.userName,
              socketCount: data.sockets.size
            }));
            
            io.to(roomId).emit('update-users', users);
          }
        });
      });
    });
  });
};

module.exports = socketHandler;
