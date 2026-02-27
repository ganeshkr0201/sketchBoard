import { useEffect, useState, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SocketContext } from '../context/SocketContext';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import Canvas from '../components/Canvas';
import './WhiteboardRoom.css';
import './WhiteboardRoom.mobile.css';

const WhiteboardRoom = () => {
  const { roomId } = useParams();
  const { socket } = useContext(SocketContext);
  const { user } = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const navigate = useNavigate();
  
  const [users, setUsers] = useState([]);
  const [tool, setTool] = useState('pencil');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(2);
  const [pencilSize, setPencilSize] = useState(2);
  const [eraserSize, setEraserSize] = useState(20);
  const [activeTab, setActiveTab] = useState('chat');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [roomName, setRoomName] = useState('');
  const [hostId, setHostId] = useState(null);
  const [permissions, setPermissions] = useState({ 
    draw: { mode: 'public', allowedUsers: [] },
    chat: { mode: 'public', allowedUsers: [] }
  });
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionTab, setPermissionTab] = useState('draw');
  const [showDestroyModal, setShowDestroyModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(null);
  const [showWaitingRoom, setShowWaitingRoom] = useState(false);
  const [waitingUsers, setWaitingUsers] = useState([]);
  const [canDraw, setCanDraw] = useState(true);
  const [canChat, setCanChat] = useState(true);
  const [showToolbarMenu, setShowToolbarMenu] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [activeScreenShare, setActiveScreenShare] = useState(null); // { userId, userName, stream }
  const [remoteStream, setRemoteStream] = useState(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const snapshotFunctionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const hasJoinedRef = useRef(false);
  const fileInputRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const screenStreamRef = useRef(null); // Add ref to maintain screen stream

  // Get current brush size based on active tool
  const getCurrentBrushSize = () => {
    return tool === 'eraser' ? eraserSize : pencilSize;
  };

  // Update brush size based on current tool
  const updateBrushSize = (newSize) => {
    setBrushSize(newSize);
    if (tool === 'eraser') {
      setEraserSize(newSize);
    } else {
      setPencilSize(newSize);
    }
  };

  // Update brushSize when tool changes
  useEffect(() => {
    setBrushSize(getCurrentBrushSize());
  }, [tool, pencilSize, eraserSize]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showToolbarMenu && !event.target.closest('.header-menu-container')) {
        setShowToolbarMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showToolbarMenu]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isFullscreen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle remote stream video playback
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log('Setting remote stream to video element');
      console.log('Remote stream tracks:', remoteStream.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        readyState: t.readyState,
        muted: t.muted,
        label: t.label
      })));
      
      const video = remoteVideoRef.current;
      
      // Clear any existing stream first
      video.srcObject = null;
      
      // Set new stream
      video.srcObject = remoteStream;
      
      // Force video properties for screen sharing
      video.muted = false; // Allow audio from screen share
      video.playsInline = true;
      video.autoplay = true;
      
      // Add event listeners for debugging
      const handleLoadedMetadata = () => {
        console.log('Remote video metadata loaded:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          duration: video.duration,
          readyState: video.readyState
        });
        
        // Force play after metadata is loaded
        video.play().catch(err => {
          console.error('Error playing remote video after metadata:', err);
        });
      };
      
      const handleCanPlay = () => {
        console.log('Remote video can play');
        video.play().catch(err => {
          console.error('Error playing remote video on canplay:', err);
        });
      };
      
      const handlePlay = () => {
        console.log('Remote video started playing');
      };
      
      const handleError = (e) => {
        console.error('Remote video error:', e);
        console.error('Video error details:', {
          error: video.error,
          networkState: video.networkState,
          readyState: video.readyState
        });
      };
      
      const handleLoadStart = () => {
        console.log('Remote video load started');
      };
      
      const handleWaiting = () => {
        console.log('Remote video waiting for data');
      };
      
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('play', handlePlay);
      video.addEventListener('error', handleError);
      video.addEventListener('loadstart', handleLoadStart);
      video.addEventListener('waiting', handleWaiting);
      
      // Try to play immediately
      setTimeout(() => {
        if (video.readyState >= 2) { // HAVE_CURRENT_DATA
          video.play().catch(err => {
            console.error('Error playing remote video immediately:', err);
          });
        }
      }, 100);
      
      // Cleanup
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('error', handleError);
        video.removeEventListener('loadstart', handleLoadStart);
        video.removeEventListener('waiting', handleWaiting);
      };
    } else if (!remoteStream && remoteVideoRef.current) {
      console.log('Clearing remote video stream');
      remoteVideoRef.current.srcObject = null;
    }
  }, [remoteStream]);

  // Debug state changes
  useEffect(() => {
    console.log('Screen share state:', {
      isScreenSharing,
      hasActiveScreenShare: !!activeScreenShare,
      hasRemoteStream: !!remoteStream,
      shouldShowCanvas: !isScreenSharing && !activeScreenShare
    });
  }, [isScreenSharing, activeScreenShare, remoteStream]);

  useEffect(() => {
    if (!socket || !user) return;
    
    const userId = String(user._id || user.id);
    console.log('Full user object:', user);
    console.log('Joining room with userId:', userId, 'userName:', user.name);
    
    // Join room only once
    socket.emit('join-room', {
      roomId,
      userId: userId,
      userName: user.name
    });

    const handleUpdateUsers = (updatedUsers) => {
      console.log('Received updated users:', updatedUsers);
      setUsers(updatedUsers);
    };

    const handleChatHistory = (history) => {
      setMessages(history);
    };

    const handleReceiveMessage = (message) => {
      setMessages(prev => [...prev, message]);
    };

    const handleRoomInfo = (info) => {
      setRoomName(info.roomName);
      if (info.host) {
        setHostId(info.host);
      }
      if (info.permissions) {
        setPermissions(info.permissions);
        updateCanDraw(info.permissions, info.host, userId);
        updateCanChat(info.permissions, info.host, userId);
      }
      
      // Check if someone is already sharing screen
      if (info.screenSharing) {
        console.log('Someone is already sharing:', info.screenSharing);
        
        // Check if I was the one sharing (before refresh)
        if (info.screenSharing.userId === userId) {
          console.log('I was sharing before refresh, showing resume prompt...');
          setShowResumePrompt(true);
        } else {
          // Someone else is sharing
          setActiveScreenShare({
            userId: info.screenSharing.userId,
            userName: info.screenSharing.userName
          });
          
          // Request screen share connection
          socket.emit('request-screen-share', {
            roomId,
            requesterId: userId
          });
        }
      }
    };

    const handlePermissionsUpdated = (updatedPermissions) => {
      setPermissions(updatedPermissions.permissions);
      updateCanDraw(updatedPermissions.permissions, updatedPermissions.host, userId);
      updateCanChat(updatedPermissions.permissions, updatedPermissions.host, userId);
    };

    const handlePermissionDenied = (data) => {
      alert(data.message);
    };

    const handleRoomDestroyed = (data) => {
      console.log('Room destroyed event received:', data);
      alert(data.message);
      navigate('/dashboard');
    };

    const handleError = (data) => {
      console.error('Socket error:', data);
      alert(data.message);
    };

    const handleKicked = (data) => {
      alert(data.message);
      navigate('/dashboard');
    };

    const handleUserKicked = (data) => {
      console.log('User kicked notification:', data);
      // Optional: Show a toast notification instead of alert
      // For now, just log it
    };

    const handleWaitingRoomUpdate = (waitingList) => {
      console.log('Waiting room updated:', waitingList);
      setWaitingUsers(waitingList);
      if (waitingList.length > 0) {
        setShowWaitingRoom(true);
      }
    };

    const handleJoinRequest = (data) => {
      console.log('Join request received:', data);
      // Show notification or update UI
    };

    const handleScreenShareStarted = (data) => {
      console.log('User started screen sharing:', data);
      const currentUserId = String(user._id || user.id);
      
      // Don't show own screen share
      if (data.userId === currentUserId) {
        return;
      }

      setActiveScreenShare({ 
        userId: data.userId, 
        userName: data.userName 
      });

      // Request WebRTC connection with proper target
      if (socket) {
        console.log('Requesting screen share from:', data.userId);
        socket.emit('request-screen-share', {
          roomId,
          requesterId: currentUserId,
          targetUserId: data.userId
        });
      }
    };

    const handleScreenShareStopped = (data) => {
      console.log('User stopped screen sharing:', data);
      
      // Clear active screen share state
      setActiveScreenShare(null);
      setRemoteStream(null);
      
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      console.log('Canvas should be visible again');
    };

    const handleScreenShareOffer = async (data) => {
      console.log('Received screen share offer from:', data.userId);
      const currentUserId = String(user._id || user.id);
      
      // Don't process own offer
      if (data.userId === currentUserId) {
        return;
      }

      try {
        // Close existing connection if any
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
        }

        // Create peer connection
        const pc = createPeerConnection();
        peerConnectionRef.current = pc;

        // Set remote description
        await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        console.log('Set remote description from offer');

        // Create answer with better configuration
        const answer = await pc.createAnswer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        
        await pc.setLocalDescription(answer);
        console.log('Created and set local description (answer)');

        // Send answer back
        socket.emit('screen-share-answer', {
          roomId,
          answer,
          userId: currentUserId,
          targetUserId: data.userId
        });

        console.log('Sent screen share answer to:', data.userId);
      } catch (error) {
        console.error('Error handling screen share offer:', error);
      }
    };

    const handleScreenShareAnswer = async (data) => {
      console.log('Received screen share answer from:', data.userId);
      const currentUserId = String(user._id || user.id);
      
      // Only process if this answer is for us
      if (data.targetUserId && data.targetUserId !== currentUserId) {
        return;
      }
      
      try {
        if (peerConnectionRef.current && data.answer) {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(data.answer)
          );
          console.log('Set remote description from answer');
        } else {
          console.log('No peer connection or answer available');
        }
      } catch (error) {
        console.error('Error handling screen share answer:', error);
      }
    };

    const handleIceCandidate = async (data) => {
      console.log('Received ICE candidate from:', data.userId);
      const currentUserId = String(user._id || user.id);
      
      // Don't process own ICE candidates
      if (data.userId === currentUserId) {
        return;
      }
      
      try {
        if (peerConnectionRef.current && data.candidate) {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
          console.log('Added ICE candidate');
        }
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    };

    const handleRequestScreenShare = async (data) => {
      console.log('Received request for screen share from:', data.requesterId);
      const currentUserId = String(user._id || user.id);
      
      // Use ref instead of state to get current stream
      const stream = screenStreamRef.current;
      
      if (!stream) {
        console.log('No screen stream available');
        return;
      }

      // Don't respond to own request
      if (data.requesterId === currentUserId) {
        return;
      }

      console.log('Creating peer connection and sending offer...');

      try {
        // Close existing connection if any
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
        }

        // Create peer connection
        const pc = createPeerConnection();
        peerConnectionRef.current = pc;

        // Add screen stream tracks with better configuration
        stream.getTracks().forEach(track => {
          console.log('Adding track to peer connection:', {
            kind: track.kind,
            enabled: track.enabled,
            readyState: track.readyState,
            label: track.label
          });
          
          // Add track with stream
          pc.addTrack(track, stream);
        });

        // Create offer with better configuration
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        
        await pc.setLocalDescription(offer);
        console.log('Created and set local description (offer)');

        // Send offer to requester
        socket.emit('screen-share-offer', {
          roomId,
          userId: currentUserId,
          userName: user.name,
          offer,
          targetUserId: data.requesterId
        });

        console.log('Sent screen share offer to:', data.requesterId);
      } catch (error) {
        console.error('Error creating screen share offer:', error);
      }
    };

    const updateCanDraw = (perms, host, currentUserId) => {
      const hostIdStr = String(host);
      const drawPerms = perms.draw || perms; // Backward compatibility

      if (currentUserId === hostIdStr) {
        setCanDraw(true);
        return;
      }

      if (drawPerms.mode === 'public') {
        setCanDraw(true);
      } else if (drawPerms.mode === 'host-only') {
        setCanDraw(false);
      } else if (drawPerms.mode === 'custom') {
        const allowed = drawPerms.allowedUsers.some(
          allowedId => String(allowedId) === currentUserId
        );
        setCanDraw(allowed);
      }
    };

    const updateCanChat = (perms, host, currentUserId) => {
      const hostIdStr = String(host);
      const chatPerms = perms.chat;

      if (currentUserId === hostIdStr) {
        setCanChat(true);
        return;
      }

      if (!chatPerms || chatPerms.mode === 'public') {
        setCanChat(true);
      } else if (chatPerms.mode === 'host-only') {
        setCanChat(false);
      } else if (chatPerms.mode === 'custom') {
        const allowed = chatPerms.allowedUsers.some(
          allowedId => String(allowedId) === currentUserId
        );
        setCanChat(allowed);
      }
    };

    socket.on('update-users', handleUpdateUsers);
    socket.on('chat-history', handleChatHistory);
    socket.on('receive-message', handleReceiveMessage);
    socket.on('room-info', handleRoomInfo);
    socket.on('permissions-updated', handlePermissionsUpdated);
    socket.on('permission-denied', handlePermissionDenied);
    socket.on('room-destroyed', handleRoomDestroyed);
    socket.on('error', handleError);
    socket.on('kicked', handleKicked);
    socket.on('user-kicked', handleUserKicked);
    socket.on('waiting-room-update', handleWaitingRoomUpdate);
    socket.on('join-request', handleJoinRequest);
    socket.on('screen-share-started', handleScreenShareStarted);
    socket.on('screen-share-stopped', handleScreenShareStopped);
    socket.on('screen-share-offer', handleScreenShareOffer);
    socket.on('screen-share-answer', handleScreenShareAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('request-screen-share', handleRequestScreenShare);

    return () => {
      console.log('Cleaning up and leaving room');
      socket.off('update-users', handleUpdateUsers);
      socket.off('chat-history', handleChatHistory);
      socket.off('receive-message', handleReceiveMessage);
      socket.off('room-info', handleRoomInfo);
      socket.off('permissions-updated', handlePermissionsUpdated);
      socket.off('permission-denied', handlePermissionDenied);
      socket.off('room-destroyed', handleRoomDestroyed);
      socket.off('error', handleError);
      socket.off('kicked', handleKicked);
      socket.off('user-kicked', handleUserKicked);
      socket.off('waiting-room-update', handleWaitingRoomUpdate);
      socket.off('join-request', handleJoinRequest);
      socket.off('screen-share-started', handleScreenShareStarted);
      socket.off('screen-share-stopped', handleScreenShareStopped);
      socket.off('screen-share-offer', handleScreenShareOffer);
      socket.off('screen-share-answer', handleScreenShareAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('request-screen-share', handleRequestScreenShare);
      
      // Stop screen sharing if active
      if (isScreenSharing) {
        stopScreenShare();
      }
      
      socket.emit('leave-room', { roomId, userId: userId });
    };
  }, [socket, roomId, user]);

  const handleLeaveRoom = () => {
    if (socket && user) {
      const userId = String(user._id || user.id);
      socket.emit('leave-room', { roomId, userId: userId });
    }
    navigate('/dashboard');
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
  };

  const sendMessage = (e) => {
    e.preventDefault();
    
    if (inputMessage.trim() && socket && user) {
      const userId = String(user._id || user.id);
      socket.emit('send-message', {
        roomId,
        userId: userId,
        userName: user.name,
        message: inputMessage
      });
      setInputMessage('');
    }
  };

  const handleFileShare = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    console.log('Selected file:', file);

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('File size must be less than 10MB');
      return;
    }

    setIsUploadingFile(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      // Use environment variable for API URL or fallback to localhost
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      
      console.log('API URL:', API_URL);
      console.log('Testing file route...');
      
      // Test connection first
      try {
        const testResponse = await fetch(`${API_URL}/api/files/test`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!testResponse.ok) {
          throw new Error(`Server connection failed: ${testResponse.status}`);
        }
        
        console.log('Test response:', await testResponse.text());
      } catch (testError) {
        console.error('Connection test failed:', testError);
        throw new Error(`Cannot connect to server. Please check if the backend is running.`);
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('roomId', roomId);

      console.log('Uploading file to room:', roomId);
      console.log('File details:', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      const response = await fetch(`${API_URL}/api/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      console.log('Upload response status:', response.status);
      const responseText = await response.text();
      console.log('Upload response text:', responseText);
      
      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error(`Server returned invalid response: ${responseText}`);
      }

      if (response.ok) {
        console.log('File uploaded successfully');
        // Emit file shared event to notify other users
        if (socket && user) {
          socket.emit('file-shared', {
            roomId,
            fileData: result.file,
            userName: user.name
          });
        }
        
        // Show success message
        console.log('File shared successfully:', result.file.originalName);
      } else {
        console.error('Upload failed:', result);
        
        // Provide specific error messages
        let errorMessage = result.message || 'Failed to upload file';
        if (response.status === 403) {
          errorMessage = 'You do not have permission to share files in this room';
        } else if (response.status === 404) {
          errorMessage = 'Room not found or server unavailable';
        } else if (response.status === 413) {
          errorMessage = 'File is too large (max 10MB)';
        }
        
        alert(errorMessage);
      }
    } catch (error) {
      console.error('File upload error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = error.message;
      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to server. Please check your internet connection and try again.';
      } else if (error.message.includes('NetworkError')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      alert(`Failed to upload file: ${errorMessage}`);
    } finally {
      setIsUploadingFile(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const downloadFile = async (fileName, originalName) => {
    try {
      const token = localStorage.getItem('token');
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      
      const response = await fetch(`${API_URL}/api/files/download/${roomId}/${fileName}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Check if it's a redirect (for cloud storage)
        if (response.redirected) {
          // Open the redirected URL in a new tab for cloud files
          window.open(response.url, '_blank');
        } else {
          // Handle as blob for local files
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = originalName;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      } else {
        const errorData = await response.json().catch(() => ({ message: 'Failed to download file' }));
        alert(errorData.message || 'Failed to download file');
      }
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file. Please try again.');
    }
  };

  const handleSnapshot = () => {
    if (snapshotFunctionRef.current) {
      snapshotFunctionRef.current();
      // Show brief success message
      const button = document.querySelector('.btn-snapshot');
      if (button) {
        const originalHTML = button.innerHTML;
        button.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Saved!
        `;
        setTimeout(() => {
          button.innerHTML = originalHTML;
        }, 1500);
      }
    } else {
      alert('Canvas not ready for snapshot. Please try again.');
    }
  };

  const handleScreenShare = async () => {
    if (!canDraw) {
      alert('You need draw permission to share your screen');
      return;
    }

    if (isScreenSharing) {
      // Stop screen sharing
      stopScreenShare();
    } else {
      // Start screen sharing
      try {
        console.log('Starting screen share...');
        
        let stream;
        try {
          // Try with audio first
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              cursor: 'always',
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
              frameRate: { ideal: 30, max: 30 }
            },
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              sampleRate: 44100
            }
          });
        } catch (audioError) {
          console.log('Failed to get screen share with audio, trying video only:', audioError);
          // Fallback to video only if audio fails
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              cursor: 'always',
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
              frameRate: { ideal: 30, max: 30 }
            },
            audio: false
          });
        }

        console.log('Got display media stream:', stream);
        console.log('Stream tracks:', stream.getTracks().map(track => ({
          kind: track.kind,
          enabled: track.enabled,
          readyState: track.readyState,
          label: track.label,
          settings: track.getSettings ? track.getSettings() : 'N/A'
        })));
        
        setScreenStream(stream);
        screenStreamRef.current = stream;
        setIsScreenSharing(true);

        // Set local video with better handling
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true; // Mute local video to prevent feedback
          localVideoRef.current.playsInline = true;
          localVideoRef.current.autoplay = true;
          
          // Add event listeners for local video
          const localVideo = localVideoRef.current;
          
          localVideo.addEventListener('loadedmetadata', () => {
            console.log('Local video metadata loaded:', {
              videoWidth: localVideo.videoWidth,
              videoHeight: localVideo.videoHeight
            });
          });
          
          // Don't force play for local video as it's just for preview
          localVideo.play().catch(e => {
            console.log('Local video play error (this is normal for screen share):', e);
          });
        }

        // Notify other users via socket
        if (socket && user) {
          const userId = String(user._id || user.id);
          socket.emit('start-screen-share', {
            roomId,
            userId,
            userName: user.name
          });
          console.log('Emitted start-screen-share event');
        }

        // Handle when user stops sharing via browser UI
        stream.getVideoTracks()[0].addEventListener('ended', () => {
          console.log('Screen share ended by user');
          stopScreenShare();
        });

        console.log('Screen sharing started successfully');
      } catch (error) {
        console.error('Error starting screen share:', error);
        
        // Reset states on error
        setIsScreenSharing(false);
        setScreenStream(null);
        screenStreamRef.current = null;
        
        if (error.name === 'NotAllowedError') {
          alert('Screen sharing permission denied. Please allow screen sharing and try again.');
        } else if (error.name === 'NotFoundError') {
          alert('No screen available to share. Please try again.');
        } else if (error.name === 'NotSupportedError') {
          alert('Screen sharing is not supported in this browser.');
        } else {
          alert('Failed to start screen sharing. Please check your browser permissions and try again.');
        }
      }
    }
  };

  const stopScreenShare = () => {
    console.log('Stopping screen share...');
    
    try {
      // Stop all tracks in the stream
      if (screenStream) {
        screenStream.getTracks().forEach(track => {
          track.stop();
          console.log('Stopped track:', track.kind);
        });
        setScreenStream(null);
      }
      
      // Clear stream ref
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        screenStreamRef.current = null;
      }
      
      // Clear local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
        console.log('Cleared local video');
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
        console.log('Closed peer connection');
      }

      // Clear states
      setIsScreenSharing(false);
      setActiveScreenShare(null);
      setRemoteStream(null);

      // Notify other users
      if (socket && user) {
        const userId = String(user._id || user.id);
        socket.emit('stop-screen-share', {
          roomId,
          userId
        });
        console.log('Emitted stop-screen-share event');
      }

      console.log('Screen sharing stopped successfully');
    } catch (error) {
      console.error('Error stopping screen share:', error);
      
      // Force clear states even if there's an error
      setIsScreenSharing(false);
      setActiveScreenShare(null);
      setRemoteStream(null);
      setScreenStream(null);
      screenStreamRef.current = null;
    }
  };

  const createPeerConnection = () => {
    try {
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      };

      const pc = new RTCPeerConnection(configuration);
      const currentUserId = String(user._id || user.id);

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          console.log('Sending ICE candidate:', event.candidate);
          socket.emit('ice-candidate', {
            roomId,
            userId: currentUserId,
            candidate: event.candidate
          });
        } else if (!event.candidate) {
          console.log('ICE gathering completed');
        }
      };

      pc.ontrack = (event) => {
        console.log('Received remote track:', {
          kind: event.track.kind,
          enabled: event.track.enabled,
          readyState: event.track.readyState,
          streamId: event.streams[0]?.id,
          label: event.track.label
        });
        
        const stream = event.streams[0];
        
        if (stream) {
          console.log('Stream details:', {
            id: stream.id,
            active: stream.active,
            tracks: stream.getTracks().map(t => ({
              kind: t.kind,
              enabled: t.enabled,
              readyState: t.readyState,
              label: t.label
            }))
          });
          
          // Ensure we have video tracks
          const videoTracks = stream.getVideoTracks();
          if (videoTracks.length === 0) {
            console.error('No video tracks in received stream');
            return;
          }
          
          console.log('Video track details:', videoTracks.map(track => ({
            enabled: track.enabled,
            readyState: track.readyState,
            label: track.label,
            settings: track.getSettings ? track.getSettings() : 'N/A'
          })));
          
          setRemoteStream(stream);
          
          // Set video element source immediately with retry mechanism
          if (remoteVideoRef.current) {
            const video = remoteVideoRef.current;
            
            // Clear existing source
            video.srcObject = null;
            
            // Set new source
            video.srcObject = stream;
            
            // Configure video element for screen sharing
            video.muted = false; // Allow audio
            video.playsInline = true;
            video.autoplay = true;
            video.controls = false;
            
            // Force play with retry
            const tryPlay = async (attempts = 0) => {
              try {
                await video.play();
                console.log('Remote video playing successfully');
              } catch (error) {
                console.error(`Play attempt ${attempts + 1} failed:`, error);
                if (attempts < 3) {
                  setTimeout(() => tryPlay(attempts + 1), 500);
                }
              }
            };
            
            // Try to play after a short delay
            setTimeout(() => tryPlay(), 100);
            
            console.log('Set remote video source in ontrack');
          }
        } else {
          console.error('No stream in track event');
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          console.log('WebRTC connection established successfully');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          console.log('WebRTC connection lost');
          setRemoteStream(null);
          setActiveScreenShare(null);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed') {
          console.log('ICE connection failed, attempting restart');
          pc.restartIce();
        } else if (pc.iceConnectionState === 'disconnected') {
          console.log('ICE connection disconnected');
        } else if (pc.iceConnectionState === 'connected') {
          console.log('ICE connection established');
        }
      };

      pc.onsignalingstatechange = () => {
        console.log('Signaling state:', pc.signalingState);
      };

      return pc;
    } catch (error) {
      console.error('Error creating peer connection:', error);
      return null;
    }
  };

  const viewSharedScreen = (screen) => {
    setShowScreenModal(true);
    // The modal will display the selected screen
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the entire canvas? This action cannot be undone.')) {
      if (socket && user) {
        const userId = String(user._id || user.id);
        socket.emit('clear-board', { roomId, userId });
      }
    }
  };

  const handleUndo = () => {
    console.log('Undo clicked, socket:', socket, 'roomId:', roomId);
    if (socket && user) {
      const userId = String(user._id || user.id);
      socket.emit('undo', { roomId, userId });
    }
  };

  const handleRedo = () => {
    console.log('Redo clicked, socket:', socket, 'roomId:', roomId);
    if (socket && user) {
      const userId = String(user._id || user.id);
      socket.emit('redo', { roomId, userId });
    }
  };

  const handlePermissionChange = (permissionType, mode, selectedUsers = []) => {
    if (socket) {
      socket.emit('update-permissions', {
        roomId,
        permissionType,
        mode,
        allowedUsers: selectedUsers
      });
      // Only close modal if not switching to custom mode (keep it open for user selection)
      if (mode !== 'custom') {
        setShowPermissionsModal(false);
      }
    }
  };

  const isHost = () => {
    const userId = String(user._id || user.id);
    const isUserHost = String(hostId) === userId;
    console.log('Host check:', { userId, hostId, isUserHost });
    return isUserHost;
  };

  const handleDestroyRoom = () => {
    if (socket && user) {
      const userId = String(user._id || user.id);
      console.log('Destroying room:', roomId, 'by user:', userId);
      socket.emit('destroy-room', { roomId, userId });
      setShowDestroyModal(false);
    } else {
      console.error('Cannot destroy room - socket or user not available');
    }
  };

  const toggleUserPermission = (targetUserId) => {
    const isAllowed = permissions.draw.allowedUsers.some(id => String(id) === String(targetUserId));
    
    let newAllowed;
    if (isAllowed) {
      // Remove permission
      newAllowed = permissions.draw.allowedUsers.filter(id => String(id) !== String(targetUserId));
    } else {
      // Add permission
      newAllowed = [...permissions.draw.allowedUsers, targetUserId];
    }

    if (socket) {
      socket.emit('update-permissions', {
        roomId,
        permissionType: 'draw',
        mode: 'custom',
        allowedUsers: newAllowed
      });
    }
    setShowUserMenu(null);
  };

  const toggleChatPermission = (targetUserId) => {
    const isAllowed = permissions.chat.allowedUsers.some(id => String(id) === String(targetUserId));
    
    let newAllowed;
    if (isAllowed) {
      // Remove permission
      newAllowed = permissions.chat.allowedUsers.filter(id => String(id) !== String(targetUserId));
    } else {
      // Add permission
      newAllowed = [...permissions.chat.allowedUsers, targetUserId];
    }

    if (socket) {
      socket.emit('update-permissions', {
        roomId,
        permissionType: 'chat',
        mode: 'custom',
        allowedUsers: newAllowed
      });
    }
    setShowUserMenu(null);
  };

  const kickUser = (targetUserId, targetUserName) => {
    if (socket) {
      socket.emit('kick-user', {
        roomId,
        targetUserId,
        targetUserName
      });
    }
    setShowUserMenu(null);
  };

  const hasDrawPermission = (userId) => {
    if (String(userId) === String(hostId)) return true;
    if (permissions.draw.mode === 'public') return true;
    if (permissions.draw.mode === 'host-only') return false;
    if (permissions.draw.mode === 'custom') {
      return permissions.draw.allowedUsers.some(id => String(id) === String(userId));
    }
    return false;
  };

  const hasChatPermission = (userId) => {
    if (String(userId) === String(hostId)) return true;
    if (permissions.chat.mode === 'public') return true;
    if (permissions.chat.mode === 'host-only') return false;
    if (permissions.chat.mode === 'custom') {
      return permissions.chat.allowedUsers.some(id => String(id) === String(userId));
    }
    return false;
  };

  const approveUser = (userId, userName) => {
    if (socket) {
      socket.emit('approve-join', { roomId, userId, userName });
    }
  };

  const rejectUser = (userId, userName) => {
    if (socket) {
      socket.emit('reject-join', { roomId, userId, userName });
    }
  };

  const colors = ['#000000', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];

  const handleResumeScreenShare = () => {
    setShowResumePrompt(false);
    handleScreenShare();
  };

  const handleDeclineResume = () => {
    setShowResumePrompt(false);
    // Stop screen sharing for everyone
    if (socket && user) {
      const userId = String(user._id || user.id);
      socket.emit('stop-screen-share', {
        roomId,
        userId
      });
    }
  };

  return (
    <div className={`whiteboard-room ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      {!isFullscreen && (
      <header className="room-header">
        <div className="room-info-header">
          <span className="room-name">{roomName || 'Loading...'}</span>
          <span className="room-id">Room: {roomId}</span>
          <button className="btn-copy" onClick={handleCopyRoomId}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy Room ID
          </button>
          {isHost() && (
            <div className="permission-badges">
              <span className={`permission-mode-badge permission-mode-${permissions.draw.mode}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19l7-7 3 3-7 7-3-3z" />
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                </svg>
                Draw: {permissions.draw.mode === 'public' && 'Public'}
                {permissions.draw.mode === 'host-only' && 'Host Only'}
                {permissions.draw.mode === 'custom' && `Custom (${permissions.draw.allowedUsers.length})`}
              </span>
              <span className={`permission-mode-badge permission-mode-${permissions.chat.mode}`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Chat: {permissions.chat.mode === 'public' && 'Public'}
                {permissions.chat.mode === 'host-only' && 'Host Only'}
                {permissions.chat.mode === 'custom' && `Custom (${permissions.chat.allowedUsers.length})`}
              </span>
            </div>
          )}
          {isHost() && waitingUsers.length > 0 && (
            <button className="btn-waiting-room" onClick={() => setShowWaitingRoom(!showWaitingRoom)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              Waiting ({waitingUsers.length})
            </button>
          )}
          {!canDraw && (
            <span className="read-only-badge">Read Only</span>
          )}
          <span className="room-users-count">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {users.length} online
          </span>
        </div>
        <div className="header-actions">
          <button 
            className={`btn-toggle-sidebar ${isSidebarHidden ? 'hidden' : ''}`}
            onClick={() => {
              setIsSidebarHidden(!isSidebarHidden);
              if (!isSidebarHidden) {
                setIsSidebarOpen(false); // Close sidebar when hiding
              }
            }}
            title={isSidebarHidden ? "Show Chat & Users" : "Hide Chat & Users"}
          >
            {isSidebarHidden ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 17l5-5-5-5M6 17l5-5-5-5" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" />
              </svg>
            )}
          </button>
          <button 
            className="btn-fullscreen" 
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>
          <button 
            className="btn-snapshot" 
            onClick={handleSnapshot}
            title="Take Snapshot"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Snapshot
          </button>
          {isHost() && (
            <div className="header-menu-container">
              <button 
                className={`btn-header-menu ${showToolbarMenu ? 'active' : ''}`}
                onClick={() => setShowToolbarMenu(!showToolbarMenu)}
                title="Admin Menu"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="12" cy="5" r="1" />
                  <circle cx="12" cy="19" r="1" />
                </svg>
              </button>
              {showToolbarMenu && (
                <div className="header-menu-dropdown">
                  <button 
                    className="header-menu-item"
                    onClick={() => {
                      setShowPermissionsModal(true);
                      setShowToolbarMenu(false);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Room Permissions
                  </button>
                  <button 
                    className="header-menu-item"
                    onClick={() => {
                      handleSnapshot();
                      setShowToolbarMenu(false);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21v-8H7v8" />
                      <polyline points="7 3v5h4" />
                    </svg>
                    Save Canvas
                  </button>
                  <button 
                    className="header-menu-item destructive"
                    onClick={() => {
                      setShowDestroyModal(true);
                      setShowToolbarMenu(false);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Close Room
                  </button>
                </div>
              )}
            </div>
          )}
          <button 
            className="btn-theme-toggle" 
            onClick={toggleTheme}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            )}
          </button>
          <button className="btn-leave" onClick={handleLeaveRoom}>
            Leave
          </button>
        </div>
      </header>
      )}

      <div className="room-main">
        {canDraw && !isFullscreen && (
          <div 
            className={`toolbar ${isToolbarExpanded ? 'expanded' : ''}`}
            onClick={() => setIsToolbarExpanded(!isToolbarExpanded)}
          >
            <button 
              className={`tool-btn ${tool === 'pencil' ? 'active' : ''}`}
              onClick={() => {
                setTool('pencil');
                setBrushSize(pencilSize);
              }}
              title="Pencil"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                <path d="M2 2l7.586 7.586"/>
                <circle cx="11" cy="11" r="2"/>
              </svg>
            </button>

            <button 
              className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
              onClick={() => {
                setTool('eraser');
                setBrushSize(eraserSize);
              }}
              title="Eraser"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 20H7L3 16c-1-1-1-2.5 0-3.5l9.5-9.5c1-1 2.5-1 3.5 0l5.5 5.5c1 1 1 2.5 0 3.5L13 20"/>
                <path d="M7 20l6-6"/>
              </svg>
            </button>

            <div className="tool-divider"></div>

            <div className="color-palette">
              {colors.map((c) => (
                <button
                  key={c}
                  className={`color-btn ${color === c ? 'active' : ''}`}
                  style={{ background: c }}
                  onClick={() => {
                    setColor(c);
                    // If currently using eraser, switch to pencil when selecting a color
                    if (tool === 'eraser') {
                      setTool('pencil');
                      setBrushSize(pencilSize);
                    }
                  }}
                />
              ))}
            </div>

            <div className="tool-divider"></div>

            <div className="brush-size-control">
              <div className="brush-size-label">{brushSize}px</div>
              <div className="brush-size-slider-container">
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={brushSize}
                  onChange={(e) => updateBrushSize(Number(e.target.value))}
                  className="brush-size-slider"
                />
              </div>
            </div>

            <div className="tool-divider"></div>

            <button className="tool-btn" onClick={handleUndo} title="Undo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7v6h6" />
                <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
              </svg>
            </button>

            <button className="tool-btn" onClick={handleRedo} title="Redo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 7v6h-6" />
                <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7" />
              </svg>
            </button>

            <button className="tool-btn" onClick={handleClear} title="Clear Canvas">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          </div>
        )}

        <div className="canvas-container">
          {/* Exit Fullscreen Button - Only visible in fullscreen mode */}
          {isFullscreen && (
            <button 
              className="btn-exit-fullscreen"
              onClick={() => setIsFullscreen(false)}
              title="Exit Fullscreen (Press ESC)"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
              Exit Fullscreen
            </button>
          )}
          
          {activeScreenShare || isScreenSharing ? (
            <div className="screen-share-view">
              {isScreenSharing && (
                <div className="screen-share-indicator sharing">
                  <div className="indicator-content">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <span>You are sharing your screen</span>
                    {process.env.NODE_ENV === 'development' && (
                      <button
                        onClick={() => {
                          if (localVideoRef.current && screenStream) {
                            console.log('Testing local video preview...');
                            const video = localVideoRef.current;
                            console.log('Local video element state:', {
                              videoWidth: video.videoWidth,
                              videoHeight: video.videoHeight,
                              readyState: video.readyState,
                              paused: video.paused,
                              srcObject: video.srcObject
                            });
                            
                            // Try to play the video
                            video.play().catch(e => console.error('Local video play error:', e));
                          }
                        }}
                        style={{
                          marginLeft: '0.5rem',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          background: 'rgba(255,255,255,0.2)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer'
                        }}
                      >
                        Test Local
                      </button>
                    )}
                  </div>
                </div>
              )}
              {activeScreenShare && !isScreenSharing && (
                <div className="screen-share-indicator viewing">
                  <div className="indicator-content">
                    <div className="viewer-avatar">
                      {activeScreenShare.userName?.charAt(0).toUpperCase()}
                    </div>
                    <span>{activeScreenShare.userName} is sharing their screen</span>
                    <span className="live-badge">
                      <span className="live-dot"></span>
                      LIVE
                    </span>
                  </div>
                </div>
              )}
              <video
                ref={isScreenSharing ? localVideoRef : remoteVideoRef}
                autoPlay
                playsInline
                muted={isScreenSharing}
                className="screen-share-video"
                controls={false}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'contain',
                  backgroundColor: '#000'
                }}
                onLoadedMetadata={(e) => {
                  console.log('Video metadata loaded:', {
                    videoWidth: e.target.videoWidth,
                    videoHeight: e.target.videoHeight,
                    duration: e.target.duration,
                    readyState: e.target.readyState
                  });
                }}
                onCanPlay={(e) => {
                  console.log('Video can play, attempting to play...');
                  e.target.play().catch(err => {
                    console.error('Error playing video on canplay:', err);
                  });
                }}
                onPlay={() => console.log('Video started playing')}
                onError={(e) => {
                  console.error('Video error:', e);
                  console.error('Video error details:', {
                    error: e.target.error,
                    networkState: e.target.networkState,
                    readyState: e.target.readyState,
                    currentSrc: e.target.currentSrc
                  });
                }}
                onWaiting={() => console.log('Video waiting for data')}
                onLoadStart={() => console.log('Video load started')}
              />
              {!remoteStream && activeScreenShare && !isScreenSharing && (
                <div className="screen-share-loading">
                  <div className="loading-spinner"></div>
                  <p>Connecting to screen share...</p>
                  <button 
                    className="btn-retry-connection"
                    onClick={() => {
                      console.log('Retrying screen share connection...');
                      if (socket && user) {
                        const userId = String(user._id || user.id);
                        socket.emit('request-screen-share', {
                          roomId,
                          requesterId: userId,
                          targetUserId: activeScreenShare.userId
                        });
                      }
                    }}
                    style={{
                      marginTop: '1rem',
                      padding: '0.5rem 1rem',
                      background: 'var(--primary-color)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Retry Connection
                  </button>
                </div>
              )}
            </div>
          ) : null}
          
          {/* Always render Canvas but hide it when screen sharing */}
          <div style={{ display: (activeScreenShare || isScreenSharing) ? 'none' : 'block', width: '100%', height: '100%' }}>
            <Canvas
              key="main-canvas"
              roomId={roomId}
              tool={tool}
              color={color}
              brushSize={brushSize}
              canDraw={canDraw}
              onSnapshot={(fn) => { snapshotFunctionRef.current = fn; }}
            />
          </div>
        </div>

        {/* Mobile Sidebar Toggle Button */}
        {!isSidebarHidden && (
        <button 
          className={`sidebar-toggle ${isSidebarOpen ? 'active' : ''}`}
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label="Toggle sidebar"
        >
          {isSidebarOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              {messages.length > 0 && !isSidebarOpen && (
                <span className="sidebar-toggle-badge">{messages.length > 99 ? '99+' : messages.length}</span>
              )}
            </>
          )}
        </button>
        )}

        {!isFullscreen && !isSidebarHidden && (
        <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
          {/* Mobile Handle for dragging */}
          <div className="sidebar-handle" onClick={() => setIsSidebarOpen(false)}>
            <div className="sidebar-handle-bar"></div>
          </div>

          <div className="sidebar-tabs">
            <button 
              className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              Chat
              {isHost() && permissions.chat.mode !== 'public' && (
                <span className="tab-restriction-indicator">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
              )}
            </button>
            <button 
              className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Users
            </button>
            {isHost() && waitingUsers.length > 0 && (
              <button 
                className={`tab-btn ${activeTab === 'waiting' ? 'active' : ''}`}
                onClick={() => setActiveTab('waiting')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                Waiting
                <span className="tab-badge">{waitingUsers.length}</span>
              </button>
            )}
          </div>

          <div className="tab-content">
            {activeTab === 'chat' ? (
              <div className="chat-container">
                <div className="chat-messages">
                  {messages.map((msg, index) => {
                    const currentUserId = user._id || user.id;
                    const messageUserId = msg.userId;
                    // Handle both string comparison and undefined userId (old messages)
                    const isCurrentUser = messageUserId ? String(messageUserId) === String(currentUserId) : false;
                    
                    return (
                      <div 
                        key={index} 
                        className={`chat-message ${isCurrentUser ? 'chat-message-own' : 'chat-message-other'}`}
                      >
                        <div className="message-header">
                          <span className="message-author">
                            {isCurrentUser ? 'You' : (msg.userName || 'Unknown')}
                          </span>
                          <span className="message-time">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {msg.messageType === 'file' ? (
                          <div className="message-file">
                            <div className="file-info">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                              <div className="file-details">
                                <span className="file-name">{msg.fileData?.originalName}</span>
                                <span className="file-size">
                                  {msg.fileData?.fileSize ? (msg.fileData.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown size'}
                                </span>
                              </div>
                            </div>
                            <button 
                              className="btn-download"
                              onClick={() => downloadFile(msg.fileData?.fileName, msg.fileData?.originalName)}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div className="message-text">{msg.message}</div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                {canChat ? (
                  <div className="chat-input-section">
                    <form onSubmit={sendMessage} className="chat-input-container">
                      <input
                        type="text"
                        className="chat-input"
                        placeholder="Type a message..."
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                      />
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileShare}
                        style={{ display: 'none' }}
                        accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.zip,.rar,.mp4,.mp3,.wav"
                      />
                      <button 
                        type="button" 
                        className="btn-file-share"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingFile}
                        title="Share File"
                      >
                        {isUploadingFile ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12a9 9 0 11-6.219-8.56" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                          </svg>
                        )}
                      </button>
                      <button type="submit" className="btn-send">Send</button>
                    </form>
                  </div>
                ) : (
                  <div className="chat-disabled">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>Chat is disabled for you</span>
                  </div>
                )}
              </div>
            ) : activeTab === 'users' ? (
              <div className="users-container">
                <div className="users-list">
                  {users.map((u, index) => {
                    const isCurrentUser = String(u.userId) === String(user._id || user.id);
                    const isUserHost = String(u.userId) === String(hostId);
                    const userHasDrawPermission = hasDrawPermission(u.userId);
                    const userHasChatPermission = hasChatPermission(u.userId);
                    
                    return (
                      <div key={index} className="user-item">
                        <div className="user-avatar">{u.userName?.charAt(0).toUpperCase()}</div>
                        <div className="user-info">
                          <span className="user-name">
                            {u.userName}
                            {isCurrentUser && <span className="user-badge-you">You</span>}
                            {isUserHost && <span className="user-badge-host">Host</span>}
                          </span>
                          <div className="user-permissions">
                            {userHasDrawPermission && !isUserHost && (
                              <span className="user-status user-status-draw">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 19l7-7 3 3-7 7-3-3z" />
                                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                                </svg>
                                Can draw
                              </span>
                            )}
                            {userHasChatPermission && !isUserHost && (
                              <span className="user-status user-status-chat">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                </svg>
                                Can chat
                              </span>
                            )}
                          </div>
                        </div>
                        {isHost() && !isCurrentUser && (
                          <div className="user-menu-container">
                            <button 
                              className="user-menu-btn"
                              onClick={() => setShowUserMenu(showUserMenu === u.userId ? null : u.userId)}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="12" cy="5" r="1" />
                                <circle cx="12" cy="19" r="1" />
                              </svg>
                            </button>
                            {showUserMenu === u.userId && (
                              <div className="user-menu-dropdown">
                                <button 
                                  className="menu-item"
                                  onClick={() => toggleUserPermission(u.userId)}
                                >
                                  {userHasDrawPermission ? (
                                    <>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                      </svg>
                                      Remove Draw Permission
                                    </>
                                  ) : (
                                    <>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M12 19l7-7 3 3-7 7-3-3z" />
                                        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                                      </svg>
                                      Give Draw Permission
                                    </>
                                  )}
                                </button>
                                <button 
                                  className="menu-item"
                                  onClick={() => toggleChatPermission(u.userId)}
                                >
                                  {userHasChatPermission ? (
                                    <>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                      </svg>
                                      Remove Chat Permission
                                    </>
                                  ) : (
                                    <>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                      </svg>
                                      Give Chat Permission
                                    </>
                                  )}
                                </button>
                                <button 
                                  className="menu-item menu-item-danger"
                                  onClick={() => kickUser(u.userId, u.userName)}
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="8.5" cy="7" r="4" />
                                    <line x1="18" y1="8" x2="23" y2="13" />
                                    <line x1="23" y1="8" x2="18" y2="13" />
                                  </svg>
                                  Kick User
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : activeTab === 'waiting' ? (
              <div className="waiting-container">
                <div className="waiting-header">
                  <h3>Waiting for Approval</h3>
                  <p className="waiting-description">
                    Users requesting to join your private room
                  </p>
                </div>
                <div className="waiting-list">
                  {waitingUsers.length > 0 ? (
                    waitingUsers.map((waitingUser, index) => (
                      <div key={index} className="waiting-item">
                        <div className="waiting-item-header">
                          <div className="waiting-user-avatar-large">
                            {waitingUser.userName?.charAt(0).toUpperCase()}
                          </div>
                          <div className="waiting-item-info">
                            <div className="waiting-item-name">{waitingUser.userName}</div>
                            <div className="waiting-item-time">
                              Requested at {new Date(waitingUser.requestedAt).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="waiting-item-actions">
                          <button 
                            className="btn-approve-full"
                            onClick={() => approveUser(waitingUser.userId, waitingUser.userName)}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Approve
                          </button>
                          <button 
                            className="btn-reject-full"
                            onClick={() => rejectUser(waitingUser.userId, waitingUser.userName)}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                            Reject
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="waiting-empty">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <p>No users waiting</p>
                      <span>Users requesting to join will appear here</span>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="sidebar-actions">
            {canDraw && (
              <button 
                className={`sidebar-btn ${isScreenSharing ? 'active' : ''}`}
                onClick={handleScreenShare}
                title={isScreenSharing ? 'Stop sharing screen' : 'Share your screen'}
                disabled={isUploadingFile}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
              </button>
            )}
            
            {/* Debug info for screen sharing */}
            {process.env.NODE_ENV === 'development' && (
              <div style={{ fontSize: '0.75rem', color: '#666', padding: '0.5rem', borderTop: '1px solid #eee' }}>
                <div>Screen Sharing: {isScreenSharing ? 'Yes' : 'No'}</div>
                <div>Active Share: {activeScreenShare ? activeScreenShare.userName : 'None'}</div>
                <div>Remote Stream: {remoteStream ? 'Connected' : 'None'}</div>
                <div>Local Stream: {screenStream ? 'Active' : 'None'}</div>
                <div>Peer Connection: {peerConnectionRef.current ? peerConnectionRef.current.connectionState : 'None'}</div>
                {remoteStream && (
                  <div>Remote Tracks: {remoteStream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(', ')}</div>
                )}
                {screenStream && (
                  <div>Local Tracks: {screenStream.getTracks().map(t => `${t.kind}:${t.readyState}`).join(', ')}</div>
                )}
                <button 
                  onClick={() => {
                    console.log('=== SCREEN SHARE DEBUG INFO ===');
                    console.log('isScreenSharing:', isScreenSharing);
                    console.log('activeScreenShare:', activeScreenShare);
                    console.log('remoteStream:', remoteStream);
                    console.log('screenStream:', screenStream);
                    console.log('peerConnection:', peerConnectionRef.current);
                    
                    if (remoteStream) {
                      console.log('Remote stream details:', {
                        id: remoteStream.id,
                        active: remoteStream.active,
                        tracks: remoteStream.getTracks().map(t => ({
                          kind: t.kind,
                          enabled: t.enabled,
                          readyState: t.readyState,
                          label: t.label,
                          muted: t.muted
                        }))
                      });
                    }
                    
                    if (screenStream) {
                      console.log('Local stream details:', {
                        id: screenStream.id,
                        active: screenStream.active,
                        tracks: screenStream.getTracks().map(t => ({
                          kind: t.kind,
                          enabled: t.enabled,
                          readyState: t.readyState,
                          label: t.label,
                          muted: t.muted
                        }))
                      });
                    }
                    
                    if (peerConnectionRef.current) {
                      console.log('Peer connection details:', {
                        connectionState: peerConnectionRef.current.connectionState,
                        iceConnectionState: peerConnectionRef.current.iceConnectionState,
                        signalingState: peerConnectionRef.current.signalingState,
                        localDescription: peerConnectionRef.current.localDescription,
                        remoteDescription: peerConnectionRef.current.remoteDescription
                      });
                    }
                    
                    if (remoteVideoRef.current) {
                      const video = remoteVideoRef.current;
                      console.log('Remote video element:', {
                        videoWidth: video.videoWidth,
                        videoHeight: video.videoHeight,
                        readyState: video.readyState,
                        networkState: video.networkState,
                        currentTime: video.currentTime,
                        duration: video.duration,
                        paused: video.paused,
                        muted: video.muted,
                        srcObject: video.srcObject
                      });
                    }
                    
                    console.log('=== END DEBUG INFO ===');
                  }}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer'
                  }}
                >
                  Debug Info
                </button>
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {showPermissionsModal && (
        <div className="modal-overlay" onClick={() => setShowPermissionsModal(false)}>
          <div className="modal-content permissions-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Room Permissions</h2>
            <p className="modal-description">Control who can draw and chat in the room</p>
            
            <div className="permission-tabs">
              <button 
                className={`permission-tab ${permissionTab === 'draw' ? 'active' : ''}`}
                onClick={() => setPermissionTab('draw')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 19l7-7 3 3-7 7-3-3z" />
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
                </svg>
                Draw Permissions
              </button>
              <button 
                className={`permission-tab ${permissionTab === 'chat' ? 'active' : ''}`}
                onClick={() => setPermissionTab('chat')}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                Chat Permissions
              </button>
            </div>

            <div className="permission-tab-content">
              {permissionTab === 'draw' ? (
                <>
                  <div className="permission-options">
                    <div 
                      className={`permission-option ${permissions.draw.mode === 'public' ? 'active' : ''}`}
                      onClick={() => handlePermissionChange('draw', 'public')}
                    >
                      <div className="permission-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </div>
                      <div className="permission-info">
                        <h3>Public</h3>
                        <p>Everyone can draw</p>
                      </div>
                    </div>

                    <div 
                      className={`permission-option ${permissions.draw.mode === 'host-only' ? 'active' : ''}`}
                      onClick={() => handlePermissionChange('draw', 'host-only')}
                    >
                      <div className="permission-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                      <div className="permission-info">
                        <h3>Host Only</h3>
                        <p>Only you can draw</p>
                      </div>
                    </div>

                    <div 
                      className={`permission-option ${permissions.draw.mode === 'custom' ? 'active' : ''}`}
                      onClick={() => handlePermissionChange('draw', 'custom', permissions.draw.allowedUsers)}
                    >
                      <div className="permission-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="8.5" cy="7" r="4" />
                          <line x1="20" y1="8" x2="20" y2="14" />
                          <line x1="23" y1="11" x2="17" y2="11" />
                        </svg>
                      </div>
                      <div className="permission-info">
                        <h3>Custom</h3>
                        <p>Select specific users</p>
                      </div>
                    </div>
                  </div>

                  {permissions.draw.mode === 'custom' && (
                    <div className="custom-permissions">
                      <h3>Select Users Who Can Draw</h3>
                      <p className="custom-permissions-hint">Check the users you want to allow drawing on the canvas</p>
                      <div className="users-checklist">
                        {users.filter(u => String(u.userId) !== String(hostId)).length > 0 ? (
                          users.filter(u => String(u.userId) !== String(hostId)).map((u) => (
                            <label key={u.userId} className="user-checkbox">
                              <input
                                type="checkbox"
                                checked={permissions.draw.allowedUsers.some(id => String(id) === String(u.userId))}
                                onChange={(e) => {
                                  const newAllowed = e.target.checked
                                    ? [...permissions.draw.allowedUsers, u.userId]
                                    : permissions.draw.allowedUsers.filter(id => String(id) !== String(u.userId));
                                  handlePermissionChange('draw', 'custom', newAllowed);
                                }}
                              />
                              <span>{u.userName}</span>
                              {permissions.draw.allowedUsers.some(id => String(id) === String(u.userId)) && (
                                <span className="permission-badge">Can Draw</span>
                              )}
                            </label>
                          ))
                        ) : (
                          <p className="no-users-message">No other users in the room yet. Users will appear here when they join.</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="permission-options">
                    <div 
                      className={`permission-option ${permissions.chat.mode === 'public' ? 'active' : ''}`}
                      onClick={() => handlePermissionChange('chat', 'public')}
                    >
                      <div className="permission-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </div>
                      <div className="permission-info">
                        <h3>Public</h3>
                        <p>Everyone can chat</p>
                      </div>
                    </div>

                    <div 
                      className={`permission-option ${permissions.chat.mode === 'host-only' ? 'active' : ''}`}
                      onClick={() => handlePermissionChange('chat', 'host-only')}
                    >
                      <div className="permission-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                      <div className="permission-info">
                        <h3>Host Only</h3>
                        <p>Only you can chat</p>
                      </div>
                    </div>

                    <div 
                      className={`permission-option ${permissions.chat.mode === 'custom' ? 'active' : ''}`}
                      onClick={() => handlePermissionChange('chat', 'custom', permissions.chat.allowedUsers)}
                    >
                      <div className="permission-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="8.5" cy="7" r="4" />
                          <line x1="20" y1="8" x2="20" y2="14" />
                          <line x1="23" y1="11" x2="17" y2="11" />
                        </svg>
                      </div>
                      <div className="permission-info">
                        <h3>Custom</h3>
                        <p>Select specific users</p>
                      </div>
                    </div>
                  </div>

                  {permissions.chat.mode === 'custom' && (
                    <div className="custom-permissions">
                      <h3>Select Users Who Can Chat</h3>
                      <p className="custom-permissions-hint">Check the users you want to allow chatting in the room</p>
                      <div className="users-checklist">
                        {users.filter(u => String(u.userId) !== String(hostId)).length > 0 ? (
                          users.filter(u => String(u.userId) !== String(hostId)).map((u) => (
                            <label key={u.userId} className="user-checkbox">
                              <input
                                type="checkbox"
                                checked={permissions.chat.allowedUsers.some(id => String(id) === String(u.userId))}
                                onChange={(e) => {
                                  const newAllowed = e.target.checked
                                    ? [...permissions.chat.allowedUsers, u.userId]
                                    : permissions.chat.allowedUsers.filter(id => String(id) !== String(u.userId));
                                  handlePermissionChange('chat', 'custom', newAllowed);
                                }}
                              />
                              <span>{u.userName}</span>
                              {permissions.chat.allowedUsers.some(id => String(id) === String(u.userId)) && (
                                <span className="permission-badge">Can Chat</span>
                              )}
                            </label>
                          ))
                        ) : (
                          <p className="no-users-message">No other users in the room yet. Users will appear here when they join.</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowPermissionsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showDestroyModal && (
        <div className="modal-overlay" onClick={() => setShowDestroyModal(false)}>
          <div className="modal-content destroy-modal" onClick={(e) => e.stopPropagation()}>
            <div className="destroy-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h2>Close Room Permanently?</h2>
            <p className="modal-description">
              This will close the room for all participants. Everyone will be disconnected and the room will no longer be accessible. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowDestroyModal(false)}>
                Cancel
              </button>
              <button className="btn-destroy-confirm" onClick={handleDestroyRoom}>
                Close Room
              </button>
            </div>
          </div>
        </div>
      )}

      {showWaitingRoom && waitingUsers.length > 0 && (
        <div className="waiting-room-panel">
          <div className="waiting-room-header">
            <h3>Waiting Room ({waitingUsers.length})</h3>
            <button className="btn-close-panel" onClick={() => setShowWaitingRoom(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="waiting-room-list">
            {waitingUsers.map((waitingUser, index) => (
              <div key={index} className="waiting-user-item">
                <div className="waiting-user-info">
                  <div className="waiting-user-avatar">
                    {waitingUser.userName?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="waiting-user-name">{waitingUser.userName}</div>
                    <div className="waiting-user-time">
                      Requested {new Date(waitingUser.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
                <div className="waiting-user-actions">
                  <button 
                    className="btn-approve"
                    onClick={() => approveUser(waitingUser.userId, waitingUser.userName)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Approve
                  </button>
                  <button 
                    className="btn-reject"
                    onClick={() => rejectUser(waitingUser.userId, waitingUser.userName)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showResumePrompt && (
        <div className="modal-overlay">
          <div className="modal-content resume-screen-share-modal" onClick={(e) => e.stopPropagation()}>
            <div className="resume-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
                <circle cx="12" cy="10" r="3" fill="currentColor" />
              </svg>
            </div>
            <h2>Resume Screen Sharing?</h2>
            <p className="modal-description">
              You were sharing your screen before the page refreshed. Would you like to resume screen sharing?
            </p>
            <div className="resume-note">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span>Other users are waiting to see your screen</span>
            </div>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={handleDeclineResume}>
                No, Stop Sharing
              </button>
              <button className="btn-resume-share" onClick={handleResumeScreenShare}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                  <line x1="8" y1="21" x2="16" y2="21" />
                  <line x1="12" y1="17" x2="12" y2="21" />
                </svg>
                Yes, Resume Sharing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhiteboardRoom;
