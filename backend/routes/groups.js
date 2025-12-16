const express = require("express");
const { pool } = require("../db");
const { authMiddleware } = require("../middleware/auth");
const { evoFetchAllGroups } = require("../services/evolution");

const router = express.Router();

// 🔐 todas as rotas exigem JWT
router.use(authMiddleware);

/**
 * GET /api/groups/:instanceId
 * Lista grupos salvos no banco
 */
router.get("/:instanceId", async (req, res) => {
  const { instanceId } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, group_id, name 
       FROM whatsapp_groups 
       WHERE instance_id = $1 
       ORDER BY name`,
      [instanceId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("Erro ao listar grupos:", err);
    return res.status(500).json({ error: "Erro ao listar grupos" });
  }
});

/**
 * POST /api/groups/:instanceId/refresh
 * Sincroniza grupos com a Evolution API
 */
router.post("/:instanceId/refresh", async (req, res) => {
  const { instanceId } = req.params;

  try {
    const instRes = await pool.query(
      "SELECT evolution_instance_id FROM whatsapp_instances WHERE id = $1",
      [instanceId]
    );

    if (instRes.rowCount === 0) {
      return res.status(404).json({ error: "Instância não encontrada" });
    }

    const evoInstanceId = instRes.rows[0].evolution_instance_id;

    let groups;
    try {
      groups = await evoFetchAllGroups(evoInstanceId);
    } catch (err) {
      console.error("Erro Evolution:", err?.response?.data || err.message);
      return res.status(500).json({
        error: "Falha ao buscar grupos na Evolution",
      });
    }

    if (!Array.isArray(groups)) {
      console.error("Formato inválido:", groups);
      return res.status(500).json({
        error: "Formato inválido retornado pela Evolution",
      });
    }

    const validGroups = groups.filter(
      (g) => g && (g.id || g.groupId)
    );

    if (validGroups.length === 0) {
      return res.json({ success: true, total: 0 });
    }

    // limpa antes de salvar
    await pool.query(
      "DELETE FROM whatsapp_groups WHERE instance_id = $1",
      [instanceId]
    );

    for (const g of validGroups) {
      await pool.query(
        `INSERT INTO whatsapp_groups 
         (instance_id, group_id, name, participants)
         VALUES ($1, $2, $3, $4)`,
        [
          instanceId,
          g.id || g.groupId,
          g.subject || g.name || "Grupo sem nome",
          g.participants || [],
        ]
      );
    }

    return res.json({
      success: true,
      total: validGroups.length,
    });
  } catch (err) {
    console.error("Erro ao sincronizar grupos:", err);
    return res.status(500).json({ error: "Erro interno ao sincronizar grupos" });
  }
});

module.exports = router;
