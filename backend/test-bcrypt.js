require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt'); // usa a mesma lib do backend

const pool = new Pool({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

(async () => {
  try {
    const email = 'admin@painel.com';
    const senhaPura = '12457879';

    // 1) Gera um hash novo com o bcrypt do backend
    const hash = await bcrypt.hash(senhaPura, 10);
    console.log('Novo hash gerado:', hash);

    // 2) Atualiza o usuário no banco da VPS
    await pool.query(
      'UPDATE users SET password = $1 WHERE email = $2',
      [hash, email]
    );
    console.log('Senha atualizada no banco para o usuário', email);

    // 3) Busca o usuário de volta pra conferir
    const { rows } = await pool.query(
      'SELECT id, email, password FROM users WHERE email = $1',
      [email]
    );
    console.log('Row:', rows[0]);

    // 4) Testa a comparação com bcrypt
    const ok = await bcrypt.compare(senhaPura, rows[0].password);
    console.log('Senha confere?', ok);

    process.exit(0);
  } catch (err) {
    console.error('ERRO NO TESTE:', err);
    process.exit(1);
  }
})();
