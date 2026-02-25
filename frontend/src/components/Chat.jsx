import { useState, useEffect, useContext, useRef } from 'react';
import { SocketContext } from '../context/SocketContext';
import { AuthContext } from '../context/AuthContext';
import './Chat.css';

const Chat = ({ roomId }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const { socket } = useContext(SocketContext);
  const { user } = useContext(AuthContext);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('chat-history', (history) => {
      setMessages(history);
    });

    socket.on('receive-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    return () => {
      socket.off('chat-history');
      socket.off('receive-message');
    };
  }, [socket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    
    if (inputMessage.trim() && socket) {
      socket.emit('send-message', {
        roomId,
        userId: user.id,
        userName: user.name,
        message: inputMessage
      });
      setInputMessage('');
    }
  };

  return (
    <div className="chat">
      <h3>Chat</h3>
      <div className="messages">
        {messages.map((msg, index) => (
          <div key={index} className="message">
            <strong>{msg.userName}:</strong> {msg.message}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
};

export default Chat;
