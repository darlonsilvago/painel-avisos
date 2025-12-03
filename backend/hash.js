// backend/hash.js
const bcrypt = require('bcrypt');

async function run() {
  const password = 'admin123'; // você pode trocar pela senha que quiser
  const hash = await bcrypt.hash(password, 10);
  console.log('Senha em texto claro:', password);
  console.log('Hash gerado:', hash);
}

run();
