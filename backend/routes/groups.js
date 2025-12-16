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
    const instRes = await pool.query(
      'SELECT evolution_instance_id FROM whatsapp_instances WHERE id = $1',
      [instanceId]
    );

    if (instRes.rowCount === 0) {
      return res.status(404).json({ error: 'Instância não encontrada' });
    }

    const evoInstanceId = instRes.rows[0].evolution_instance_id;

    let groups;
    try {
      groups = await evoFetchAllGroups(evoInstanceId);
    } catch (evoErr) {
      console.error('Erro Evolution:', evoErr?.response?.data || evoErr.message);
      return res.status(200).json({
        success: false,
        message: 'Falha ao buscar grupos na Evolution',
      });
    }

    if (!Array.isArray(groups) || groups.length === 0) {
      return res.json({
        success: true,
        total: 0,
        message: 'Nenhum grupo retornado',
      });
    }

    // Limpa apenas se houver grupos válidos
    await pool.query(
      'DELETE FROM whatsapp_groups WHERE instance_id = $1',
      [instanceId]
    );

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
    console.error('Erro ao sincronizar grupos:', err);
    res.status(500).json({ error: 'Erro interno ao sincronizar grupos' });
  }
});

/**
 * GET /api/groups/:instanceId
 * Lista grupos salvos no banco
 */
router.get('/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;

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
