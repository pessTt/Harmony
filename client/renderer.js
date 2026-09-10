
let socket = null;
let roomId = null;
let username = null;
let myAvatar = null; 

let screenStream = null; 
let screenOn = false;

const peers = new Map(); 


const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const usernameInput = document.getElementById('username-input');
const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');
const loginError = document.getElementById('login-error');
const toggleAdvancedBtn = document.getElementById('toggle-advanced-btn');
const advancedSettings = document.getElementById('advanced-settings');
const serverInput = document.getElementById('server-input');
const avatarPreview = document.getElementById('avatar-preview');
const chooseAvatarBtn = document.getElementById('choose-avatar-btn');
const avatarFileInput = document.getElementById('avatar-file-input');

const roomNameLabel = document.getElementById('room-name-label');
const membersUl = document.getElementById('members-ul');
const videosGrid = document.getElementById('videos-grid');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

const screenBtn = document.getElementById('toggle-screen-btn');
const leaveBtn = document.getElementById('leave-btn');

const screenPickerModal = document.getElementById('screen-picker-modal');
const screenSourcesGrid = document.getElementById('screen-sources-grid');
const cancelScreenShareBtn = document.getElementById('cancel-screen-share');


const savedServerUrl = localStorage.getItem('amigosCall.serverUrl');
serverInput.value = savedServerUrl || window.SERVER_URL || '';

const savedAvatar = localStorage.getItem('amigosCall.avatar');
if (savedAvatar) {
  myAvatar = savedAvatar;
  setAvatarPreview(avatarPreview, savedAvatar, '?');
}

toggleAdvancedBtn.addEventListener('click', () => {
  advancedSettings.classList.toggle('hidden');
});

chooseAvatarBtn.addEventListener('click', () => avatarFileInput.click());
avatarFileInput.addEventListener('change', async () => {
  const file = avatarFileInput.files[0];
  if (!file) return;
  try {
    myAvatar = await resizeImageToDataUrl(file, 128);
    localStorage.setItem('amigosCall.avatar', myAvatar);
    setAvatarPreview(avatarPreview, myAvatar, '?');
  } catch (err) {
    loginError.textContent = 'Não consegui carregar essa imagem.';
  }
});


function resizeImageToDataUrl(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = reject;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setAvatarPreview(el, dataUrl, fallbackLetter) {
  if (dataUrl) {
    el.style.backgroundImage = `url(${dataUrl})`;
    el.classList.add('has-photo');
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.classList.remove('has-photo');
    el.textContent = fallbackLetter;
  }
}


joinBtn.addEventListener('click', joinRoom);
usernameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });
roomInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });

async function joinRoom() {
  const u = usernameInput.value.trim();
  const r = roomInput.value.trim();
  const serverUrl = serverInput.value.trim();

  if (!u || !r) {
    loginError.textContent = 'Preencha seu nome e a sala.';
    return;
  }
  if (!serverUrl || !/^https?:\/\//.test(serverUrl)) {
    loginError.textContent = 'Endereço do servidor inválido. Abra "Configurações avançadas" e confira.';
    advancedSettings.classList.remove('hidden');
    return;
  }

  username = u;
  roomId = r;
  localStorage.setItem('amigosCall.serverUrl', serverUrl);

  socket = io(serverUrl);
  setupSocketListeners();

  socket.on('connect', () => {
    socket.emit('join-room', { roomId, username, avatar: myAvatar });
    loginScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    roomNameLabel.textContent = '# ' + roomId;
    addSelfTile();
    addChatSystemMessage(`Você entrou na sala "${roomId}".`);
  });

  socket.on('connect_error', () => {
    loginError.textContent = 'Não consegui conectar ao servidor. Verifique se ele está no ar.';
  });
}


