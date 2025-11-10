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

// ==========================================================
// ROTA DE DADOS (CORRIGIDA COM PAGINAÇÃO CONDICIONAL)
// ==========================================================
router.get('/data', async (req, res) => {
  try {
    // MUDANÇA 1: Removidos os valores padrão de 'page' e 'limit'
    const { search, startDate, endDate, page, limit } = req.query;
    
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
    if (search) {
      whereClauses.push(`("document_name" ILIKE $${idx} OR "editor_name" ILIKE $${idx})`);
      values.push(`%${search}%`); 
      idx++;
    }

    if (!startDate || !endDate) {
      return res.json({ data: [], total: 0, page: 1, limit: 0 });
    }

    const whereString = `WHERE ${whereClauses.join(' AND ')}`;

    // MUDANÇA 2: 'dataQuery' agora é 'let' e NÃO TEM 'LIMIT'/'OFFSET'
    let dataQuery = `
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
    `;
    
    // A query de contagem continua igual
    const countQuery = `
      WITH AggregatedData AS (
        SELECT 1 FROM time_logs
        ${whereString}
        GROUP BY document_id, editor_name
      )
      SELECT COUNT(*) FROM AggregatedData
    `;

    // MUDANÇA 3: Lógica de paginação movida para um bloco 'if'
    
    // Salva os valores da query de contagem (que nunca tem paginação)
    const countValues = [...values]; 

    // Adiciona paginação à query de dados APENAS SE 'limit' e 'page' forem passados
    if (limit && page) {
      const parsedLimit = parseInt(limit, 10);
      const parsedPage = parseInt(page, 10);
      const offset = (parsedPage - 1) * parsedLimit;
      
      dataQuery += ` LIMIT $${idx++} OFFSET $${idx++}`; // Adiciona ao SQL
      values.push(parsedLimit); // Adiciona aos valores da dataQuery
      values.push(offset);
    }

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, values), // 'values' pode ou não ter paginação
      pool.query(countQuery, countValues) // 'countValues' nunca tem paginação
    ]);

    res.json({
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].count),
      // MUDANÇA 4: Garante que 'page' e 'limit' não sejam NaN e REMOVE O ESPAÇO
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 0
    });

  } catch (err) {
    console.error('Erro na rota /data:', err.message);
    // Adiciona uma resposta de erro para o cliente
    res.status(500).json({ error: 'Erro interno no servidor', details: err.message });
  }
});

// ==========================================================
// OUTRAS ROTAS (SEM MUDANÇAS)
// ==========================================================

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

// ROTA DE SUMÁRIO DOS EIXOS
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
    return res.json([]); 
  }

  const whereString = `WHERE ${whereClauses.join(' AND ')}`;

  const query = `
    SELECT 
      CASE
        WHEN "folder_path" LIKE '%01. Gestão & Negócios%' THEN 'Gestão & Negócios'
        WHEN "folder_path" LIKE '%02. Turismo, Hospitalidade & Lazer%' THEN 'Turismo, Hosp. & Lazer'
        WHEN "folder_path" LIKE '%03. Informação & Comunicação%' THEN 'Informação & Comunicação'
        WHEN "folder_path" LIKE '%04. Mundo do Trabalho%' THEN 'Mundo do Trabalho'
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

// ROTA DE SUMÁRIO DAS ESTATÍSTICAS
router.get('/stats-summary', async (req, res) => {
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
    return res.json({ totalMinutes: 0, totalEditors: 0, totalDocs: 0 });
  }

  const whereString = `WHERE ${whereClauses.join(' AND ')}`;

  const query = `
    SELECT 
      SUM(minutes_added) as "totalMinutes",
      COUNT(DISTINCT editor_name) as "totalEditors",
      COUNT(DISTINCT document_id) as "totalDocs"
    FROM 
      time_logs
    ${whereString};
  `;

  try {
    const result = await pool.query(query, values);
	const stats = result.rows[0];
    
    res.json({
      totalMinutes: Number(stats.totalMinutes) || 0,
      totalEditors: Number(stats.totalEditors) || 0,
      totalDocs: Number(stats.totalDocs) || 0
    });
  } catch (err) {
    console.error('Erro na rota /stats-summary:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ROTA DE SAÚDE
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = router;