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
const ultimoEdit = new Map();

async function cicloMonitor() {
  console.log('[Monitor] === INICIANDO CICLO ===');
  
  try {
    const drive = getClient();
    let pageToken = await getPageToken();

    if (!pageToken) {
      console.log('[Monitor] NÃO TEM TOKEN - INICIANDO...');
      const res = await drive.changes.getStartPageToken();
      pageToken = res.data.startPageToken;
      await setPageToken(pageToken);
      console.log(`[Monitor] TOKEN INICIAL: ${pageToken.substring(0, 20)}...`);
      return;
    }

    console.log(`[Monitor] TOKEN ATUAL: ${pageToken.substring(0, 20)}...`);

    const res = await drive.changes.list({
      pageToken,
      pageSize: 100,
      fields: 'newStartPageToken,changes(file/id,file/name,file/modifiedTime,file/mimeType)',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });

    console.log(`[Monitor] RESPOSTA: ${res.data.newStartPageToken ? 'NOVO TOKEN' : 'MESMO TOKEN'}`);
    console.log(`[Monitor] MUDANÇAS: ${res.data.changes?.length || 0}`);

    const changes = res.data.changes || [];
    const newToken = res.data.newStartPageToken;

    if (newToken && newToken !== pageToken) {
      await setPageToken(newToken);
      console.log(`[Monitor] TOKEN ATUALIZADO: ${newToken.substring(0, 20)}...`);
    }

    if (changes.length === 0) {
      console.log('[Monitor] NENHUMA MUDANÇA - FIM DO CICLO');
      return;
    }

    for (let i = 0; i < changes.length; i++) {
      const change = changes[i];
      const file = change.file;
      
      console.log(`[Monitor] Arquivo ${i + 1}: ${file?.name || 'N/A'} (ID: ${file?.id})`);

      if (!file?.id || !file?.modifiedTime) {
        console.log('[Monitor] Arquivo inválido, pulando...');
        continue;
      }

      const mime = file.mimeType || '';
      const isDoc = mime.includes('document') || 
                    mime.includes('spreadsheet') || 
                    mime.includes('presentation') || 
                    (file.name && file.name.endsWith('.docx'));

      if (!isDoc) {
        console.log('[Monitor] Não é documento, pulando...');
        continue;
      }

      const key = `${file.id}-desconhecido`;
      const agora = new Date(file.modifiedTime);
      let tempoAdd = 0;

      if (ultimoEdit.has(key)) {
        const diff = (agora - ultimoEdit.get(key)) / 1000;
        if (diff >= 30 && diff <= 3600) {
          tempoAdd = Math.round(diff / 60 * 10) / 10;
          console.log(`[Monitor] Tempo adicionado: ${tempoAdd} min`);
        } else {
          console.log(`[Monitor] Tempo fora do range (${diff}s), pulando...`);
        }
      } else {
        tempoAdd = 0.5;
        console.log('[Monitor] Primeira edição: +0.5 min');
      }

      const current = await pool.query(
        'SELECT "totalMinutes" FROM document_editors WHERE "documentId" = $1 AND "editorName" = $2',
        [file.id, 'desconhecido']
      );

      const total = (current.rows[0]?.totalMinutes || 0) + tempoAdd;

      await pool.query(`
        INSERT INTO document_editors (
          "documentId", "documentName", "editorName", 
          "firstEdit", "lastEdit", "totalMinutes"
        ) VALUES ($1, $2, $3, $4, $4, $5)
        ON CONFLICT ("documentId", "editorName") DO UPDATE SET
          "totalMinutes" = EXCLUDED."totalMinutes",
          "lastEdit" = EXCLUDED."lastEdit"
      `, [file.id, file.name || 'Sem nome', 'desconhecido', agora.toISOString(), total]);

      if (tempoAdd > 0) {
        console.log(`[Neon] +${tempoAdd} min → ${file.name}`);
      }

      ultimoEdit.set(key, agora);
    }

    console.log('[Monitor] === CICLO CONCLUÍDO ===');

  } catch (err) {
    console.error('[Monitor] ERRO NO CICLO:', err.message);
  }
}

// === INICIAR ===
(async () => {
  try {
    await authenticate();
    console.log('Sistema iniciado: Monitor + API');

    // Primeiro ciclo
    await cicloMonitor();

    // Depois a cada 30 segundos
    setInterval(cicloMonitor, 30 * 1000);

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`API rodando em http://localhost:${PORT}/api/data`);
    });
  } catch (err) {
    console.error('Erro fatal:', err.message);
    process.exit(1);
  }
})();