// backend/services/evolution.js
const axios = require('axios');
require('dotenv').config();

const evo = axios.create({
  baseURL: process.env.EVOLUTION_API_URL,
  headers: {
    apikey: process.env.EVOLUTION_API_KEY,
    'Content-Type': 'application/json',
  },
});

// Criar instância
async function evoCreateInstance(name) {
  const res = await evo.post('/instance/create', {
    instanceName: name,
    qrcode: true,
    integration: 'WHATSAPP-BAILEYS',
  });
  return res.data;
}

// QR / conexão (gera QR e/ou tenta conectar)
async function evoGetQrCode(evolutionInstanceId) {
  const res = await evo.get(`/instance/connect/${evolutionInstanceId}`);
  return res.data;
}

// ➜ Estado da conexão (usado para sincronizar status no painel)
async function evoGetConnectionState(evolutionInstanceId) {
  // Evolution: GET /instance/connectionState/{instanceName}
  const res = await evo.get(`/instance/connectionState/${evolutionInstanceId}`);
  return res.data;
}

// Grupos
async function evoFetchAllGroups(evolutionInstanceId) {
  const res = await evo.get(`/group/fetchAllGroups/${evolutionInstanceId}`, {
    params: { getParticipants: false },
  });
  return res.data;
}

// Participantes de um grupo
async function evoFetchGroupParticipants(evolutionInstanceId, groupJid) {
  // GET /group/participants/{instanceName}?groupJid=...  (doc da Evolution)
  const res = await evo.get(`/group/participants/${evolutionInstanceId}`, {
    params: { groupJid },
  });
  return res.data;
}

// ➜ Envio de TEXTO
async function evoSendText(evolutionInstanceId, to, message) {
  const res = await evo.post(`/message/sendText/${evolutionInstanceId}`, {
    number: to,
    text: message,
  });
  return res.data;
}

// ➜ Envio de MÍDIA (imagem)
async function evoSendMedia(evolutionInstanceId, to, imageUrl, caption) {
  // imageUrl pode vir como:
  // - "https://..." (URL)
  // - "BASE64PURO..."
  // - "data:image/png;base64,BASE64PURO..."
  let media = imageUrl;

  if (typeof media === 'string' && media.startsWith('data:')) {
    const commaIndex = media.indexOf(',');
    if (commaIndex !== -1) {
      media = media.slice(commaIndex + 1); // pega só o base64 puro
    }
  }

  const res = await evo.post(`/message/sendMedia/${evolutionInstanceId}`, {
    number: to,
    mediatype: 'image',
    media,                     // aqui vai URL ou base64 puro
    fileName: 'imagem.jpg',
    caption: caption || '',
  });

  return res.data;
}

module.exports = {
  evoCreateInstance,
  evoGetQrCode,
  evoGetConnectionState,
  evoFetchAllGroups,
  evoFetchGroupParticipants,
  evoSendText,
  evoSendMedia,
};
