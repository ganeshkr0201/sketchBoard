import { useContext } from 'react';
import { SocketContext } from '../context/SocketContext';
import './Toolbar.css';

const Toolbar = ({ tool, setTool, color, setColor, brushSize, setBrushSize, roomId }) => {
  const { socket } = useContext(SocketContext);

  const handleClear = () => {
    if (socket) {
      socket.emit('clear-board', { roomId });
    }
  };

  const handleUndo = () => {
    if (socket) {
      socket.emit('undo', { roomId });
    }
  };

  const handleRedo = () => {
    if (socket) {
      socket.emit('redo', { roomId });
    }
  };

  return (
    <div className="toolbar">
      <button
        className={`tool-btn ${tool === 'pencil' ? 'active' : ''}`}
        onClick={() => setTool('pencil')}
        title="Pen"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19l7-7 3 3-7 7-3-3z"/>
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
          <path d="M2 2l7.586 7.586"/>
          <circle cx="11" cy="11" r="2"/>
        </svg>
      </button>

      <button
        className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
        onClick={() => setTool('eraser')}
        title="Eraser"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 20H7L3 16c-1-1-1-2.5 0-3.5l9.5-9.5c1-1 2.5-1 3.5 0l5.5 5.5c1 1 1 2.5 0 3.5L13 20"/>
          <path d="M7 20l6-6"/>
        </svg>
      </button>

      <div className="color-picker">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          title="Color"
        />
      </div>

      <div className="brush-size">
        <label>Size: {brushSize}</label>
        <input
          type="range"
          min="1"
          max="20"
          value={brushSize}
          onChange={(e) => setBrushSize(Number(e.target.value))}
        />
      </div>

      <button onClick={handleUndo} title="Undo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 7v6h6"/>
          <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
        </svg>
      </button>

      <button onClick={handleRedo} title="Redo">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 7v6h-6"/>
          <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/>
        </svg>
      </button>

      <button onClick={handleClear} title="Clear" className="clear-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
        </svg>
      </button>
    </div>
  );
};

export default Toolbar;
