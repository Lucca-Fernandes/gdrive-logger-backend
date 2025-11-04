// src/routes.js
const express = require('express');
const router = express.Router();
const { pool } = require('./db.js');

// ROTA DE LOGIN
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USER;
  const adminPass = process.env.ADMIN_PASS;
  if (username === adminUser && password === adminPass) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Credenciais inválidas' });
  }
});

// ROTA DE DADOS (PARA OS CARDS E PAGINAÇÃO)
router.get('/data', async (req, res) => {
  try {
    const { editor, startDate, endDate, page = 1, limit = 9 } = req.query;
    
    let values = [];
    let whereClauses = [];
    let idx = 1;

    if (startDate) {
      whereClauses.push(`"event_time" >= $${idx}`);
      values.push(startDate); idx++;
    }
    if (endDate) {
      whereClauses.push(`"event_time" <= $${idx}`);
      values.push(endDate); idx++;
    }
    if (editor) {
      whereClauses.push(`"editor_name" ILIKE $${idx}`);
      values.push(`%${editor}%`); idx++;
    }

    if (!startDate || !endDate) {
      return res.json({ data: [], total: 0, page: 1, limit: 0 });
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;

    // Consulta de dados com Agregação (CTE)
    const dataQuery = `
      WITH AggregatedData AS (
        SELECT 
          document_id as "documentId",
          editor_name as "editorName",
          MAX(document_name) as "documentName", 
          MAX(document_link) as "documentLink",
          MAX(folder_path) as "folderPath",
          SUM(minutes_added) as "totalMinutes",
          MAX(event_time) as "lastEdit"
        FROM 
          time_logs
        ${whereString}
        GROUP BY 
          document_id, editor_name
      )
      SELECT * FROM AggregatedData
      ORDER BY "totalMinutes" DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    
    // Consulta de Contagem
    const countQuery = `
      WITH AggregatedData AS (
        SELECT 1 FROM time_logs
        ${whereString}
        GROUP BY document_id, editor_name
      )
      SELECT COUNT(*) FROM AggregatedData
    `;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    values.push(parseInt(limit), offset);

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, values),
      pool.query(countQuery, values.slice(0, -2)) // Remove 'limit' e 'offset'
    ]);

    res.json({
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });

  } catch (err) {
    console.error('Erro na rota /data:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ROTA DE RANKING (TOP EDITORES)
router.get('/ranking', async (req, res) => {
  const { startDate, endDate } = req.query;
  let values = [];
  let whereClauses = [];
  let idx = 1;

  if (startDate) {
    whereClauses.push(`"event_time" >= $${idx}`);
    values.push(startDate); idx++;
  }
  if (endDate) {
    whereClauses.push(`"event_time" <= $${idx}`);
    values.push(endDate); idx++;
  }

  if (!startDate || !endDate) {
    return res.json([]);
  }

  const whereString = `WHERE ${whereClauses.join(' AND ')}`;

  const result = await pool.query(`
    SELECT "editor_name" as "editorName", SUM("minutes_added") as total
    FROM time_logs
    ${whereString}
    GROUP BY "editor_name"
    ORDER BY total DESC
    LIMIT 10
  `, values);
  res.json(result.rows);
});

// ==========================================================
// NOVA ROTA: /api/eixos-summary
// ==========================================================
router.get('/eixos-summary', async (req, res) => {
  const { startDate, endDate } = req.query;

  let values = [];
  let whereClauses = [];
  let idx = 1;

  if (startDate) {
    whereClauses.push(`"event_time" >= $${idx}`);
    values.push(startDate); idx++;
  }
  if (endDate) {
    whereClauses.push(`"event_time" <= $${idx}`);
    values.push(endDate); idx++;
  }
  if (!startDate || !endDate) {
    return res.json([]); // Retorna vazio se não houver datas
  }

  const whereString = `WHERE ${whereClauses.join(' AND ')}`;

  // Agrupa usando CASE para categorizar o 'folder_path'
  const query = `
    SELECT 
      CASE
        WHEN "folder_path" LIKE '/01. Gestão & Negócios%' THEN 'Gestão & Negócios'
        WHEN "folder_path" LIKE '/02. Turismo, Hospitalidade & Lazer%' THEN 'Turismo, Hosp. & Lazer'
        WHEN "folder_path" LIKE '/03. Informação & Comunicação%' THEN 'Informação & Comunicação'
        WHEN "folder_path" LIKE '/04. Mundo do Trabalho%' THEN 'Mundo do Trabalho'
        ELSE 'Outros'
      END as eixo,
      SUM(minutes_added) as "totalMinutes"
    FROM 
      time_logs
    ${whereString}
    GROUP BY 
      eixo
    ORDER BY
      "totalMinutes" DESC;
  `;

  try {
    const result = await pool.query(query, values);
    // Converte para número para evitar o bug do .toFixed() no frontend
    const data = result.rows.map(row => ({
      eixo: row.eixo,
      totalMinutes: Number(row.totalMinutes)
    }));
    res.json(data);
  } catch (err) {
    console.error('Erro na rota /eixos-summary:', err.message);
    res.status(500).json({ error: err.message });
  }
});
// ==========================================================

// ROTA DE EXPORTAÇÃO (CSV)
router.get('/export', async (req, res) => {
  try {
    const { editor, startDate, endDate } = req.query;
    
    let values = [];
    let whereClauses = [];
    let idx = 1;

    if (startDate) {
      whereClauses.push(`"event_time" >= $${idx}`);
      values.push(startDate); idx++;
    }
    if (endDate) {
      whereClauses.push(`"event_time" <= $${idx}`);
      values.push(endDate); idx++;
    }
    if (editor) {
      whereClauses.push(`"editor_name" ILIKE $${idx}`);
      values.push(`%${editor}%`); idx++;
    }
    
    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT * FROM time_logs 
      ${whereString} 
      ORDER BY "event_time" DESC
    `, values);

    const formatCSV = (date) => new Date(date).toLocaleString('pt-BR');

    const csv = [
      'Documento,Editor,Minutos Adicionados,Data Evento,Caminho',
      ...result.rows.map(r => 
        `"${r.document_name}","${r.editor_name}",${r.minutes_added},"${formatCSV(r.event_time)}","${r.folder_path}"`
      )
    ].join('\n');

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('relatorio_eventos.csv');
    res.send(Buffer.from(csv, 'utf-8'));
  } catch (err) {
    console.error('Erro na rota /export:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ROTA DE SAÚDE
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;