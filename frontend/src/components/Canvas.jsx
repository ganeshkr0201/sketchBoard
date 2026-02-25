import { useRef, useEffect, useState, useContext } from 'react';
import { SocketContext } from '../context/SocketContext';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import './Canvas.css';

const Canvas = ({ roomId, tool, color, brushSize, canDraw, onSnapshot }) => {
  const canvasRef = useRef(null);
  const { socket } = useContext(SocketContext);
  const { user } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState(null);
  const [currentPath, setCurrentPath] = useState([]);
  const [allStrokes, setAllStrokes] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  // Get theme-aware colors
  const getCanvasBackgroundColor = () => {
    return theme === 'dark' ? '#1a1a1a' : '#ffffff';
  };

  const getEraserColor = () => {
    return theme === 'dark' ? '#1a1a1a' : '#ffffff';
  };

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Make canvas responsive to container size
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      const width = container.clientWidth - 32; // Account for padding
      const height = container.clientHeight - 32;
      
      // Store current canvas data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      canvas.width = width;
      canvas.height = height;
      
      // Restore canvas data
      ctx.fillStyle = getCanvasBackgroundColor();
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.putImageData(imageData, 0, 0);
      
      // Redraw all strokes
      if (allStrokes.length > 0) {
        redrawCanvas(allStrokes.slice(0, currentIndex + 1));
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    setContext(ctx);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Redraw canvas when theme changes
  useEffect(() => {
    if (context && allStrokes.length > 0) {
      redrawCanvas(allStrokes.slice(0, currentIndex + 1));
    } else if (context) {
      // Just update background color if no strokes
      context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      context.fillStyle = getCanvasBackgroundColor();
      context.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, [theme, context]);

  // Clear and redraw canvas
  const redrawCanvas = (strokes) => {
    if (!context) return;
    
    // Clear canvas
    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    context.fillStyle = getCanvasBackgroundColor();
    context.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Draw all strokes
    strokes.forEach(stroke => {
      if (!stroke.points || stroke.points.length === 0) return;

      context.strokeStyle = stroke.type === 'erase' ? getEraserColor() : (stroke.color || '#000000');
      context.lineWidth = stroke.brushSize || 2;
      context.lineCap = 'round';
      context.lineJoin = 'round';

      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      
      for (let i = 1; i < stroke.points.length; i++) {
        context.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      
      context.stroke();
      context.closePath();
    });
  };

  // Socket event listeners
  useEffect(() => {
    if (!socket || !context) return;

    const handleCanvasState = (canvasData) => {
      console.log('📥 Received canvas state:', canvasData?.length, 'strokes');
      if (canvasData && canvasData.length > 0) {
        setAllStrokes(canvasData);
        setCurrentIndex(canvasData.length - 1);
        redrawCanvas(canvasData);
      }
    };

    const handleDraw = (drawData) => {
      console.log('✏️ Received draw from other user');
      setAllStrokes(prev => {
        const newStrokes = [...prev, drawData];
        setCurrentIndex(newStrokes.length - 1);
        setTimeout(() => redrawCanvas(newStrokes), 0);
        return newStrokes;
      });
    };

    const handleErase = (eraseData) => {
      console.log('🧹 Received erase from other user');
      setAllStrokes(prev => {
        const newStrokes = [...prev, eraseData];
        setCurrentIndex(newStrokes.length - 1);
        setTimeout(() => redrawCanvas(newStrokes), 0);
        return newStrokes;
      });
    };

    const handleClearBoard = () => {
      console.log('🗑️ Clear board received');
      setAllStrokes([]);
      setCurrentIndex(-1);
      if (context) {
        context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        context.fillStyle = getCanvasBackgroundColor();
        context.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };

    const handleUndo = () => {
      setAllStrokes(currentStrokes => {
        setCurrentIndex(prevIndex => {
          console.log('↶ Undo - current index:', prevIndex, 'total strokes:', currentStrokes.length);
          if (prevIndex >= 0) {
            const newIndex = prevIndex - 1;
            const strokesToShow = currentStrokes.slice(0, newIndex + 1);
            console.log('Redrawing with', strokesToShow.length, 'strokes');
            setTimeout(() => redrawCanvas(strokesToShow), 0);
            return newIndex;
          }
          return prevIndex;
        });
        return currentStrokes;
      });
    };

    const handleRedo = () => {
      setAllStrokes(currentStrokes => {
        setCurrentIndex(prevIndex => {
          console.log('↷ Redo - current index:', prevIndex, 'total strokes:', currentStrokes.length);
          if (prevIndex < currentStrokes.length - 1) {
            const newIndex = prevIndex + 1;
            const strokesToShow = currentStrokes.slice(0, newIndex + 1);
            console.log('Redrawing with', strokesToShow.length, 'strokes');
            setTimeout(() => redrawCanvas(strokesToShow), 0);
            return newIndex;
          }
          return prevIndex;
        });
        return currentStrokes;
      });
    };

    socket.on('canvas-state', handleCanvasState);
    socket.on('draw', handleDraw);
    socket.on('erase', handleErase);
    socket.on('clear-board', handleClearBoard);
    socket.on('undo', handleUndo);
    socket.on('redo', handleRedo);

    return () => {
      socket.off('canvas-state', handleCanvasState);
      socket.off('draw', handleDraw);
      socket.off('erase', handleErase);
      socket.off('clear-board', handleClearBoard);
      socket.off('undo', handleUndo);
      socket.off('redo', handleRedo);
    };
  }, [socket, context]);

  const startDrawing = (e) => {
    if (!context || !canDraw) return;
    
    setIsDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCurrentPath([{ x, y }]);
    
    context.beginPath();
    context.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing || !context || !canDraw) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    context.strokeStyle = tool === 'eraser' ? getEraserColor() : color;
    context.lineWidth = brushSize;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    context.lineTo(x, y);
    context.stroke();

    setCurrentPath(prev => [...prev, { x, y }]);
  };

  const stopDrawing = () => {
    if (!isDrawing || !context || !canDraw) return;
    
    setIsDrawing(false);
    context.closePath();

    if (currentPath.length > 0 && user) {
      const userId = String(user._id || user.id);
      const strokeData = {
        type: tool === 'eraser' ? 'erase' : 'draw',
        points: currentPath,
        color: color,
        brushSize: brushSize,
        userId: userId
      };

      // Add to local history (remove any future strokes if we drew after undo)
      setAllStrokes(prev => {
        const newStrokes = [...prev.slice(0, currentIndex + 1), strokeData];
        console.log('✏️ New stroke added. Total strokes:', newStrokes.length, 'Current index will be:', newStrokes.length - 1);
        setCurrentIndex(newStrokes.length - 1);
        return newStrokes;
      });

      // Emit to server
      if (socket) {
        const eventName = strokeData.type === 'erase' ? 'erase' : 'draw';
        const dataKey = strokeData.type === 'erase' ? 'eraseData' : 'drawData';
        socket.emit(eventName, {
          roomId,
          [dataKey]: strokeData
        });
      }
    }

    setCurrentPath([]);
  };

  // Expose snapshot function to parent component
  useEffect(() => {
    if (onSnapshot && typeof onSnapshot === 'function') {
      onSnapshot(handleSnapshot);
    }
  }, []); // Empty dependency array - only run once on mount

  const handleSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      // Create a temporary canvas with white background for better image quality
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      
      // Fill with white background
      tempCtx.fillStyle = '#ffffff';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      // Draw the original canvas on top
      tempCtx.drawImage(canvas, 0, 0);
      
      // Convert to blob and download
      tempCanvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        // Create a user-friendly filename with room name if available
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const roomName = window.location.pathname.split('/').pop() || 'room';
        a.download = `sketchboard-${roomName}-${timestamp}.png`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 'image/png');
      
      console.log('📸 Canvas snapshot taken');
    } catch (error) {
      console.error('Error taking snapshot:', error);
      alert('Failed to take snapshot. Please try again.');
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className="canvas"
      style={{ cursor: canDraw ? 'crosshair' : 'not-allowed' }}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
    />
  );
};

export default Canvas;
