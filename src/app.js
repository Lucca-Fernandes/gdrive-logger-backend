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
const TOKEN_ROW_ID = 'PAGE_TOKEN_SYSTEM'; // ID especial no banco
const TEMPO_CICLO = 30 * 1000; // 30 segundos
const LIMITE_INATIVO = 3000; // 50 minutos (50 * 60)

// Cache de pastas em memória (para performance da API)
const folderCache = new Map();

// === FUNÇÕES DO TOKEN (Melhoradas) ===
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
    // TENTA UPDATE PRIMEIRO
    const updateRes = await pool.query(
      `UPDATE document_editors SET page_token = $1, "lastEdit" = NOW() WHERE "documentId" = $2`,
      [token, TOKEN_ROW_ID]
    );

    // SE NÃO ATUALIZOU NENHUM (não existia), FAZ INSERT
    if (updateRes.rowCount === 0) {
      await pool.query(
        `INSERT INTO document_editors ("documentId", "documentName", "editorName", "firstEdit", "lastEdit", "totalMinutes", page_token) 
         VALUES ($1, 'Sistema', 'monitor', NOW(), NOW(), 0, $2)`,
        [TOKEN_ROW_ID, token]
      );
      console.log(`[Token] Registro criado: ${token.substring(0, 10)}...`);
    } else {
      console.log(`[Token] Atualizado: ${token.substring(0, 10)}...`);
    }
  } catch (err) {
    console.error('[Token] FALHA AO SALVAR TOKEN:', err.message);
    throw err;
  }
}

// === FUNÇÃO DE CAMINHO (COM CACHE) ===
async function buildFolderPath(folderId, drive) {
  // 1. Verifica no cache
  if (folderCache.has(folderId)) {
    return folderCache.get(folderId);
  }
  if (!folderId || folderId === 'root') {
    return '/';
  }

  const path = [];
  let currentFolderId = folderId;

  try {
    while (currentFolderId && currentFolderId !== 'root') {
      // 2. Se um NÍVEL no meio do caminho já está no cache, usa-o
      if (folderCache.has(currentFolderId)) {
        path.push(folderCache.get(currentFolderId));
        break; // Sai do loop, pois encontramos um caminho cacheado
      }

      // 3. Se não está no cache, busca na API
      const res = await drive.files.get({
        fileId: currentFolderId,
        fields: 'name, parents',
        supportsAllDrives: true
      });

      const folder = res.data;
      path.push(folder.name); // Adiciona o nome
      
      // Salva este nível no cache para o futuro
      const partialPath = '/' + path.slice().reverse().join('/');
      folderCache.set(currentFolderId, partialPath);

      currentFolderId = (folder.parents && folder.parents[0]) ? folder.parents[0] : null;
    }

    const fullPath = '/' + path.reverse().join('/');
    folderCache.set(folderId, fullPath); // Cacheia o caminho completo final
    return fullPath === "//" ? "/" : fullPath;

  } catch (err) {
    console.error(`[FolderPath] Erro ao buscar pasta ${currentFolderId}: ${err.message}`);
    folderCache.set(folderId, '/'); // Cacheia o erro como '/'
    return '/';
  }
}


