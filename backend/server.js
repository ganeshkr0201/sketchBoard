require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const session = require('express-session');
const passport = require('./config/passport');
const connectDB = require('./config/db');
const socketHandler = require('./sockets/socketHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

connectDB();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json());

// Session configuration for passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

app.use('/uploads', express.static('uploads'));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/files', require('./routes/fileRoutes'));

socketHandler(io);

app.get('/', (req, res) => {
  res.json({ 
    message: 'SketchBoard API',
    version: '1.0.0',
    status: 'running',
    features: ['OAuth 2.0', 'Real-time collaboration', 'File sharing']
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`OAuth enabled: ${!!process.env.GOOGLE_CLIENT_ID}`);
});
