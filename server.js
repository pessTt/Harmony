const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.get('/', (req, res) => {
  res.send('Screen sharing app server is running! ✅');
});
app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const PORT = process.env.PORT || 3000;

const rooms = new Map();

function getRoomUsers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.entries()).map(([id, data]) => ({
    id,
    username: data.username,
    avatar: data.avatar || null,
  }));
}

io.on('connection', (socket) => {
  console.log(`🔌 Connected: ${socket.id}`);

  let currentRoom = null;
  let currentUsername = null;

  socket.on('join-room', ({ roomId, username, avatar }) => {
    currentRoom = roomId;
    currentUsername = username;

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    const room = rooms.get(roomId);

    socket.to(roomId).emit('user-joined', { id: socket.id, username, avatar });

    room.set(socket.id, { username, avatar });
    socket.join(roomId);

    socket.emit('room-users', getRoomUsers(roomId).filter((u) => u.id !== socket.id));

    console.log(`👤 ${username} joined room ${roomId}`);
  });

  socket.on('profile-updated', ({ roomId, avatar }) => {
    if (currentRoom && rooms.has(currentRoom)) {
      const data = rooms.get(currentRoom).get(socket.id);
      if (data) data.avatar = avatar;
    }
    socket.to(roomId).emit('profile-updated', { id: socket.id, avatar });
  });

  socket.on('chat-message', ({ roomId, message, username }) => {
    io.to(roomId).emit('chat-message', {
      id: socket.id,
      username,
      message,
      timestamp: Date.now(),
    });
  });

  socket.on('webrtc-offer', ({ to, offer }) => {
    io.to(to).emit('webrtc-offer', { from: socket.id, offer });
  });

  socket.on('webrtc-answer', ({ to, answer }) => {
    io.to(to).emit('webrtc-answer', { from: socket.id, answer });
  });

  socket.on('webrtc-ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('webrtc-ice-candidate', { from: socket.id, candidate });
  });

  socket.on('media-state-changed', ({ roomId, kind, enabled }) => {
    socket.to(roomId).emit('media-state-changed', { id: socket.id, kind, enabled });
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      rooms.get(currentRoom).delete(socket.id);
      if (rooms.get(currentRoom).size === 0) {
        rooms.delete(currentRoom);
      }
      socket.to(currentRoom).emit('user-left', { id: socket.id, username: currentUsername });
    }
    console.log(`❌ Disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
