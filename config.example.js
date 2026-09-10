// Esta é a URL PADRÃO que já vem preenchida na tela de login (o usuário
// pode trocar manualmente em "Configurações avançadas" se precisar, sem
// precisar gerar os instaladores de novo).
// Troque pela URL do SEU servidor antes de gerar os instaladores finais
// (ex.: no Render, vai ser algo como https://amigos-call-server.onrender.com)
window.SERVER_URL = 'https://SEU-SERVIDOR-AQUI.onrender.com';

// Servidores STUN/TURN gratuitos, necessários para as chamadas
// funcionarem mesmo quando os PCs estão atrás de roteadores/NAT.
window.ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];
