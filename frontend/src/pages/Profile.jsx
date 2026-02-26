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

  const getAuthProviderDisplay = (provider) => {
    switch (provider) {
      case 'google':
        return { name: 'Google', icon: '🔗', color: 'google' };
      case 'local':
        return { name: 'Email & Password', icon: '📧', color: 'local' };
      default:
        return { name: 'Unknown', icon: '❓', color: 'default' };
    }
  };

  const authProvider = getAuthProviderDisplay(user?.authProvider);

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
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name} className="user-avatar" />
          ) : (
            <span>{user?.name?.charAt(0).toUpperCase()}</span>
          )}
        </div>
        
        <h2>{user?.name}</h2>
        <p className="profile-email">{user?.email}</p>
        
        <div className="auth-provider-info">
          <span className={`auth-provider-badge ${authProvider.color}`}>
            {authProvider.icon} {authProvider.name}
          </span>
        </div>
        
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
          
          {user?.lastLogin && (
            <div className="info-item">
              <span className="info-label">Last login</span>
              <span className="info-value">
                {new Date(user.lastLogin).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          )}
          
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
