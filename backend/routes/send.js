const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { evoSendText, evoSendMedia } = require('../services/evolution');

const router = express.Router();

// 🔐 PADRÃO JWT
router.use(authMiddleware);

// ===== FILA =====
let bulkQueue = [];
let isProcessing = false;
const DEFAULT_DELAY_MS = 5000;

async function processBulkQueue() {
  if (!bulkQueue.length) {
    isProcessing = false;
    return;
  }

  isProcessing = true;
  const job = bulkQueue.shift();

  try {
    if (job.type === 'text') {
      await evoSendText(job.evoId, job.to, job.message);
    } else {
      await evoSendMedia(job.evoId, job.to, job.imageUrl, job.caption);
    }
  } catch (_) {}

  setTimeout(processBulkQueue, job.delayMs || DEFAULT_DELAY_MS);
}

// POST /api/send/text
router.post('/text', async (req, res) => {
  const { instanceId, to, message } = req.body;

  const inst = await pool.query(
    'SELECT * FROM whatsapp_instances WHERE id = $1',
    [instanceId]
  );

  if (!inst.rows.length) {
    return res.status(404).json({ error: 'Instância não encontrada' });
  }

  const evoId = inst.rows[0].evolution_instance_id;
  await evoSendText(evoId, to, message);

  res.json({ success: true });
});

// POST /api/send/image
router.post('/image', async (req, res) => {
  const { instanceId, to, imageUrl, caption } = req.body;

  const inst = await pool.query(
    'SELECT * FROM whatsapp_instances WHERE id = $1',
    [instanceId]
  );

  if (!inst.rows.length) {
    return res.status(404).json({ error: 'Instância não encontrada' });
  }

  const evoId = inst.rows[0].evolution_instance_id;
  await evoSendMedia(evoId, to, imageUrl, caption);

  res.json({ success: true });
});

// POST /api/send/bulk
router.post('/bulk', async (req, res) => {
  const { instanceId, type, message, imageUrl, caption, targets, delayMs } =
    req.body;

  const inst = await pool.query(
    'SELECT * FROM whatsapp_instances WHERE id = $1',
    [instanceId]
  );

  const evoId = inst.rows[0].evolution_instance_id;

  const jobs = targets.map((to) => ({
    evoId,
    type,
    to,
    message,
    imageUrl,
    caption,
    delayMs,
  }));

  bulkQueue.push(...jobs);
  if (!isProcessing) processBulkQueue();

  res.json({ queued: jobs.length });
});

// GET /api/send/queue/status
router.get('/queue/status', (req, res) => {
  res.json({ pending: bulkQueue.length, processing: isProcessing });
});

module.exports = router;
