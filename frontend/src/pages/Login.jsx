import { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import GoogleSignIn from '../components/GoogleSignIn';
import sketchBoardLogo from '../assets/sketchBoard.png';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Login failed';
      setError(errorMessage);
      
      // Show specific message for OAuth users
      if (err.response?.data?.authProvider === 'google') {
        setError('This account uses Google Sign-In. Please use the Google button below.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = () => {
    navigate('/dashboard');
  };

  const handleGoogleError = (error) => {
    setError('Google sign-in failed. Please try again.');
    console.error('Google sign-in error:', error);
  };

  return (
    <div className="auth-container">
      <div className="auth-logo">
        <div className="auth-logo-icon">
          <img src={sketchBoardLogo} alt="SketchBoard" className="logo-image" />
        </div>
        <h1>SketchBoard</h1>
        <p>Real-time collaboration made simple</p>
      </div>

      <div className="auth-card">
        <h2>Log in to your account</h2>
        
        {/* Google Sign-In */}
        <div className="oauth-section">
          <GoogleSignIn 
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
          />
        </div>

        <div className="divider">
          <span>or continue with email</span>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account? <Link to="/register">Create one</Link>
        </div>
      </div>

      <div className="auth-back">
        <Link to="/">← Back to Home</Link>
      </div>
    </div>
  );
};

export default Login;
