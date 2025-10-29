// src/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authenticate, getClient } = require('./drive.js');
const routes = require('./routes.js');
const { pool } = require('./db.js');

const app = express();
app.use(cors());
app.use(express.json());

// === ROTAS ===
app.use('/api', routes);

// === MONITOR 24/7 ===
let pageToken = null;
const ultimoEdit = new Map();

async function cicloMonitor() {
  try {
    const drive = getClient();
    if (!pageToken) {
      const res = await drive.changes.getStartPageToken();
      pageToken = res.data.startPageToken;
    }

    const res = await drive.changes.list({
      pageToken,
      fields: 'changes(file/id,file/name,file/modifiedTime),newStartPageToken',
      pageSize: 100
    });

    pageToken = res.data.newStartPageToken;

    for (const change of res.data.changes || []) {
      const file = change.file;
      if (!file?.id || !file?.modifiedTime) continue;

      const key = `${file.id}-desconhecido`;
      const agora = new Date(file.modifiedTime);
      let tempoAdd = 0;

      if (ultimoEdit.has(key)) {
        const diff = (agora - ultimoEdit.get(key)) / 1000;
        if (diff >= 30 && diff <= 3000) {
          tempoAdd = Math.round(diff / 60 * 10) / 10;
        }
      }

      const current = await pool.query(
        `SELECT "totalMinutes" FROM document_editors WHERE "documentId" = $1 AND "editorName" = 'desconhecido'`,
        [file.id]
      );

      const total = (current.rows[0]?.totalMinutes || 0) + tempoAdd;

      await pool.query(`
        INSERT INTO document_editors ("documentId", "documentName", "editorName", "totalMinutes", "lastEdit")
        VALUES ($1, $2, 'desconhecido', $3, $4)
        ON CONFLICT ("documentId", "editorName") DO UPDATE SET
          "totalMinutes" = EXCLUDED."totalMinutes",
          "lastEdit" = EXCLUDED."lastEdit"
      `, [file.id, file.name || 'Sem nome', total, agora.toISOString()]);

      if (tempoAdd > 0) console.log(`[Neon] +${tempoAdd} min → ${file.name}`);
      ultimoEdit.set(key, agora);
    }
  } catch (err) {
    console.error('Erro no monitor:', err.message);
  }
}

// === INICIAR ===
(async () => {
  try {
    await authenticate();
    console.log('Sistema iniciado: Monitor + API');

    setInterval(cicloMonitor, 30 * 1000);
    cicloMonitor();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`API rodando em http://localhost:${PORT}/api/data`);
    });
  } catch (err) {
    console.error('Erro fatal:', err.message);
    process.exit(1);
  }
})();