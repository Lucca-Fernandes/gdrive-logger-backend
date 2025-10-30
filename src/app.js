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
app.use('/api', routes);

const ultimoEdit = new Map();
const TOKEN_ROW_ID = 'PAGE_TOKEN_001'; // ID especial

// === TOKEN NO BANCO (SUA TABELA!) ===
async function getPageToken() {
  const res = await pool.query(
    'SELECT page_token FROM document_editors WHERE "documentId" = $1',
    [TOKEN_ROW_ID]
  );
  return res.rows[0]?.page_token || null;
}

async function setPageToken(token) {
  await pool.query(`
    INSERT INTO document_editors (
      "documentId", "documentName", "editorName", "firstEdit", "lastEdit", "totalMinutes", page_token
    ) VALUES ($1, 'Sistema', 'monitor', NOW(), NOW(), 0, $2)
    ON CONFLICT ("documentId", "editorName") DO UPDATE SET
      page_token = $2,
      "lastEdit" = NOW()
  `, [TOKEN_ROW_ID, token]);
}

// === MONITOR (COMO NO GOOGLE SHEETS) ===
async function cicloMonitor() {
  try {
    const drive = getClient();
    let pageToken = await getPageToken();

    if (!pageToken) {
      console.log('[Monitor] Primeira vez: pegando token inicial...');
      const res = await drive.changes.getStartPageToken();
      pageToken = res.data.startPageToken;
      await setPageToken(pageToken);
      console.log('[Monitor] Token inicial salvo!');
      return;
    }

    const res = await drive.changes.list({
      pageToken,
      pageSize: 100,
      fields: 'newStartPageToken,changes(file/id,file/name,file/modifiedTime)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });

    if (res.data.newStartPageToken) {
      await setPageToken(res.data.newStartPageToken);
    }

    for (const change of res.data.changes || []) {
      const file = change.file;
      if (!file?.id || !file?.modifiedTime) continue;

      const key = `${file.id}-desconhecido`;
      const agora = new Date(file.modifiedTime);
      let tempoAdd = 0;

      if (ultimoEdit.has(key)) {
        const diff = (agora - ultimoEdit.get(key)) / 1000;
        if (diff >= 30 && diff <= 3600) {
          tempoAdd = Math.round(diff / 60 * 10) / 10;
        }
      } else {
        tempoAdd = 0.5;
      }

      const current = await pool.query(
        'SELECT "totalMinutes" FROM document_editors WHERE "documentId" = $1 AND "editorName" = $2',
        [file.id, 'desconhecido']
      );

      const total = (current.rows[0]?.totalMinutes || 0) + tempoAdd;

      await pool.query(`
        INSERT INTO document_editors (
          "documentId", "documentName", "editorName", "firstEdit", "lastEdit", "totalMinutes"
        ) VALUES ($1, $2, 'desconhecido', $3, $3, $4)
        ON CONFLICT ("documentId", "editorName") DO UPDATE SET
          "totalMinutes" = EXCLUDED."totalMinutes",
          "lastEdit" = EXCLUDED."lastEdit"
      `, [file.id, file.name || 'Sem nome', agora.toISOString(), total]);

      if (tempoAdd > 0) {
        console.log(`[Neon] +${tempoAdd} min → ${file.name}`);
      }

      ultimoEdit.set(key, agora);
    }

  } catch (err) {
    console.error('Erro no monitor:', err.message);
  }
}

// === INICIAR ===
(async () => {
  await authenticate();
  console.log('Sistema iniciado: Monitor + API');

  await cicloMonitor();
  setInterval(cicloMonitor, 30 * 1000);

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`API rodando em http://localhost:${PORT}/api/data`);
  });
})();