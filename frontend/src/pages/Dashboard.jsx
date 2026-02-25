import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import sketchBoardLogo from '../assets/sketchBoard.png';
import axios from 'axios';
import './Dashboard.css';

const API_URL = 'http://localhost:3000/api';

const Dashboard = () => {
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [recentRooms, setRecentRooms] = useState([]);
  const [error, setError] = useState('');
  const { user, token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    fetchRecentRooms();
  }, []);

  const fetchRecentRooms = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/rooms/user/recent`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRecentRooms(response.data);
    } catch (err) {
      console.error('Failed to fetch recent rooms:', err);
    }
  };

  const createRoom = async () => {
    try {
      const response = await axios.post(
        `${API_URL}/rooms/create`,
        { roomName: roomName || 'Untitled Room', isPrivate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/room/${response.data.roomId}`);
    } catch (err) {
      setError('Failed to create room');
    }
  };

  const joinRoom = async () => {
    if (!roomId.trim()) {
      setError('Please enter a room code');
      return;
    }

    try {
      await axios.post(
        `${API_URL}/rooms/join`,
        { roomId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/room/${roomId}`);
    } catch (err) {
      if (err.response?.data?.requiresApproval) {
        // Room is private, navigate to waiting room
        navigate(`/room/${roomId}/waiting`);
      } else {
        setError(err.response?.data?.message || 'Failed to join room');
      }
    }
  };

  const openRoom = (roomId) => {
    navigate(`/room/${roomId}`);
  };

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-logo">
          <div className="dashboard-logo-icon">
            <img src={sketchBoardLogo} alt="SketchBoard" className="logo-image" />
          </div>
          SketchBoard
        </div>
        <div className="dashboard-actions">
          <button className="btn-create" onClick={() => setShowCreateModal(true)}>
            + Create Room
          </button>
          <button className="btn-profile" onClick={() => navigate('/profile')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Profile
          </button>
        </div>
      </header>

      <div className="dashboard-content">
        <div className="dashboard-welcome">
          <h1>Welcome back, {user?.name}</h1>
          <p>Start a new session or join an existing one</p>
        </div>

        <div className="dashboard-cards">
          <div className="dashboard-card">
            <div className="card-icon">+</div>
            <h2>Create New Session</h2>
            <p>Start a new collaborative session and invite your team</p>
            <button className="btn-card-primary" onClick={() => setShowCreateModal(true)}>
              Create Room
            </button>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">→</div>
            <h2>Join Existing Room</h2>
            <p>Enter a room code to join an active session</p>
            <input
              type="text"
              placeholder="Enter room code"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />
            <button className="btn-card-secondary" onClick={joinRoom}>
              Join Room
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {recentRooms.length > 0 && (
          <div className="recent-sessions">
            <h2>Recent Sessions</h2>
            
            {recentRooms.map((room) => (
              <div key={room.roomId} className="session-item">
                <div className="session-info">
                  <h3>{room.roomName}</h3>
                  <div className="session-meta">
                    <span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      {room.participants} participants
                    </span>
                    <span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {getTimeAgo(room.lastActivity)}
                    </span>
                    <span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                      {new Date(room.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button className="btn-open" onClick={() => openRoom(room.roomId)}>Open</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Room</h2>
            <input
              type="text"
              placeholder="Enter room name"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              autoFocus
            />
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              <span>Make this room private (require approval to join)</span>
            </label>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="btn-confirm" onClick={createRoom}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
