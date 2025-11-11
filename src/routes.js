// src/routes.js
const express = require('express');
const router = express.Router();
const { pool } = require('./db.js');

// Mapeamento de cargos (mantido aqui para a nova rota funcionar)
// Dentro do routes.js (no início do arquivo)
const CARGOS_MOCK = {
  'everton.marques': 'Web Designer',
  'flavio.junior': 'Roteirista',
  'jonatas.barreto': 'Roteirista',
  'amanda.delrio': 'Revisão',
  'nilce.almeida': 'Revisão',
  'monica.alves': 'Pesquisa Iconográfica',
  'nubia.santiago': 'Pesquisa Iconográfica',
  'gabriela.amaro': 'Designer Gráfico',
  'laura.amorim': 'Designer Gráfico',
  'stephanie.gomes': 'Revisão',
  'thiago.santos': 'Designer Gráfico',
  'viviane.gonzaga': 'Design Educacional',
  'willy': 'Revisão',
  'liliene.santana': 'Design Educacional',
  'tamires.ferreira': 'Design Educacional',
  'vicente.silva': 'Design Educacional',
  'deijiane.cruz': 'Coordenadora do Eixo de Gestão',
  'matheus.souza': 'Coordenadora do Eixo de Gestão',
  'leandro.azevedo': 'Coordenadora de TI',
  'valerio.oliveira': 'Coordenador de Validação',
  'fabio.pessoa': 'Coordenador de Turismo',
};

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

// ROTA DE DADOS (COM BUSCA E PAGINAÇÃO)
router.get('/data', async (req, res) => {
  try {
    const { search, startDate, endDate, page = 1, limit = 9 } = req.query;

    let values = [];
    let whereClauses = [];
    let idx = 1;

    if (startDate) {
      whereClauses.push(`"event_time" >= $${idx++}`);
      values.push(startDate);
    }
    if (endDate) {
      whereClauses.push(`"event_time" <= $${idx++}`);
      values.push(endDate);
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
        FROM time_logs
        ${whereString} 
        GROUP BY document_id, editor_name
      )
      SELECT * FROM AggregatedData
      ORDER BY "totalMinutes" DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    const countQuery = `
      WITH AggregatedData AS (
        SELECT 1 FROM time_logs
        ${whereString}
        GROUP BY document_id, editor_name
      )
      SELECT COUNT(*) FROM AggregatedData
    `;

    const limitNum = parseInt(limit, 10);
    const pageNum = parseInt(page, 10);
    const offset = (pageNum - 1) * limitNum;
    values.push(limitNum, offset);

    const countValues = values.slice(0, -2);

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, values),
      pool.query(countQuery, countValues)
    ]);

    res.json({
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].count, 10),
      page: pageNum,
      limit: limitNum
    });

  } catch (err) {
    console.error('Erro na rota /data:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// NOVA ROTA: Resumo de editores por cargo (SEM paginação) - CORREÇÃO DO BUG
router.get('/cargo/:cargo/editors-summary', async (req, res) => {
  try {
    const { cargo } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.json([]);
    }

    // Monta mapeamento cargo → editores
    const cargoToEditors = {};
    Object.entries(CARGOS_MOCK).forEach(([editor, c]) => {
      if (!cargoToEditors[c]) cargoToEditors[c] = [];
      cargoToEditors[c].push(editor);
    });

    const editors = cargoToEditors[cargo] || [];
    if (editors.length === 0) return res.json([]);

    const result = await pool.query(`
      SELECT 
        editor_name as "editorName",
        SUM(minutes_added) as "totalMinutes",
        COUNT(DISTINCT document_id) as "documentCount",
        MAX(event_time) as "lastEdit"
      FROM time_logs
      WHERE event_time >= $1 
        AND event_time <= $2
        AND editor_name = ANY($3)
      GROUP BY editor_name
      ORDER BY "totalMinutes" DESC
    `, [startDate, endDate, editors]);

    const summary = result.rows.map(row => ({
      editorName: row.editorName,
      totalMinutes: Number(row.totalMinutes) || 0,
      totalDocuments: Number(row.documentCount) || 0,
      lastEdit: row.lastEdit
    }));

    res.json(summary);
  } catch (err) {
    console.error('Erro em /cargo/:cargo/editors-summary:', err.message);
    res.status(500).json({ error: err.message });
  }
  console.log('Cargo solicitado:', cargo);
  console.log('Editores encontrados:', editors);
});

// ROTA DE RANKING (TOP EDITORES)
router.get('/ranking', async (req, res) => {
  const { startDate, endDate } = req.query;
  let values = [];
  let whereClauses = [];
  let idx = 1;

  if (startDate) {
    whereClauses.push(`"event_time" >= $${idx++}`);
    values.push(startDate);
  }
  if (endDate) {
    whereClauses.push(`"event_time" <= $${idx++}`);
    values.push(endDate);
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
    whereClauses.push(`"event_time" >= $${idx++}`);
    values.push(startDate);
  }
  if (endDate) {
    whereClauses.push(`"event_time" <= $${idx++}`);
    values.push(endDate);
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
    FROM time_logs
    ${whereString}
    GROUP BY eixo
    ORDER BY "totalMinutes" DESC;
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
    whereClauses.push(`"event_time" >= $${idx++}`);
    values.push(startDate);
  }
  if (endDate) {
    whereClauses.push(`"event_time" <= $${idx++}`);
    values.push(endDate);
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
    FROM time_logs
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