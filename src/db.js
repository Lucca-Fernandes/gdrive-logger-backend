// src/db.js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Testa conexão (opcional, mas recomendado)
pool.on('error', (err) => {
  console.error('Erro no pool do PostgreSQL:', err.message);
});

module.exports = { pool };