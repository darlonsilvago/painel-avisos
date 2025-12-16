// backend/routes/send.js
const express = require('express');
const { pool } = require('../db');
const { painelTokenMiddleware } = require('../middleware/painelToken');
const { evoSendText, evoSendMedia } = require('../services/evolution');




const router = express.Router();

router.use(painelTokenMiddleware);

// ==========================
// FILA DE ENVIO EM MASSA
// ==========================

let bulkQueue = [];
let isProcessing = false;
const DEFAULT_DELAY_MS = 5000; // 5 segundos entre cada envio (pode ajustar)

// Função que processa a fila
async function processBulkQueue() {
  if (bulkQueue.length === 0) {
    isProcessing = false;
    console.log('Fila de envios vazia. Nada mais a enviar.');
    return;
  }

  isProcessing = true;
  const job = bulkQueue.shift(); // pega o primeiro da fila

  console.log(`Enviando para ${job.to} | tipo: ${job.type}`);

  try {
    if (job.type === 'text') {
      await evoSendText(job.evoId, job.to, job.message);
    } else if (job.type === 'image') {
      await evoSendMedia(job.evoId, job.to, job.imageUrl, job.caption);
    }
    console.log(`✅ Enviado com sucesso para ${job.to}`);
  } catch (err) {
    console.error(
      `❌ Erro ao enviar para ${job.to}:`,
      err.response?.data || err.message
    );
  }

  const delay = job.delayMs || DEFAULT_DELAY_MS;

  // agenda o próximo
  setTimeout(processBulkQueue, delay);
}

// ==========================
// ROTAS DE ENVIO UNITÁRIO
// ==========================

// POST /api/send/text
router.post('/text', async (req, res) => {
  const { instanceId, to, message } = req.body;

  if (!instanceId || !to || !message) {
    return res.status(400).json({ error: 'instanceId, to e message são obrigatórios' });
  }

  try {
    const inst = await pool.query(
      'SELECT * FROM whatsapp_instances WHERE id = $1',
      [instanceId]
    );

    if (inst.rows.length === 0) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    const evoId = inst.rows[0].evolution_instance_id;

    const sent = await evoSendText(evoId, to, message);

    res.json({
      success: true,
      sent
    });
  } catch (err) {
    console.error('Erro ao enviar texto:', err.response?.data || err.message);
    res.status(500).json({ error: 'Falha ao enviar texto' });
  }
});

// POST /api/send/image
router.post('/image', async (req, res) => {
  const { instanceId, to, imageUrl, caption } = req.body;

  if (!instanceId || !to || !imageUrl) {
    return res.status(400).json({ error: 'instanceId, to e imageUrl são obrigatórios' });
  }

  try {
    const inst = await pool.query(
      'SELECT * FROM whatsapp_instances WHERE id = $1',
      [instanceId]
    );

    if (inst.rows.length === 0) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    const evoId = inst.rows[0].evolution_instance_id;

    const sent = await evoSendMedia(evoId, to, imageUrl, caption);

    res.json({
      success: true,
      sent
    });
  } catch (err) {
    const errData = err.response?.data || err.message;
    console.error('Falha ao enviar imagem (detalhes):', JSON.stringify(errData, null, 2));
    res.status(500).json({ error: 'Falha ao enviar imagem' });
  }
});

// ==========================
// ENVIO EM MASSA
// ==========================

// POST /api/send/bulk
// Body esperado:
// {
//   "instanceId": 1,
//   "type": "text" ou "image",
//   "message": "texto da mensagem",
//   "imageUrl": "https://... (se type = image)",
//   "caption": "legenda opcional (se image)",
//   "targets": ["55...", "55...-grupo@g.us", ...],
//   "delayMs": 5000   // opcional, default 5000
// }
router.post('/bulk', async (req, res) => {
  const { instanceId, type, message, imageUrl, caption, targets, delayMs } = req.body;

  if (!instanceId || !type || !Array.isArray(targets) || targets.length === 0) {
    return res.status(400).json({
      error: 'instanceId, type e targets (array) são obrigatórios',
    });
  }

  if (type === 'text' && !message) {
    return res.status(400).json({
      error: 'Para type="text", o campo message é obrigatório',
    });
  }

  if (type === 'image' && !imageUrl) {
    return res.status(400).json({
      error: 'Para type="image", o campo imageUrl é obrigatório',
    });
  }

  // segurança: limitar delay mínimo e máximo
  let safeDelay = Number(delayMs) || DEFAULT_DELAY_MS;
  if (safeDelay < 3000) safeDelay = 5000;    // mínimo 5s
  if (safeDelay > 30000) safeDelay = 30000;  // máximo 30s

  try {
    const inst = await pool.query(
      'SELECT * FROM whatsapp_instances WHERE id = $1',
      [instanceId]
    );

    if (inst.rows.length === 0) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    const evoId = inst.rows[0].evolution_instance_id;

    // monta os "jobs" para a fila
    const jobs = targets.map((to) => ({
      evoId,
      type,
      to,
      message: message || null,
      imageUrl: imageUrl || null,
      caption: caption || message || '',
      delayMs: safeDelay,
    }));

    bulkQueue.push(...jobs);

    console.log(`Foram adicionados ${jobs.length} envios na fila. Delay: ${safeDelay}ms`);

    if (!isProcessing) {
      processBulkQueue();
    }

    res.json({
      success: true,
      queued: jobs.length,
      delayMs: safeDelay,
      processing: isProcessing,
    });
  } catch (err) {
    console.error('Erro ao enfileirar envios em massa:', err.message);
    res.status(500).json({ error: 'Falha ao enfileirar envios em massa' });
  }
});

// Status simples da fila
// GET /api/send/queue/status
router.get('/queue/status', (req, res) => {
  res.json({
    pending: bulkQueue.length,
    processing: isProcessing,
    defaultDelayMs: DEFAULT_DELAY_MS,
  });
});



module.exports = router;
