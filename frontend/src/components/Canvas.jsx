import { useRef, useEffect, useState, useContext, useCallback } from 'react';
import { SocketContext } from '../context/SocketContext';
import { AuthContext } from '../context/AuthContext';
import { ThemeContext } from '../context/ThemeContext';
import './Canvas.css';

const Canvas = ({ roomId, tool, color, brushSize, canDraw, onSnapshot }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const { socket } = useContext(SocketContext);
  const { user } = useContext(AuthContext);
  const { theme } = useContext(ThemeContext);
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState(null);
  const [currentPath, setCurrentPath] = useState([]);
  const [allStrokes, setAllStrokes] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  
  // Pan and zoom state
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  
  // Virtual canvas size (infinite canvas)
  const VIRTUAL_WIDTH = 10000;
  const VIRTUAL_HEIGHT = 10000;

  // Get theme-aware colors
  const getCanvasBackgroundColor = () => {
    return theme === 'dark' ? '#1a1a1a' : '#ffffff';
  };

  const getGridColor = () => {
    return theme === 'dark' ? '#2a2a2a' : '#f0f0f0';
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
      const width = container.clientWidth;
      const height = container.clientHeight;
      
      canvas.width = width;
      canvas.height = height;
      
      // Center the view initially
      if (offset.x === 0 && offset.y === 0) {
        setOffset({
          x: (width - VIRTUAL_WIDTH * scale) / 2,
          y: (height - VIRTUAL_HEIGHT * scale) / 2
        });
      }
      
      // Redraw
      if (allStrokes.length > 0) {
        redrawCanvas(allStrokes.slice(0, currentIndex + 1));
      } else {
        drawGrid(ctx);
      }
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    setContext(ctx);
    
    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  // Draw grid for infinite canvas feel
  const drawGrid = useCallback((ctx) => {
    if (!ctx) return;
    
    const canvas = canvasRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getCanvasBackgroundColor();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = getGridColor();
    ctx.lineWidth = 1;
    
    const gridSize = 50 * scale;
    const startX = offset.x % gridSize;
    const startY = offset.y % gridSize;
    
    // Vertical lines
    for (let x = startX; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = startY; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }, [offset, scale, theme]);

  // Redraw canvas when theme changes
  useEffect(() => {
    if (context && allStrokes.length > 0) {
      redrawCanvas(allStrokes.slice(0, currentIndex + 1));
    } else if (context) {
      drawGrid(context);
    }
  }, [theme, context, offset, scale]);

  // Clear and redraw canvas
  const redrawCanvas = useCallback((strokes) => {
    if (!context) return;
    
    const canvas = canvasRef.current;
    
    // Draw grid first
    drawGrid(context);
    
    // Save context state
    context.save();
    
    // Apply transformations
    context.translate(offset.x, offset.y);
    context.scale(scale, scale);
    
    // Draw all strokes
    strokes.forEach(stroke => {
      if (!stroke.points || stroke.points.length === 0) return;

      context.strokeStyle = stroke.type === 'erase' ? getEraserColor() : (stroke.color || '#000000');
      context.lineWidth = (stroke.brushSize || 2) / scale; // Adjust line width for zoom
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
    
    // Restore context state
    context.restore();
  }, [context, offset, scale, theme]);

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
        drawGrid(context);
      }
    };

    const handleUndo = () => {
      setAllStrokes(currentStrokes => {
        setCurrentIndex(prevIndex => {
          if (prevIndex >= 0) {
            const newIndex = prevIndex - 1;
            const strokesToShow = currentStrokes.slice(0, newIndex + 1);
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
          if (prevIndex < currentStrokes.length - 1) {
            const newIndex = prevIndex + 1;
            const strokesToShow = currentStrokes.slice(0, newIndex + 1);
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
  }, [socket, context, redrawCanvas]);

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = (screenX, screenY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (screenX - rect.left - offset.x) / scale;
    const y = (screenY - rect.top - offset.y) / scale;
    return { x, y };
  };

  // Mouse/Touch event handlers
  const handlePointerDown = (e) => {
    if (!context) return;
    
    const isMiddleClick = e.button === 1;
    const isShiftPressed = e.shiftKey; // Shift for panning
    
    if (isMiddleClick || isShiftPressed || !canDraw) {
      // Start panning
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      e.preventDefault();
    } else if (canDraw) {
      // Start drawing
      setIsDrawing(true);
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      setCurrentPath([{ x, y }]);
      
      context.save();
      context.translate(offset.x, offset.y);
      context.scale(scale, scale);
      context.beginPath();
      context.moveTo(x, y);
      context.restore();
    }
  };

  const handlePointerMove = (e) => {
    if (!context) return;
    
    if (isPanning) {
      // Pan the canvas
      const newOffset = {
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      };
      setOffset(newOffset);
      redrawCanvas(allStrokes.slice(0, currentIndex + 1));
    } else if (isDrawing && canDraw) {
      // Draw
      const { x, y } = screenToCanvas(e.clientX, e.clientY);
      
      context.save();
      context.translate(offset.x, offset.y);
      context.scale(scale, scale);
      
      context.strokeStyle = tool === 'eraser' ? getEraserColor() : color;
      context.lineWidth = brushSize / scale;
      context.lineCap = 'round';
      context.lineJoin = 'round';

      context.lineTo(x, y);
      context.stroke();
      
      context.restore();

      setCurrentPath(prev => [...prev, { x, y }]);
    }
  };

  const handlePointerUp = () => {
    if (isPanning) {
      setIsPanning(false);
    } else if (isDrawing && canDraw) {
      setIsDrawing(false);
      
      if (currentPath.length > 0 && user) {
        const userId = String(user._id || user.id);
        const strokeData = {
          type: tool === 'eraser' ? 'erase' : 'draw',
          points: currentPath,
          color: color,
          brushSize: brushSize,
          userId: userId
        };

        // Add to local history
        setAllStrokes(prev => {
          const newStrokes = [...prev.slice(0, currentIndex + 1), strokeData];
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
    }
  };

  // Scroll to pan, Shift+Scroll to zoom
  const handleWheel = (e) => {
    e.preventDefault();
    
    if (e.shiftKey) {
      // Shift + Scroll = Zoom
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(0.1, scale * delta), 5);
      
      // Zoom towards mouse position
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const newOffset = {
        x: mouseX - (mouseX - offset.x) * (newScale / scale),
        y: mouseY - (mouseY - offset.y) * (newScale / scale)
      };
      
      setScale(newScale);
      setOffset(newOffset);
    } else {
      // Regular Scroll = Pan
      const panSpeed = 1;
      const newOffset = {
        x: offset.x - e.deltaX * panSpeed,
        y: offset.y - e.deltaY * panSpeed
      };
      setOffset(newOffset);
    }
    
    redrawCanvas(allStrokes.slice(0, currentIndex + 1));
  };

  // Touch events for mobile
  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      // Two finger pinch to zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setLastTouchDistance(distance);
      setIsPanning(true);
    } else if (e.touches.length === 1 && canDraw) {
      // Single finger draw
      const touch = e.touches[0];
      const { x, y } = screenToCanvas(touch.clientX, touch.clientY);
      setIsDrawing(true);
      setCurrentPath([{ x, y }]);
    }
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    
    if (e.touches.length === 2) {
      // Pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      
      if (lastTouchDistance > 0) {
        const delta = distance / lastTouchDistance;
        const newScale = Math.min(Math.max(0.1, scale * delta), 5);
        setScale(newScale);
        redrawCanvas(allStrokes.slice(0, currentIndex + 1));
      }
      
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && isDrawing && canDraw) {
      // Draw
      const touch = e.touches[0];
      const { x, y } = screenToCanvas(touch.clientX, touch.clientY);
      
      context.save();
      context.translate(offset.x, offset.y);
      context.scale(scale, scale);
      
      context.strokeStyle = tool === 'eraser' ? getEraserColor() : color;
      context.lineWidth = brushSize / scale;
      context.lineCap = 'round';
      context.lineJoin = 'round';

      context.lineTo(x, y);
      context.stroke();
      
      context.restore();

      setCurrentPath(prev => [...prev, { x, y }]);
    }
  };

  const handleTouchEnd = () => {
    setLastTouchDistance(0);
    handlePointerUp();
  };

  // Expose snapshot function
  useEffect(() => {
    if (onSnapshot && typeof onSnapshot === 'function') {
      onSnapshot(handleSnapshot);
    }
  }, []);

  const handleSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
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

  // Reset zoom and pan
  const resetView = () => {
    setScale(1);
    const canvas = canvasRef.current;
    setOffset({
      x: (canvas.width - VIRTUAL_WIDTH) / 2,
      y: (canvas.height - VIRTUAL_HEIGHT) / 2
    });
    redrawCanvas(allStrokes.slice(0, currentIndex + 1));
  };

  return (
    <div ref={containerRef} className="infinite-canvas-container">
      <canvas
        ref={canvasRef}
        className="canvas infinite-canvas"
        style={{ 
          cursor: isPanning ? 'grabbing' : (canDraw ? 'crosshair' : 'not-allowed'),
          touchAction: 'none'
        }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      <div className="canvas-controls">
        <button 
          className="canvas-control-btn" 
          onClick={() => setScale(Math.min(scale * 1.2, 5))}
          title="Zoom In"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <span className="zoom-level">{Math.round(scale * 100)}%</span>
        <button 
          className="canvas-control-btn" 
          onClick={() => setScale(Math.max(scale * 0.8, 0.1))}
          title="Zoom Out"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
        </button>
        <button 
          className="canvas-control-btn" 
          onClick={resetView}
          title="Reset View"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
          </svg>
        </button>
      </div>
      <div className="canvas-hint">
        💡 Scroll to pan • Shift+Scroll to zoom • Shift+Drag to pan
      </div>
    </div>
  );
};

export default Canvas;