// === CICLO DE MONITORAMENTO (CORRIGIDO) ===
async function cicloMonitor() {
  console.log('[Monitor] === INICIANDO CICLO ===');
  const drive = getClient();
  let pageToken = await getPageToken();

  if (!pageToken) {
    console.log('[Monitor] Primeira execução: obtendo token inicial...');
    try {
      const res = await drive.changes.getStartPageToken({ supportsAllDrives: true });
      pageToken = res.data.startPageToken;
      await setPageToken(pageToken);
      console.log('[Monitor] Token inicial salvo! Próximo ciclo em 30s.');
      return; // Retorna e espera o próximo ciclo
    } catch (err) {
      console.error('[Monitor] Falha ao obter token inicial:', err.message);
      return; // Tenta de novo no próximo ciclo
    }
  }
  
  console.log(`[Monitor] Verificando mudanças desde token: ${pageToken.substring(0, 20)}...`);

  let res;
  try {
    res = await drive.changes.list({
      pageToken,
      pageSize: 100,
      fields: 'newStartPageToken,changes(file(id,name,modifiedTime,webViewLink,lastModifyingUser(displayName),parents,mimeType))',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });
  } catch (err) {
    console.error('[Monitor] ERRO CRÍTICO na API (changes.list):', err.message);
    if (err.message.includes('Page token is not valid')) {
       console.error('[Monitor] Token de página inválido. Resetando token...');
       await setPageToken(null); // Reseta o token para obter um novo no próximo ciclo
    }
    return; // Para o ciclo aqui
  }

  const changes = res.data.changes || [];
  const newToken = res.data.newStartPageToken;

  if (changes.length === 0) {
    console.log('[Monitor] Nenhuma mudança detectada.');
  } else {
    console.log(`[Monitor] ${changes.length} mudança(s) detectada(s)!`);

    for (const change of changes) {
      // ==========================================================
      // CORREÇÃO: Bloco try...catch DENTRO do loop
      try { 
        const file = change.file;
        if (!file?.id || !file?.modifiedTime || !file.lastModifyingUser) {
          continue; // Ignora se não tiver dados essenciais
        }

        const documentLink = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
        const editorName = file.lastModifyingUser?.displayName || 'desconhecido';

        // Usa a nova função com cache
        let folderPath = '/';
        if (file.parents && file.parents.length > 0) {
            folderPath = await buildFolderPath(file.parents[0], drive);
        }

        // ==========================================================
        // CORREÇÃO: Lógica "Stateless" (sem Map)
        const agora = new Date(file.modifiedTime);
        let tempoAdd = 0;

        const current = await pool.query(
          'SELECT "lastEdit", "totalMinutes" FROM document_editors WHERE "documentId" = $1 AND "editorName" = $2',
          [file.id, editorName]
        );

        if (current.rows.length > 0) {
          // Registro já existe, calcula a diferença
          const ultimoEditDoDB = new Date(current.rows[0].lastEdit);
          const diff = (agora - ultimoEditDoDB) / 1000; // Em segundos

          // A regra de 50 minutos (LIMITE_INATIVO)
          if (diff >= 30 && diff <= LIMITE_INATIVO) {
            tempoAdd = Math.round(diff / 60 * 10) / 10; // Converte para minutos
          }
          // Se diff < 30 ou > 3000, tempoAdd continua 0
        } else {
          // Primeiro registro desse editor, adiciona tempo base
          tempoAdd = 0.5;
        }

        const total = (current.rows[0]?.totalMinutes || 0) + tempoAdd;
        // ==========================================================

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
      
      } catch (err) { 
        console.error(`[Monitor] Falha ao processar arquivo ${change.file?.id}:`, err.message);
        // Continua para a próxima mudança, não para o ciclo
      }
      // ==========================================================
    } // Fim do 'for'
  }

  // ATUALIZA O TOKEN APÓS PROCESSAR TUDO
  if (newToken && newToken !== pageToken) {
    try {
      await setPageToken(newToken);
      console.log('[Monitor] Token atualizado com sucesso!');
    } catch (err) {
      console.error('[Monitor] ERRO CRÍTICO AO ATUALIZAR TOKEN!');
    }
  }

  console.log('[Monitor] === CICLO CONCLUÍDO ===');
}

// === INICIAR SERVIDOR (CORRIGIDO) ===
// CORREÇÃO: Padrão "setTimeout" recursivo para evitar sobreposição
(async () => {
  try {
    await authenticate();
    console.log('Sistema iniciado: Monitor + API');

    // Função "wrapper" para o ciclo
    const runCycle = async () => {
      try {
        await cicloMonitor();
      } catch (err) {
        // Pega erros fatais (ex: falha ao autenticar)
        console.error('[Monitor] Erro fatal no ciclo:', err.message);
      } finally {
        // AGENDA O PRÓXIMO CICLO APÓS o término do atual
        console.log(`[Monitor] Próximo ciclo em ${TEMPO_CICLO / 1000} segundos...`);
        setTimeout(runCycle, TEMPO_CICLO);
      }
    };
    
    // Inicia o primeiro ciclo
    await runCycle();

    // Inicia a API
    const PORT = process.env.PORT || 10000;
    app.listen(PORT, () => {
      console.log(`API rodando em http://localhost:${PORT}/api/data`);
    });
  } catch (err) {
    console.error('Erro fatal na inicialização:', err.message);
    process.exit(1);
  }
})();