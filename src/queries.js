// src/queries.js
require('dotenv').config();

let pool;

async function getPool() {
  if (!pool) {
    const { Pool } = await import('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
  }
  return pool;
}

function formatDateBR(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (isNaN(date)) return '-';
  const brOffset = -3 * 60;
  const local = new Date(date.getTime() + brOffset * 60 * 1000);
  const pad = n => n.toString().padStart(2, '0');
  return `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

async function getAllWithFilters({ editor, document, folder, page = 1, limit = 50, sort = 'tempo_desc' }) {
  const client = await getPool();

  let query = 'SELECT * FROM document_editors';
  let countQuery = 'SELECT COUNT(*) FROM document_editors';
  let where = [];
  let values = [];
  let paramIndex = 1;

  if (editor) {
    where.push(`"editorName" ILIKE $${paramIndex}`);
    values.push(`%${editor}%`);
    paramIndex++;
  }
  if (document) {
    where.push(`"documentName" ILIKE $${paramIndex}`);
    values.push(`%${document}%`);
    paramIndex++;
  }
  if (folder) {
    where.push(`"folderPath" ILIKE $${paramIndex}`);
    values.push(`%${folder}%`);
    paramIndex++;
  }

  if (where.length > 0) {
    const clause = where.join(' AND ');
    query += ` WHERE ${clause}`;
    countQuery += ` WHERE ${clause}`;
  }

  const orderMap = {
    'tempo_desc': '"totalMinutes" DESC',
    'tempo_asc': '"totalMinutes" ASC',
    'nome_desc': '"documentName" DESC',
    'nome_asc': '"documentName" ASC',
    'ultima_desc': '"lastEdit" DESC',
    'ultima_asc': '"lastEdit" ASC',
  };
  query += ` ORDER BY ${orderMap[sort] || '"totalMinutes" DESC'}`;

  const offset = (page - 1) * limit;
  query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  values.push(limit, offset);

  try {
    const [dataResult, countResult] = await Promise.all([
      client.query(query, values),
      client.query(countQuery, where.length > 0 ? values.slice(0, where.length) : [])
    ]);

    const total = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(total / limit);

    const formattedData = dataResult.rows.map(row => ({
      ...row,
      firstEdit: formatDateBR(row.firstEdit),
      lastEdit: formatDateBR(row.lastEdit),
    }));

    return {
      data: formattedData,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages
    };
  } catch (err) {
    console.error('Erro em getAllWithFilters:', err.message);
    throw err;
  }
}

module.exports = { getAllWithFilters };