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

// === CONFIGURAÇÕES ===
const ultimoEdit = new Map();
const TOKEN_ROW_ID = 'PAGE_TOKEN_SYSTEM'; // ID especial no banco

// === FUNÇÕES DO TOKEN ===
async function getPageToken() {
  try {
    const res = await pool.query(
      'SELECT page_token FROM document_editors WHERE "documentId" = $1',
      [TOKEN_ROW_ID]
    );
    return res.rows[0]?.page_token || null;
  } catch (err) {
    console.error('[Token] Erro ao ler:', err.message);
    return null;
  }
}

async function setPageToken(token) {
  try {
    await pool.query(`
      INSERT INTO document_editors (
        "documentId", "documentName", "editorName", "firstEdit", "lastEdit", "totalMinutes", page_token
      ) VALUES ($1, 'Sistema', 'monitor', NOW(), NOW(), 0, $2)
      ON CONFLICT ("documentId") DO UPDATE SET
        page_token = $2,
        "lastEdit" = NOW()
    `, [TOKEN_ROW_ID, token]);
    console.log(`[Token] Salvo: ${token.substring(0, 20)}...`);
  } catch (err) {
    console.error('[Token] Erro ao salvar:', err.message);
  }
}

// === MONTAR CAMINHO DA PASTA (RECURSIVO) ===
async function buildFolderPath(folderId, drive, path = []) {
  if (!folderId || folderId === 'root') {
    return path.reverse().join('/') || '/';
  }

  try {
    const res = await drive.files.get({
      fileId: folderId,
      fields: 'name, parents',
      supportsAllDrives: true
    });
    const folder = res.data;
    path.push(folder.name);
    if (folder.parents && folder.parents[0]) {
      return await buildFolderPath(folder.parents[0], drive, path);
    }
  } catch (err) {
    console.log(`[FolderPath] Erro ao buscar pasta ${folderId}:`, err.message);
  }
  return path.reverse().join('/') || '/';
}

// === MONITOR 24/7 ===
async function cicloMonitor() {
  console.log('[Monitor] === INICIANDO CICLO ===');

  try {
    const drive = getClient();
    let pageToken = await getPageToken();

    // PRIMEIRA EXECUÇÃO
    if (!pageToken) {
      console.log('[Monitor] Primeira execução: obtendo token inicial...');
      const res = await drive.changes.getStartPageToken();
      pageToken = res.data.startPageToken;
      await setPageToken(pageToken);
      console.log('[Monitor] Token inicial salvo!');
      return;
    }

    console.log(`[Monitor] Verificando mudanças desde token: ${pageToken.substring(0, 20)}...`);

    // CAMPOS OBRIGATÓRIOS PARA PEGAR TUDO
    const res = await drive.changes.list({
      pageToken,
      pageSize: 100,
      fields: 'newStartPageToken,changes(file(id,name,modifiedTime,webViewLink,lastModifyingUser(displayName),parents,mimeType))',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });

    const newToken = res.data.newStartPageToken;
    if (newToken && newToken !== pageToken) {
      await setPageToken(newToken);
      console.log('[Monitor] Token atualizado!');
    }

    const changes = res.data.changes || [];
    if (changes.length === 0) {
      console.log('[Monitor] Nenhuma mudança detectada.');
      return;
    }

    console.log(`[Monitor] ${changes.length} mudança(s) detectada(s)!`);

    for (const change of changes) {
      const file = change.file;
      if (!file?.id || !file?.modifiedTime) continue;

      // === LINK DO DOCUMENTO ===
      const documentLink = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;

      // === NOME DO EDITOR ===
      const editorName = file.lastModifyingUser?.displayName || 'desconhecido';

      // === CAMINHO DA PASTA ===
      let folderPath = '/';
      if (file.parents && file.parents.length > 0) {
        try {
          folderPath = await buildFolderPath(file.parents[0], drive);
        } catch (err) {
          console.log(`[Erro] Pasta do arquivo ${file.id}:`, err.message);
        }
      }

      // === CÁLCULO DO TEMPO ===
      const key = `${file.id}-${editorName}`;
      const agora = new Date(file.modifiedTime);
      let tempoAdd = 0;

      if (ultimoEdit.has(key)) {
        const diff = (agora - ultimoEdit.get(key)) / 1000;
        if (diff >= 30 && diff <= 3600) {
          tempoAdd = Math.round(diff / 60 * 10) / 10;
        }
      } else {
        tempoAdd = 0.5; // Primeira detecção
      }

      // === BUSCAR TOTAL ATUAL ===
      const current = await pool.query(
        'SELECT "totalMinutes" FROM document_editors WHERE "documentId" = $1 AND "editorName" = $2',
        [file.id, editorName]
      );

      const total = (current.rows[0]?.totalMinutes || 0) + tempoAdd;

      // === SALVAR NO BANCO ===
      await pool.query(`
        INSERT INTO document_editors (
          "documentId", "documentName", "documentLink", "folderPath", "editorName",
          "firstEdit", "lastEdit", "totalMinutes"
        ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7)
        ON CONFLICT ("documentId", "editorName") DO UPDATE SET
          "documentName" = EXCLUDED."documentName",
          "documentLink" = EXCLUDED."documentLink",
          "folderPath" = EXCLUDED."folderPath",
          "lastEdit" = EXCLUDED."lastEdit",
          "totalMinutes" = EXCLUDED."totalMinutes"
      `, [
        file.id,
        file.name || 'Sem nome',
        documentLink,
        folderPath,
        editorName,
        agora.toISOString(),
        total
      ]);

      if (tempoAdd > 0) {
        console.log(`[Neon] +${tempoAdd} min → ${file.name} (${editorName}) [${folderPath}]`);
      }

      ultimoEdit.set(key, agora);
    }

    console.log('[Monitor] === CICLO CONCLUÍDO ===');

  } catch (err) {
    console.error('[Monitor] ERRO CRÍTICO:', err.message);
  }
}

// === INICIAR SERVIDOR ===
(async () => {
  try {
    await authenticate();
    console.log('Sistema iniciado: Monitor + API');

    // Primeiro ciclo
    await cicloMonitor();

    // Depois a cada 30 segundos
    setInterval(cicloMonitor, 30 * 1000);

    const PORT = process.env.PORT || 10000;
    app.listen(PORT, () => {
      console.log(`API rodando em http://localhost:${PORT}/api/data`);
    });
  } catch (err) {
    console.error('Erro fatal:', err.message);
    process.exit(1);
  }
})();