// backend/routes/groups.js
const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { evoFetchAllGroups } = require('../services/evolution');

const router = express.Router();

/**
 * GET /api/groups/:instanceId
 * Lista grupos salvos no Postgres para a instância.
 */
router.get('/:instanceId', authMiddleware, async (req, res) => {
  const { instanceId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, instance_id, name, jid
         FROM whatsapp_groups
        WHERE instance_id = $1
        ORDER BY name ASC`,
      [instanceId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar grupos:', err);
    res.status(500).json({ error: 'Erro ao listar grupos' });
  }
});

/**
 * POST /api/groups/:instanceId/refresh
 * Busca todos os grupos na Evolution e salva/atualiza na tabela whatsapp_groups.
 */
router.post('/:instanceId/refresh', authMiddleware, async (req, res) => {
  const { instanceId } = req.params;

  try {
    // Pega a instância pra descobrir o ID da Evolution
    const instRes = await pool.query(
      'SELECT evolution_instance_id FROM whatsapp_instances WHERE id = $1',
      [instanceId]
    );
    const instance = instRes.rows[0];

    if (!instance || !instance.evolution_instance_id) {
      return res.status(404).json({ error: 'Instância não encontrada.' });
    }

    const evoId = instance.evolution_instance_id;

    // Busca grupos na Evolution
    const evoData = await evoFetchAllGroups(evoId);
    // a Evolution pode retornar em formatos ligeiramente diferentes
    const groups = evoData?.groups || evoData || [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const g of groups) {
        // tenta achar o JID e o nome com segurança
        const jid =
          g.id ||
          g.jid ||
          g.groupId ||
          (g.groupId && g.groupId._serialized) ||
          g.remoteJid;

        const name =
          g.name ||
          g.subject ||
          g.groupName ||
          g.title;

        if (!jid || !name) continue;

        await client.query(
          `INSERT INTO whatsapp_groups (instance_id, name, jid)
           VALUES ($1, $2, $3)
           ON CONFLICT (instance_id, jid)
           DO UPDATE SET name = EXCLUDED.name`,
          [instanceId, name, jid]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // devolve a lista atualizada
    const result = await pool.query(
      `SELECT id, instance_id, name, jid
         FROM whatsapp_groups
        WHERE instance_id = $1
        ORDER BY name ASC`,
      [instanceId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao sincronizar grupos com Evolution:', err?.response?.data || err);
    res.status(500).json({ error: 'Erro ao sincronizar grupos com Evolution' });
  }
});

module.exports = router;
