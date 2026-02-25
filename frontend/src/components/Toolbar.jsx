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
        className={tool === 'pencil' ? 'active' : ''}
        onClick={() => setTool('pencil')}
        title="Pencil"
      >
        ✏️
      </button>

      <button
        className={tool === 'eraser' ? 'active' : ''}
        onClick={() => setTool('eraser')}
        title="Eraser"
      >
        🧹
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
        ↶
      </button>

      <button onClick={handleRedo} title="Redo">
        ↷
      </button>

      <button onClick={handleClear} title="Clear" className="clear-btn">
        🗑️
      </button>
    </div>
  );
};

export default Toolbar;
