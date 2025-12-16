const express = require("express");
const { pool } = require("../db");
const { authMiddleware } = require("../middleware/auth");
const { evoFetchAllGroups } = require("../services/evolution");

const router = express.Router();

// 🔐 Todas as rotas exigem JWT
router.use(authMiddleware);

/**
 * POST /api/groups/:instanceId/refresh
 * Sincroniza grupos da Evolution API com o banco
 */
router.post("/:instanceId/refresh", async (req, res) => {
  const { instanceId } = req.params;

  try {
    // 1️⃣ Busca instância
    const instRes = await pool.query(
      "SELECT evolution_instance_id FROM whatsapp_instances WHERE id = $1",
      [instanceId]
    );

    if (instRes.rowCount === 0) {
      return res.status(404).json({ error: "Instância não encontrada" });
    }

    const evoInstanceId = instRes.rows[0].evolution_instance_id;

    // 2️⃣ Busca grupos na Evolution
    let groups;
    try {
      groups = await evoFetchAllGroups(evoInstanceId);
    } catch (err) {
      console.error("Erro Evolution:", err?.response?.data || err.message);
      return res.status(200).json({
        success: false,
        message: "Falha ao buscar grupos na Evolution",
      });
    }

    if (!Array.isArray(groups)) {
      console.error("Formato inválido retornado:", groups);
      return res.status(200).json({
        success: false,
        message: "Formato inválido retornado pela Evolution",
      });
    }

    // 3️⃣ Filtra grupos válidos (jid obrigatório)
    const validGroups = groups.filter(
      (g) => g && (g.id || g.jid)
    );

    if (validGroups.length === 0) {
      return res.json({
        success: true,
        total: 0,
        message: "Nenhum grupo válido retornado",
      });
    }

    // 4️⃣ Limpa grupos antigos da instância
    await pool.query(
      "DELETE FROM whatsapp_groups WHERE instance_id = $1",
      [instanceId]
    );

    // 5️⃣ Insere grupos conforme schema REAL
    for (const g of validGroups) {
      await pool.query(
        `
        INSERT INTO whatsapp_groups
          (instance_id, jid, name, active)
        VALUES
          ($1, $2, $3, true)
        `,
        [
          instanceId,
          g.id || g.jid,
          g.subject || g.name || "Grupo sem nome",
        ]
      );
    }

    return res.json({
      success: true,
      total: validGroups.length,
    });
  } catch (err) {
    console.error("Erro ao sincronizar grupos:", err);
    return res.status(500).json({
      error: "Erro interno ao sincronizar grupos",
    });
  }
});

/**
 * GET /api/groups/:instanceId
 * Lista grupos da instância
 */
router.get("/:instanceId", async (req, res) => {
  const { instanceId } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT id, jid, name, active
      FROM whatsapp_groups
      WHERE instance_id = $1
      ORDER BY name
      `,
      [instanceId]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("Erro ao listar grupos:", err);
    return res.status(500).json({
      error: "Erro ao listar grupos",
    });
  }
});

module.exports = router;
