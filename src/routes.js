// src/routes.js
const express = require('express');
const router = express.Router();
const { pool } = require('./db.js');

function formatBR(date) {
  const d = new Date(date);
  const pad = n => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ROTA 1: /api/data
router.get('/data', async (req, res) => {
  try {
    const { editor, page = 1, limit = 50 } = req.query;
    let query = 'SELECT * FROM document_editors';
    let values = [];
    let idx = 1;

    if (editor) {
      query += ` WHERE "editorName" ILIKE $${idx}`;
      values.push(`%${editor}%`);
      idx++;
    }

    const countRes = await pool.query(
      'SELECT COUNT(*) FROM document_editors' + (editor ? ` WHERE "editorName" ILIKE $1` : ''),
      editor ? [`%${editor}%`] : []
    );

    query += ` ORDER BY "totalMinutes" DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    values.push(parseInt(limit), (page - 1) * limit);

    const result = await pool.query(query, values);

    res.json({
      data: result.rows.map(r => ({ ...r, lastEdit: formatBR(r.lastEdit) })),
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
    GROUP BY "editorName"
    ORDER BY total DESC
    LIMIT 10
  `);
  res.json(result.rows);
});

// ROTA 3: /api/today
router.get('/today', async (req, res) => {
  const hoje = new Date().toISOString().split('T')[0];
  const result = await pool.query(`
    SELECT SUM("totalMinutes") as total
    FROM document_editors
    WHERE DATE("lastEdit") = $1
  `, [hoje]);
  res.json({ totalToday: result.rows[0].total || 0 });
});

// ROTA 4: /api/export
router.get('/export', async (req, res) => {
  const result = await pool.query('SELECT * FROM document_editors ORDER BY "totalMinutes" DESC');
  const csv = [
    'Documento,Editor,Minutos,Última Edição',
    ...result.rows.map(r => `"${r.documentName}","${r.editorName}",${r.totalMinutes},"${formatBR(r.lastEdit)}"`)
  ].join('\n');

  res.header('Content-Type', 'text/csv');
  res.attachment('relatorio.csv');
  res.send(csv);
});

// ROTA 5: /health
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;