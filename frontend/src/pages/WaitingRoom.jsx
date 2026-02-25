import { useEffect, useState, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SocketContext } from '../context/SocketContext';
import { AuthContext } from '../context/AuthContext';
import sketchBoardLogo from '../assets/sketchBoard.png';
import './WaitingRoom.css';

const WaitingRoom = () => {
  const { roomId } = useParams();
  const { socket } = useContext(SocketContext);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [roomName, setRoomName] = useState('');
  const [status, setStatus] = useState('requesting');

  useEffect(() => {
    if (socket && user) {
      const userId = String(user._id || user.id);
      
      // Request to join the room
      socket.emit('request-join', {
        roomId,
        userId,
        userName: user.name
      });

      const handleWaitingForApproval = (data) => {
        setRoomName(data.roomName);
        setStatus('waiting');
      };

      const handleJoinApproved = (data) => {
        if (String(data.userId) === userId) {
          setStatus('approved');
          navigate(`/room/${data.roomId}`);
        }
      };

      const handleJoinRejected = (data) => {
        if (String(data.userId) === userId) {
          setStatus('rejected');
          alert(data.message);
          setTimeout(() => navigate('/dashboard'), 2000);
        }
      };

      socket.on('waiting-for-approval', handleWaitingForApproval);
      socket.on('join-approved', handleJoinApproved);
      socket.on('join-rejected', handleJoinRejected);

      return () => {
        socket.off('waiting-for-approval', handleWaitingForApproval);
        socket.off('join-approved', handleJoinApproved);
        socket.off('join-rejected', handleJoinRejected);
      };
    }
  }, [socket, user, roomId, navigate]);

  return (
    <div className="waiting-room">
      <div className="waiting-header">
        <div className="waiting-logo">
          <img src={sketchBoardLogo} alt="SketchBoard" className="logo-image" />
          <span>SketchBoard</span>
        </div>
      </div>
      <div className="waiting-content">
        <div className="waiting-icon">
          {status === 'waiting' && (
            <svg className="spinner" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
            </svg>
          )}
          {status === 'rejected' && (
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )}
        </div>
        <h1>
          {status === 'requesting' && 'Requesting to Join...'}
          {status === 'waiting' && 'Waiting for Approval'}
          {status === 'rejected' && 'Request Denied'}
        </h1>
        <p>
          {status === 'requesting' && 'Sending join request...'}
          {status === 'waiting' && `The host of "${roomName}" will review your request shortly.`}
          {status === 'rejected' && 'Redirecting to dashboard...'}
        </p>
        {status === 'waiting' && (
          <button className="btn-cancel-request" onClick={() => navigate('/dashboard')}>
            Cancel Request
          </button>
        )}
      </div>
    </div>
  );
};

export default WaitingRoom;
