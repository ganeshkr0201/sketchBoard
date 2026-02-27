import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import sketchBoardLogo from '../assets/sketchBoard.png';
import axios from 'axios';
import './Dashboard.css';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api`;

const Dashboard = () => {
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [recentRooms, setRecentRooms] = useState([]);
  const [error, setError] = useState('');
  const { user, token, logout } = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(ThemeContext);
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
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="dashboard-page">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-brand">
          <div className="brand-icon">
            <img src={sketchBoardLogo} alt="SketchBoard" />
          </div>
          <span>SketchBoard</span>
        </div>
        
        <div className="header-actions">
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'light' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            )}
          </button>
          
          <button className="profile-btn" onClick={() => navigate('/profile')}>
            <div className="profile-avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} />
              ) : (
                <span>{user?.name?.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <span>{user?.name}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="dashboard-hero">
          <h1>Welcome back, {user?.name?.split(' ')[0]}</h1>
          <p>Create a new whiteboard or join an existing session to start collaborating</p>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          <div className="action-card create-card">
            <div className="card-header">
              <div className="card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              <h3>Create Room</h3>
            </div>
            <p>Start a new collaborative whiteboard session</p>
            <button className="action-btn primary" onClick={() => setShowCreateModal(true)}>
              Create New Room
            </button>
          </div>

          <div className="action-card join-card">
            <div className="card-header">
              <div className="card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" y1="12" x2="3" y2="12" />
                </svg>
              </div>
              <h3>Join Room</h3>
            </div>
            <p>Enter a room code to join an existing session</p>
            <div className="join-form">
              <input
                type="text"
                placeholder="Enter room code"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
              />
              <button className="action-btn secondary" onClick={joinRoom}>
                Join
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-message">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}

        {/* Recent Rooms */}
        {recentRooms.length > 0 && (
          <div className="recent-section">
            <div className="section-header">
              <h2>Recent Rooms</h2>
              <span className="room-count">{recentRooms.length} rooms</span>
            </div>
            
            <div className="rooms-grid">
              {recentRooms.map((room) => (
                <div key={room.roomId} className="room-card" onClick={() => openRoom(room.roomId)}>
                  <div className="room-header">
                    <h3>{room.roomName}</h3>
                    <div className="room-status">
                      <div className="status-dot"></div>
                      Active
                    </div>
                  </div>
                  
                  <div className="room-meta">
                    <div className="meta-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      {room.participants} members
                    </div>
                    
                    <div className="meta-item">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      {getTimeAgo(room.lastActivity)}
                    </div>
                  </div>
                  
                  <div className="room-footer">
                    <span className="room-id">#{room.roomId}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="7" y1="17" x2="17" y2="7" />
                      <polyline points="7 7 17 7 17 17" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="create-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Room</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="input-group">
                <label>Room Name</label>
                <input
                  type="text"
                  placeholder="Enter room name"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  autoFocus
                />
              </div>
              
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isPrivate}
                    onChange={(e) => setIsPrivate(e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  Private room (requires approval to join)
                </label>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="btn-create" onClick={createRoom}>
                Create Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
