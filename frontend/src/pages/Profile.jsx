import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import sketchBoardLogo from '../assets/sketchBoard.png';
import './Profile.css';

const Profile = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="profile-container">
      <div className="profile-logo">
        <div className="profile-logo-icon">
          <img src={sketchBoardLogo} alt="SketchBoard" className="logo-image" />
        </div>
        <h1>SketchBoard</h1>
        <p>Profile Settings</p>
      </div>

      <div className="profile-card">
        <div className="profile-avatar">
          <span>{user?.name?.charAt(0).toUpperCase()}</span>
        </div>
        
        <h2>{user?.name}</h2>
        <p className="profile-email">{user?.email}</p>
        
        <div className="profile-info">
          <div className="info-item">
            <span className="info-label">Member since</span>
            <span className="info-value">
              {new Date(user?.createdAt).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </span>
          </div>
          
          <div className="info-item">
            <span className="info-label">Theme preference</span>
            <span className="info-value">{user?.themePreference || 'Light'}</span>
          </div>
        </div>

        <div className="profile-actions">
          <button className="btn-secondary" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </button>
          <button className="btn-logout" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </div>

      <div className="profile-back">
        <button onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>
      </div>
    </div>
  );
};

export default Profile;
