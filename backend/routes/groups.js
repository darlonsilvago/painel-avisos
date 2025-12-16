const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { evoFetchAllGroups } = require('../services/evolution');

const router = express.Router();

// 🔐 todas as rotas exigem JWT
router.use(authMiddleware);

/**
 * POST /api/groups/:instanceId/refresh
 * Busca grupos na Evolution API e salva no banco
 */
router.post('/:instanceId/refresh', async (req, res) => {
  const { instanceId } = req.params;

  try {
    // 1️⃣ valida instância
    const instRes = await pool.query(
      'SELECT * FROM whatsapp_instances WHERE id = $1',
      [instanceId]
    );

    if (!instRes.rows.length) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    const evoId = instRes.rows[0].evolution_instance_id;

    // 2️⃣ busca grupos na Evolution
    const groups = await evoFetchAllGroups(evoId);

    if (!Array.isArray(groups)) {
      return res.status(500).json({ error: 'Resposta inválida da Evolution' });
    }

    // 3️⃣ limpa grupos antigos da instância
    await pool.query(
      'DELETE FROM whatsapp_groups WHERE instance_id = $1',
      [instanceId]
    );

    // 4️⃣ salva grupos novos
    for (const group of groups) {
      await pool.query(
        `INSERT INTO whatsapp_groups 
         (instance_id, group_id, name, participants)
         VALUES ($1, $2, $3, $4)`,
        [
          instanceId,
          group.id,
          group.subject || group.name || 'Grupo sem nome',
          group.participants || [],
        ]
      );
    }

    res.json({ success: true, total: groups.length });
  } catch (err) {
    console.error('Erro ao sincronizar grupos:', err.message);
    res.status(500).json({ error: 'Erro ao sincronizar grupos' });
  }
});

/**
 * GET /api/groups/:instanceId
 * Lista grupos salvos no banco
 */
router.get('/:instanceId', async (req, res) => {
  const { instanceId } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM whatsapp_groups WHERE instance_id = $1 ORDER BY name',
      [instanceId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar grupos:', err.message);
    res.status(500).json({ error: 'Erro ao listar grupos' });
  }
});

module.exports = router;
