// Servidor de sinalizacao para o app de chamadas com amigos.
// Este servidor NAO transporta audio/video/tela - ele so ajuda os
// computadores dos amigos a se encontrarem e trocarem informacoes
// tecnicas (WebRTC signaling). O audio/video/tela viaja direto
// entre os PCs (peer-to-peer), entao o servidor pode ser bem simples
// e gratuito.

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.get('/', (req, res) => {
  res.send('Servidor do app de chamadas está no ar! ✅');
});
// Rota simples de saude, util para "keep-alive" em hospedagens free
app.get('/health', (req, res) => res.json({ ok: true, rooms: rooms.size }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

const PORT = process.env.PORT || 3000;

// Estrutura em memoria: sala -> Map(socketId -> { username })
const rooms = new Map();

function getRoomUsers(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.entries()).map(([id, data]) => ({
    id,
    username: data.username,
    avatar: data.avatar || null,
    color: data.color || null,
  }));
}

io.on('connection', (socket) => {
  console.log(`🔌 Conectado: ${socket.id}`);

  let currentRoom = null;
  let currentUsername = null;

  socket.on('join-room', ({ roomId, username, avatar, color }) => {
    currentRoom = roomId;
    currentUsername = username;

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    const room = rooms.get(roomId);

    // Avisa aos que ja estao na sala que alguem novo chegou
    socket.to(roomId).emit('user-joined', { id: socket.id, username, avatar, color });

    room.set(socket.id, { username, avatar, color });
    socket.join(roomId);

    // Manda para o novo usuario a lista de quem ja esta na sala
    socket.emit('room-users', getRoomUsers(roomId).filter((u) => u.id !== socket.id));

    console.log(`👤 ${username} entrou na sala ${roomId}`);
  });

  // Alguem trocou a foto de perfil ou a cor da borda em tempo real
  socket.on('profile-updated', ({ roomId, avatar, color }) => {
    if (currentRoom && rooms.has(currentRoom)) {
      const room = rooms.get(currentRoom);
      const data = room.get(socket.id);
      if (data) {
        if (avatar !== undefined) data.avatar = avatar;
        if (color !== undefined) data.color = color;
      }
    }
    socket.to(roomId).emit('profile-updated', { id: socket.id, avatar, color });
  });

  socket.on('chat-message', ({ roomId, message, username }) => {
    io.to(roomId).emit('chat-message', {
      id: socket.id,
      username,
      message,
      timestamp: Date.now(),
    });
  });

  // --- Sinalizacao WebRTC (repassa mensagens entre pares) ---
  socket.on('webrtc-offer', ({ to, offer }) => {
    io.to(to).emit('webrtc-offer', { from: socket.id, offer });
  });

  socket.on('webrtc-answer', ({ to, answer }) => {
    io.to(to).emit('webrtc-answer', { from: socket.id, answer });
  });

  socket.on('webrtc-ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('webrtc-ice-candidate', { from: socket.id, candidate });
  });

  // Avisa a sala quando alguem liga/desliga camera, microfone ou tela
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
    console.log(`❌ Desconectado: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
