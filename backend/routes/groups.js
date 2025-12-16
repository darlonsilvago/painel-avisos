const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { evoFetchAllGroups } = require('../services/evolution');

const router = express.Router();

// 🔐 JWT
router.use(authMiddleware);

// GET /api/groups/:instanceId
router.get('/:instanceId', async (req, res) => {
  const { instanceId } = req.params;

  const inst = await pool.query(
    'SELECT * FROM whatsapp_instances WHERE id = $1',
    [instanceId]
  );

  if (!inst.rows.length) {
    return res.status(404).json({ error: 'Instância não encontrada' });
  }

  const evoId = inst.rows[0].evolution_instance_id;
  const groups = await evoFetchAllGroups(evoId);

  res.json(groups);
});

module.exports = router;
