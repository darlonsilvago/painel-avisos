// backend/routes/instances.js
const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const {
  evoCreateInstance,
  evoGetQrCode,
  evoGetConnectionState,
} = require('../services/evolution');

const router = express.Router();

// todas essas rotas exigem login
router.use(authMiddleware);

// POST /api/instances  -> cria instância na Evolution e salva no banco
router.post('/', async (req, res) => {
  const { name, phone } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nome da instância é obrigatório' });
  }

  // normaliza telefone: deixa só números
  const normalizedPhone = phone ? phone.replace(/\D/g, '') : null;

  try {
    const evoData = await evoCreateInstance(name);

    // tenta identificar o ID da instância retornado pela Evolution
    const evolutionInstanceId =
      evoData.instance?.id ||
      evoData.instance?.instanceName ||
      evoData.instanceId ||
      evoData.id;

    if (!evolutionInstanceId) {
      return res.status(500).json({
        error:
          'Não foi possível identificar o ID da instância retornado pela Evolution',
        raw: evoData,
      });
    }

    const dbRes = await pool.query(
      `INSERT INTO whatsapp_instances (name, phone, evolution_instance_id, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [name, normalizedPhone, evolutionInstanceId]
    );

    res.json(dbRes.rows[0]);
  } catch (err) {
    console.error('Erro ao criar instância:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erro ao criar instância na Evolution' });
  }
});

// GET /api/instances  -> lista instâncias salvas no banco
router.get('/', async (req, res) => {
  try {
    const dbRes = await pool.query(
      'SELECT id, name, phone, evolution_instance_id, status, created_at FROM whatsapp_instances ORDER BY id DESC'
    );
    res.json(dbRes.rows);
  } catch (err) {
    console.error('Erro ao listar instâncias:', err.message);
    res.status(500).json({ error: 'Erro ao listar instâncias' });
  }
});

// GET /api/instances/:id/qr -> pega o QR direto da Evolution e atualiza status
router.get('/:id/qr', async (req, res) => {
  const { id } = req.params;

  try {
    const instRes = await pool.query(
      'SELECT * FROM whatsapp_instances WHERE id = $1',
      [id]
    );
    const instance = instRes.rows[0];

    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    // chama Evolution para pegar QR e (se vier) status
    const qrData = await evoGetQrCode(instance.evolution_instance_id);

    // tentar descobrir o status vindo da Evolution
    let newStatus = instance.status || 'pending';

    if (qrData?.instance?.status) {
      newStatus = String(qrData.instance.status).toLowerCase(); // ex: CONNECTED
    } else if (typeof qrData?.status === 'string') {
      newStatus = qrData.status.toLowerCase();
    } else if (qrData?.qrcode) {
      // se tem qrcode, normalmente está aguardando leitura
      newStatus = 'pending';
    }

    // salvar último QR e status no banco
    await pool.query(
      'UPDATE whatsapp_instances SET qr_code = $1, status = $2 WHERE id = $3',
      [qrData.qrcode || null, newStatus, id]
    );

    res.json(qrData);
  } catch (err) {
    console.error('Erro ao obter QR:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erro ao obter QR Code da Evolution' });
  }
});

// DELETE /api/instances/:id -> apaga a instância do banco
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM whatsapp_instances WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao deletar instância:', err.message);
    res.status(500).json({ error: 'Erro ao deletar instância' });
  }
});

// GET /api/instances/sync-status -> sincroniza os status com a Evolution API
router.get('/sync-status', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM whatsapp_instances ORDER BY id DESC'
    );

    const instances = result.rows;

    for (const inst of instances) {
      try {
        // chama Evolution API para pegar o estado atual da conexão
        const evoRes = await evoGetConnectionState(inst.evolution_instance_id);

        let newStatus = inst.status;

        // Exemplo de resposta:
        // { instance: { instanceName: 'teste-docs', state: 'open' } }
        const state = evoRes?.instance?.state
          ? String(evoRes.instance.state).toLowerCase()
          : null;

        if (state) {
          // normaliza pro que o painel entende
          // open / connected  -> connected
          // connecting / pairing -> pending
          if (state === 'open' || state === 'connected') {
            newStatus = 'connected';
          } else if (state === 'connecting' || state === 'pairing') {
            newStatus = 'pending';
          } else {
            newStatus = state; // deixa como vier (closed, disconnected, etc.)
          }

          await pool.query(
            'UPDATE whatsapp_instances SET status = $1 WHERE id = $2',
            [newStatus, inst.id]
          );
        }
      } catch (err) {
        console.log(
          `Erro ao sincronizar instância ${inst.evolution_instance_id}:`,
          err.response?.data || err.message
        );
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao sincronizar:', err.message);
    res.status(500).json({ error: 'Erro na sincronização' });
  }
});

module.exports = router;