function setupSocketListeners() {
  socket.on('room-users', async (users) => {
    for (const u of users) {
      addMemberToList(u.id, u.username, u.avatar);
      const pc = createPeerConnection(u.id, u.username, u.avatar);
      addLocalTracksToPC(pc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-offer', { to: u.id, offer });
    }
  });

  socket.on('user-joined', ({ id, username: uname, avatar }) => {
    addMemberToList(id, uname, avatar);
    createPeerConnection(id, uname, avatar);
    addChatSystemMessage(`${uname} entrou na sala.`);
  });

  socket.on('webrtc-offer', async ({ from, offer }) => {
    let pc = peers.get(from)?.pc;
    if (!pc) pc = createPeerConnection(from, peers.get(from)?.username || '???');
    addLocalTracksToPC(pc);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('webrtc-answer', { to: from, answer });
  });

  socket.on('webrtc-answer', async ({ from, answer }) => {
    const pc = peers.get(from)?.pc;
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
  });

  socket.on('webrtc-ice-candidate', async ({ from, candidate }) => {
    const pc = peers.get(from)?.pc;
    if (pc && candidate) {
      try { await pc.addIceCandidate(candidate); } catch (e) { /* ignora falhas isoladas de ICE */ }
    }
  });

  socket.on('user-left', ({ id, username: uname }) => {
    removePeer(id);
    addChatSystemMessage(`${uname} saiu da sala.`);
  });

  socket.on('chat-message', ({ id, username: uname, message }) => {
    if (id === socket.id) return; 
    addChatMessage(uname, message);
  });

  socket.on('media-state-changed', ({ id, kind, enabled }) => {
    const peer = peers.get(id);
    if (!peer) return;
    if (kind === 'screen') updateTileVisual(peer, enabled);
  });

  socket.on('profile-updated', ({ id, avatar }) => {
    const peer = peers.get(id);
    if (!peer) return;
    peer.avatar = avatar;
    setAvatarPreview(peer.tileEl.querySelector('.avatar-fallback'), avatar, peer.username.charAt(0).toUpperCase());
    const memberAvatarEl = peer.memberEl?.querySelector('.member-avatar');
    if (memberAvatarEl) setAvatarPreview(memberAvatarEl, avatar, peer.username.charAt(0).toUpperCase());
  });
}


function createPeerConnection(peerId, uname, avatar) {
  const pc = new RTCPeerConnection({ iceServers: window.ICE_SERVERS });

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit('webrtc-ice-candidate', { to: peerId, candidate: e.candidate });
  };

  pc.ontrack = (e) => {
    const peer = peers.get(peerId);
    if (!peer) return;
  
    const stream = (e.streams && e.streams[0]) ? e.streams[0] : new MediaStream([e.track]);
    if (e.track.kind === 'audio') {
      const audioEl = new Audio();
      audioEl.srcObject = stream;
      audioEl.autoplay = true;
      audioEl.volume = peer.volume ?? 1;
      peer.audioEl = audioEl;
      peer.volumeRow.classList.remove('hidden');
    } else {
      peer.videoEl.srcObject = stream;
      updateTileVisual(peer, true);
    }
  };

  const tileEl = createVideoTile(peerId, uname, avatar);
  const memberEl = document.getElementById('member-' + peerId);
  peers.set(peerId, {
    pc, username: uname, avatar, volume: 1,
    tileEl, videoEl: tileEl.querySelector('video'),
    volumeRow: tileEl.querySelector('.volume-row'),
    memberEl,
  });

  return pc;
}

function addLocalTracksToPC(pc) {
  if (!screenOn || !screenStream) return;
  const existingKinds = pc.getSenders().map((s) => s.track && s.track.kind).filter(Boolean);
  screenStream.getTracks().forEach((t) => {
    if (!existingKinds.includes(t.kind)) pc.addTrack(t, screenStream);
  });
}

function removePeer(peerId) {
  const peer = peers.get(peerId);
  if (!peer) return;
  peer.pc.close();
  peer.tileEl.remove();
  const li = document.getElementById('member-' + peerId);
  if (li) li.remove();
  peers.delete(peerId);
}


function createVideoTile(peerId, uname, avatar) {
  const tile = document.createElement('div');
  tile.className = 'video-tile';
  tile.id = 'tile-' + peerId;
  tile.innerHTML = `
    <video autoplay playsinline${peerId === 'self' ? ' muted' : ''}></video>
    <div class="avatar-fallback">${uname.charAt(0).toUpperCase()}</div>
    <div class="name-tag">${escapeHtml(uname)}${peerId === 'self' ? ' (você)' : ''}</div>
    <div class="volume-row hidden">
      <svg class="icon icon-small" viewBox="0 0 24 24" fill="none"><path d="M4 9v6h4l5 4V5L8 9H4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M17 8a5 5 0 0 1 0 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
      <input type="range" class="volume-slider" min="0" max="2" step="0.05" value="1" />
    </div>
  `;
  videosGrid.appendChild(tile);
  const video = tile.querySelector('video');
  video.style.display = 'none';
  setAvatarPreview(tile.querySelector('.avatar-fallback'), avatar, uname.charAt(0).toUpperCase());
  tile.addEventListener('dblclick', () => toggleTileFullscreen(tile));

  if (peerId !== 'self') {
    const slider = tile.querySelector('.volume-slider');
    slider.addEventListener('input', () => {
      const peer = peers.get(peerId);
      if (!peer) return;
      const vol = parseFloat(slider.value);
      peer.volume = vol;
      if (peer.audioEl) peer.audioEl.volume = vol;
    });
  } else {
    tile.querySelector('.volume-row').remove(); 
  }

  return tile;
}

function toggleTileFullscreen(tile) {
  if (document.fullscreenElement === tile) {
    document.exitFullscreen();
  } else {
    tile.requestFullscreen().catch(() => {});
  }
}

function updateTileVisual(peerRef, hasVideo) {
  const video = peerRef.tileEl.querySelector('video');
  const avatar = peerRef.tileEl.querySelector('.avatar-fallback');
  video.style.display = hasVideo ? 'block' : 'none';
  avatar.style.display = hasVideo ? 'none' : 'flex';
}

function addSelfTile() {
  const tileEl = createVideoTile('self', username, myAvatar);
  peers.set('self', {
    pc: null, username, avatar: myAvatar,
    tileEl, videoEl: tileEl.querySelector('video'), memberEl: null,
  });
}

