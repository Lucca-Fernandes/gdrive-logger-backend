require('dotenv').config();

let pool;


async function initPool() {
  const { Pool } = await import('pg');
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  pool.on('connect', () => console.log('[DB] Conectado ao Neon'));
  pool.on('error', (err) => console.error('[DB] Erro:', err.message));
}

initPool();

module.exports = new Proxy({}, {
  get(target, prop) {
    if (!pool) throw new Error('Pool não inicializado ainda. Aguarde...');
    return pool[prop].bind(pool);
  }
});