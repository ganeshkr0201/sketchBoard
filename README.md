# SketchBoard - Real-Time Collaborative Whiteboard

A professional full-stack MERN application for real-time collaborative whiteboarding with features similar to Zoom Whiteboard and Miro.

![SketchBoard](https://img.shields.io/badge/SketchBoard-v1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### Core Features (Mandatory)
✅ User authentication (Register/Login/Logout with JWT)
✅ Create and join whiteboard rooms via unique Room ID
✅ Real-time drawing synchronization using Socket.io
✅ Canvas tools: Pencil, Eraser, Clear Board
✅ Color picker and brush size selection
✅ Room-based multi-user collaboration
✅ Chat feature inside whiteboard room
✅ Persistent storage of whiteboard sessions in MongoDB
✅ Responsive UI using React Hooks (useState, useEffect, useRef)

### Intermediate Features
✅ Undo/Redo functionality
✅ Save whiteboard snapshot as image
✅ User presence indicator (who is online)
✅ Protected routes in frontend
✅ Role-based permissions (Host/Participant)
✅ Proper error handling and validation

### Advanced Features
✅ Screen sharing using WebRTC
✅ File sharing inside room
✅ Session recording (save as video)
✅ Dark/Light mode toggle
✅ Production-ready architecture

## Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- Socket.io for real-time communication
- JWT for authentication
- Multer for file uploads
- bcryptjs for password hashing

### Frontend
- React.js with Vite
- React Router for navigation
- Socket.io-client
- Context API for state management
- HTML5 Canvas for drawing
- Axios for API calls

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Update `.env` with your configuration:
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/whiteboard
JWT_SECRET=your_secret_key_here
CLIENT_URL=http://localhost:5173
```

5. Create uploads directory:
```bash
mkdir uploads
```

6. Start the server:
```bash
npm run dev
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open browser at `http://localhost:5173`

## Usage

1. Register a new account or login
2. Create a new room or join existing room with Room ID
3. Start drawing collaboratively with other users
4. Use chat to communicate
5. Share files with room participants
6. Share your screen if needed

## API Endpoints

### Authentication
- POST `/api/auth/register` - Register new user
- POST `/api/auth/login` - Login user
- GET `/api/auth/profile` - Get user profile (protected)

### Rooms
- POST `/api/rooms/create` - Create new room (protected)
- POST `/api/rooms/join` - Join existing room (protected)
- GET `/api/rooms/:roomId` - Get room details (protected)
- POST `/api/rooms/save` - Save canvas state (protected)

### Files
- POST `/api/files/upload` - Upload file (protected)

## Socket Events

### Room Events
- `join-room` - Join a room
- `leave-room` - Leave a room
- `user-joined` - Notify when user joins
- `user-left` - Notify when user leaves
- `update-users` - Update users list

### Drawing Events
- `draw` - Draw on canvas
- `erase` - Erase from canvas
- `clear-board` - Clear entire canvas
- `undo` - Undo last action
- `redo` - Redo last undone action
- `canvas-state` - Sync canvas state

### Chat Events
- `send-message` - Send chat message
- `receive-message` - Receive chat message
- `chat-history` - Load chat history

### File Events
- `file-uploaded` - File uploaded notification
- `file-received` - Receive file notification

### WebRTC Events
- `offer` - WebRTC offer
- `answer` - WebRTC answer
- `ice-candidate` - ICE candidate exchange
- `start-screen-share` - Start screen sharing
- `stop-screen-share` - Stop screen sharing

## Deployment

### Backend (Render/Railway)
1. Push code to GitHub
2. Connect repository to Render/Railway
3. Set environment variables
4. Deploy

### Frontend (Vercel/Netlify)
1. Build the project: `npm run build`
2. Deploy the `dist` folder
3. Update API URL in production

### Database (MongoDB Atlas)
1. Create cluster on MongoDB Atlas
2. Get connection string
3. Update MONGO_URI in backend

## License

MIT
