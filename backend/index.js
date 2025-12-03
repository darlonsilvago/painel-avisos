// Carregar variáveis de ambiente
require('dotenv').config();

// Imports
const express = require('express');
const cors = require('cors');
const { pool } = require('./db');

// Rotas
const authRoutes = require('./routes/auth');
const instancesRoutes = require('./routes/instances');
const groupsRoutes = require('./routes/groups');
const contactsRoutes = require('./routes/contacts');
const sendRoutes = require('./routes/send');


// Criar app
const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

// aceitar JSON e forms até 2 MB (suficiente para imagem de até 1 MB em base64)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));




// Rota de teste
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ ok: true, dbTime: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/instances', instancesRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/send', sendRoutes);

// Iniciar servidor
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Backend rodando na porta ${port}`);
});
