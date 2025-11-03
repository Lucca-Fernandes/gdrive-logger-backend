// src/routes.js
const express = require('express');
const router = express.Router();
const { pool } = require('./db.js');

/**
 * FUNÇÃO CORRIGIDA
 * Converte a data (armazenada em UTC) para o fuso horário de São Paulo (GMT-3)
 * e formata para o padrão pt-BR.
 */
function formatBR(date) {
  if (!date) return '';
  const d = new Date(date);
  
  // 'toLocaleString' permite forçar o fuso horário e o formato
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ROTA 1: /api/data
router.get('/data', async (req, res) => {
  try {
    const { editor, page = 1, limit = 50 } = req.query;
    let query = 'SELECT * FROM document_editors';
    let values = [];
    let idx = 1;

    // Remove o registro do PAGE_TOKEN da listagem
    query += ` WHERE "documentId" != 'PAGE_TOKEN_SYSTEM'`;

    if (editor) {
      query += ` AND "editorName" ILIKE $${idx}`;
      values.push(`%${editor}%`);
      idx++;
    }

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM document_editors WHERE "documentId" != 'PAGE_TOKEN_SYSTEM'` + 
      (editor ? ` AND "editorName" ILIKE $1` : ''),
      editor ? [`%${editor}%`] : []
    );

    query += ` ORDER BY "totalMinutes" DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    values.push(parseInt(limit), (page - 1) * limit);

    const result = await pool.query(query, values);

    res.json({
      // Esta linha agora usará a nova função formatBR
      data: result.rows.map(r => ({ ...r, lastEdit: formatBR(r.lastEdit), firstEdit: formatBR(r.firstEdit) })),
      total: parseInt(countRes.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ROTA 2: /api/ranking
router.get('/ranking', async (req, res) => {
  const result = await pool.query(`
    SELECT "editorName", SUM("totalMinutes") as total
    FROM document_editors
    WHERE "documentId" != 'PAGE_TOKEN_SYSTEM'
    GROUP BY "editorName"
    ORDER BY total DESC
    LIMIT 10
  `);
  res.json(result.rows);
});

// ROTA 3: /api/today
router.get('/today', async (req, res) => {
  // Converte a data de hoje para o fuso de SP para a query
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // Formato YYYY-MM-DD

  const result = await pool.query(`
    SELECT SUM("totalMinutes") as total
    FROM document_editors
    WHERE DATE("lastEdit" AT TIME ZONE 'America/Sao_Paulo') = $1
    AND "documentId" != 'PAGE_TOKEN_SYSTEM'
  `, [hoje]);
  res.json({ totalToday: result.rows[0].total || 0 });
});

// ROTA 4: /api/export
router.get('/export', async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM document_editors WHERE "documentId" != 'PAGE_TOKEN_SYSTEM' ORDER BY "totalMinutes" DESC`
  );
  
  const csv = [
    'Documento,Editor,Minutos,Última Edição',
    // Esta linha também usará a nova função formatBR
    ...result.rows.map(r => `"${r.documentName}","${r.editorName}",${r.totalMinutes},"${formatBR(r.lastEdit)}"`)
  ].join('\n');

  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment('relatorio.csv');
  res.send(Buffer.from(csv, 'utf-8')); // Garante encoding correto
});

// ROTA 5: /health
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;