function addMemberToList(id, uname, avatar) {
  const li = document.createElement('li');
  li.id = 'member-' + id;
  li.innerHTML = `<div class="member-avatar"></div><span>${escapeHtml(uname)}</span>`;
  setAvatarPreview(li.querySelector('.member-avatar'), avatar, uname.charAt(0).toUpperCase());
  membersUl.appendChild(li);
}


screenBtn.addEventListener('click', async () => {
  if (!screenOn) {
    openScreenPicker();
  } else {
    await stopScreenShare();
    socket.emit('media-state-changed', { roomId, kind: 'screen', enabled: false });
  }
});

async function openScreenPicker() {
  const sources = await window.electronAPI.getScreenSources();
  screenSourcesGrid.innerHTML = '';
  sources.forEach((s) => {
    const item = document.createElement('div');
    item.className = 'screen-source-item';
    item.innerHTML = `<img src="${s.thumbnail}" /><span>${escapeHtml(s.name)}</span>`;
    item.addEventListener('click', () => startScreenShare(s.id));
    screenSourcesGrid.appendChild(item);
  });
  screenPickerModal.classList.remove('hidden');
}
cancelScreenShareBtn.addEventListener('click', () => screenPickerModal.classList.add('hidden'));


async function getScreenStreamWithFallback(sourceId) {
  const videoTiers = [
    { minWidth: 1280, maxWidth: 1280, minHeight: 720, maxHeight: 720, minFrameRate: 60, maxFrameRate: 60 },
    { minWidth: 1280, maxWidth: 1280, minHeight: 720, maxHeight: 720, minFrameRate: 30, maxFrameRate: 30 },
    {}, 
  ];
  let lastError;
  for (const withAudio of [true, false]) {
    for (const videoExtra of videoTiers) {
      try {
        const constraints = {
          video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sourceId, ...videoExtra } },
        };
        if (withAudio) {
          constraints.audio = { mandatory: { chromeMediaSource: 'desktop' } };
        } else {
          constraints.audio = false;
        }
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        return { stream, hasAudio: withAudio && stream.getAudioTracks().length > 0 };
      } catch (err) {
        lastError = err;
      }
    }
  }
  throw lastError;
}

async function startScreenShare(sourceId) {
  screenPickerModal.classList.add('hidden');
  let result;
  try {
    result = await getScreenStreamWithFallback(sourceId);
  } catch (err) {
    addChatSystemMessage('Não consegui iniciar o compartilhamento de tela.');
    return;
  }
  screenStream = result.stream;
  screenOn = true;
  screenBtn.classList.add('active');
  screenStream.getVideoTracks()[0].onended = () => stopScreenShare(); // parou pelo controle nativo do SO
  if (!result.hasAudio) {
    addChatSystemMessage('Compartilhando sem áudio do sistema (escolha "Tela inteira" pra incluir o som).');
  }
  await broadcastScreenTracks(screenStream);
  const selfPeer = peers.get('self');
  selfPeer.videoEl.srcObject = screenStream;
  updateTileVisual(selfPeer, true);
  socket.emit('media-state-changed', { roomId, kind: 'screen', enabled: true });
}

async function stopScreenShare() {
  if (screenStream) screenStream.getTracks().forEach((t) => t.stop());
  screenOn = false;
  screenBtn.classList.remove('active');
  await broadcastScreenTracks(null);
  updateTileVisual(peers.get('self'), false);
}


async function broadcastScreenTracks(stream) {
  for (const [id, peer] of peers) {
    if (id === 'self' || !peer.pc) continue;
    let needsRenegotiate = false;
    for (const kind of ['video', 'audio']) {
      const sender = peer.pc.getSenders().find((s) => s.track && s.track.kind === kind);
      const newTrack = stream ? stream.getTracks().find((t) => t.kind === kind) : null;
      if (newTrack) {
        if (sender) {
          await sender.replaceTrack(newTrack);
        } else {
          peer.pc.addTrack(newTrack, stream);
          needsRenegotiate = true;
        }
      } else if (sender) {
        peer.pc.removeTrack(sender);
        needsRenegotiate = true;
      }
    }
    if (needsRenegotiate) await renegotiate(peer);
  }
}

async function renegotiate(peer) {
  const offer = await peer.pc.createOffer();
  await peer.pc.setLocalDescription(offer);
  const peerId = [...peers.entries()].find((e) => e[1] === peer)[0];
  socket.emit('webrtc-offer', { to: peerId, offer });
}


chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (!msg) return;
  socket.emit('chat-message', { roomId, message: msg, username });
  addChatMessage(username, msg);
  chatInput.value = '';
});

function addChatMessage(uname, message) {
  const div = document.createElement('div');
  div.className = 'msg';
  div.innerHTML = `<span class="who">${escapeHtml(uname)}:</span>${escapeHtml(message)}`;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addChatSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'msg system';
  div.textContent = text;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}


leaveBtn.addEventListener('click', () => {
  if (socket) socket.disconnect();
  window.location.reload();
});
