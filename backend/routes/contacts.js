// backend/routes/contacts.js
const express = require('express');
const { pool } = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { evoFetchGroupParticipants } = require('../services/evolution');
const { normalizePhone } = require('../utils/phone');



const router = express.Router();

// todas as rotas de contatos exigem login
router.use(authMiddleware);

// GET /api/contacts
// ?search=nomeOuTelefone  (opcional)
// ?active=true/false      (opcional)
router.get('/', async (req, res) => {
  const { search, active } = req.query;

  let query = 'SELECT * FROM contacts WHERE 1=1';
  const params = [];

  if (active === 'true') {
    params.push(true);
    query += ` AND active = $${params.length}`;
  } else if (active === 'false') {
    params.push(false);
    query += ` AND active = $${params.length}`;
  }

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (name ILIKE $${params.length} OR phone ILIKE $${params.length})`;
  }

  query += ' ORDER BY name';

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Erro ao listar contatos:', err.message);
    res.status(500).json({ error: 'Erro ao listar contatos' });
  }
});

// POST /api/contacts
router.post('/', async (req, res) => {
  const { name, phone, tags, notes } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO contacts (name, phone, tags, notes, active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING *`,
      [name, phone, tags || null, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao criar contato:', err.message);
    res.status(500).json({ error: 'Erro ao criar contato' });
  }
});

// PUT /api/contacts/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, phone, tags, notes, active } = req.body;

  try {
    const result = await pool.query(
      `UPDATE contacts
       SET name = $1,
           phone = $2,
           tags = $3,
           notes = $4,
           active = COALESCE($5, active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [name, phone, tags || null, notes || null, active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar contato:', err.message);
    res.status(500).json({ error: 'Erro ao atualizar contato' });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM contacts WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao deletar contato:', err.message);
    res.status(500).json({ error: 'Erro ao deletar contato' });
  }
});
// POST /api/contacts/bulk
// Salvar / atualizar vários contatos de uma vez
// body: { contacts: [ { name, phone, tags?, notes? }, ... ] }
router.post('/bulk', async (req, res) => {
  const { contacts } = req.body;

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res
      .status(400)
      .json({ error: 'Envie um array "contacts" com pelo menos 1 contato.' });
  }

  try {
    let saved = 0;

    for (const c of contacts) {
      if (!c || !c.phone) continue;

      // só números
      let phone = String(c.phone).replace(/\D/g, '');
      if (!phone) continue;

      const name = c.name || phone;
      const tags = c.tags || null;
      const notes = c.notes || null;

      await pool.query(
        `INSERT INTO contacts (name, phone, tags, notes, active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (phone)
         DO UPDATE SET
           name = EXCLUDED.name,
           tags = EXCLUDED.tags,
           notes = EXCLUDED.notes,
           active = true`,
        [name, phone, tags, notes]
      );

      saved++;
    }

    res.json({ saved });
  } catch (err) {
    console.error('Erro ao salvar contatos em massa:', err.message);
    res.status(500).json({ error: 'Erro ao salvar contatos em massa' });
  }
});

// POST /api/contacts/import-from-group
// body: { instanceId, groupJid }
//
// Busca participantes do grupo na Evolution
// e salva no banco na tabela contacts
router.post('/import-from-group', async (req, res) => {
  const { instanceId, groupJid } = req.body;

  if (!instanceId || !groupJid) {
    return res
      .status(400)
      .json({ error: 'instanceId e groupJid são obrigatórios.' });
  }

  try {
    // 1) pegar a instância para descobrir o evolution_instance_id
    const instRes = await pool.query(
      'SELECT * FROM whatsapp_instances WHERE id = $1',
      [instanceId]
    );
    const instance = instRes.rows[0];

    if (!instance) {
      return res.status(404).json({ error: 'Instância não encontrada.' });
    }

    // 2) tentar achar o grupo no banco (pra usar o nome como tag/nota)
    const groupRes = await pool.query(
      'SELECT * FROM whatsapp_groups WHERE instance_id = $1 AND jid = $2',
      [instanceId, groupJid]
    );
    const group = groupRes.rows[0];

    // 3) buscar participantes na Evolution
    const raw = await evoFetchGroupParticipants(
      instance.evolution_instance_id,
      groupJid
    );

    // a Evolution pode responder de formas diferentes:
    // às vezes é um array direto, às vezes vem em raw.participants
    let participants = [];
    if (Array.isArray(raw)) {
      participants = raw;
    } else if (Array.isArray(raw?.participants)) {
      participants = raw.participants;
    }

    if (participants.length === 0) {
      return res.json({
        totalFound: 0,
        saved: 0,
        message: 'Nenhum participante retornado pela Evolution.',
      });
    }

    let saved = 0;
    const seenPhones = new Set();

    for (const p of participants) {
      // tenta detectar o campo correto do número
      let phone =
        p.id || p.wid || p.number || p.phone || p.jid || null;

      if (!phone) continue;

      // remove @s.whatsapp.net, etc, e deixa só dígitos
      phone = String(phone).replace(/@.*/, '').replace(/\D/g, '');
      if (!phone) continue;

      if (seenPhones.has(phone)) continue;
      seenPhones.add(phone);

      const name =
        p.name ||
        p.pushName ||
        p.notify ||
        p.shortName ||
        (group ? group.name : '') ||
        phone;

      const tags = group ? `grupo:${group.name}` : null;
      const notes = group
        ? `Importado do grupo ${group.name} (instância ${instance.name || instance.evolution_instance_id})`
        : `Importado da instância ${instance.name || instance.evolution_instance_id}`;

      await pool.query(
        `INSERT INTO contacts (name, phone, tags, notes, active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (phone)
         DO UPDATE SET
           name = EXCLUDED.name,
           tags = EXCLUDED.tags,
           notes = EXCLUDED.notes,
           active = true`,
        [name, phone, tags, notes]
      );

      saved++;
    }

    res.json({
      totalFound: participants.length,
      saved,
    });
  } catch (err) {
    console.error(
      'Erro ao importar contatos do grupo:',
      err.response?.data || err.message
    );
    res.status(500).json({
      error: 'Erro ao importar contatos do grupo',
      details: err.response?.data || undefined,
    });
  }
});
// Apagar contatos em massa
router.post('/bulk-delete', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Nenhum contato selecionado' });
    }

    await pool.query('DELETE FROM contacts WHERE id = ANY($1::int[])', [ids]);

    res.json({ ok: true, deleted: ids.length });
  } catch (err) {
    console.error('Erro ao apagar contatos em massa:', err);
    res.status(500).json({ error: 'Erro ao apagar contatos em massa' });
  }
});





module.exports = router;
