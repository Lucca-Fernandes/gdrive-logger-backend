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
    // TENTA UPDATE PRIMEIRO
    const updateRes = await pool.query(
      `UPDATE document_editors SET page_token = $1, "lastEdit" = NOW() WHERE "documentId" = $2`,
      [token, TOKEN_ROW_ID]
    );

    // SE NÃO ATUALIZOU NENHUM (não existia), INSERE
    if (updateRes.rowCount === 0) {
      await pool.query(
        `INSERT INTO document_editors ("documentId", "editorName", page_token, "lastEdit") VALUES ($1, $2, $3, NOW())`,
        [TOKEN_ROW_ID, 'SYSTEM', token]
      );
    }
  } catch (err) {
    console.error('[Token] Erro ao salvar:', err.message);
    throw err; // Propaga o erro para o ciclo principal
  }
}

// === FUNÇÃO DE CAMINHO (sem alterações) ===
async function buildFolderPath(folderId, drive, cache) {
  if (cache.has(folderId)) {
    return cache.get(folderId);
  }
  if (!folderId) return '/';

  try {
    const res = await drive.files.get({
      fileId: folderId,
      fields: 'name, parents',
    });
    const name = res.data.name;
    const parentId = res.data.parents ? res.data.parents[0] : null;

    if (parentId) {
      const parentPath = await buildFolderPath(parentId, drive, cache);
      const fullPath = (parentPath === '/' ? '' : parentPath) + '/' + name;
      cache.set(folderId, fullPath);
      return fullPath;
    } else {
      cache.set(folderId, '/'); // Raiz
      return '/';
    }
  } catch (err) {
    // Se a pasta não for encontrada (ex: órfã), trata como Raiz
    console.warn(`[Path] Pasta ${folderId} não encontrada ou sem acesso.`);
    cache.set(folderId, '/');
    return '/';
  }
}

// === CICLO DE MONITORAMENTO (ALTERADO) ===
async function cicloMonitor() {
  console.log('[Monitor] === INICIANDO CICLO ===');
  const drive = getClient();
  let pageToken = await getPageToken();
  const folderCache = new Map(); // Cache de pastas por ciclo

  console.log(`[Monitor] Verificando mudanças desde token: ${pageToken ? pageToken.substring(0, 10) + '...' : 'INÍCIO'}`);

  const res = await drive.changes.list({
    pageToken: pageToken,
    fields: 'newStartPageToken, changes(file(id, name, modifiedTime, lastModifyingUser(displayName), webViewLink, parents))',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  const changes = res.data.changes || [];
  const newToken = res.data.newStartPageToken;

  if (changes.length === 0) {
    console.log('[Monitor] Nenhuma mudança detectada.');
  } else {
    console.log(`[Monitor] ${changes.length} mudança(s) detectada(s)!`);

    for (const change of changes) {
      // -----------------------------------------------------------------
      // NOVO: Bloco try...catch movido para DENTRO do loop
      // Isso impede que um arquivo com erro trave o ciclo todo.
      try {
        const file = change.file;
        if (!file?.id || !file?.modifiedTime || !file.lastModifyingUser) {
          // Ignora mudanças sem dados suficientes (ex: exclusões)
          continue; 
        }

        const documentLink = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
        const editorName = file.lastModifyingUser?.displayName || 'desconhecido';

        let folderPath = '/';
        if (file.parents && file.parents.length > 0) {
          // O try/catch interno para o path já existia e está bom
          try {
            folderPath = await buildFolderPath(file.parents[0], drive, folderCache);
          } catch (err) {
            console.log(`[Path] Erro ao buscar pasta do arquivo ${file.id}:`, err.message);
          }
        }

        // -----------------------------------------------------------------
        // NOVO: Lógica de cálculo "Stateless" (sem Map)
        // Busca o estado atual direto do banco
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

          // Ignora edições muito rápidas (provável ruído) ou muito longas (provável "gap")
          if (diff >= 30 && diff <= 3600) { // Entre 30s e 1h
            tempoAdd = Math.round(diff / 60 * 10) / 10; // Converte para minutos
          }
        } else {
          // Primeiro registro desse editor nesse documento, adiciona tempo base
          tempoAdd = 0.5;
        }

        const total = (current.rows[0]?.totalMinutes || 0) + tempoAdd;
        // Fim da lógica "Stateless"
        // -----------------------------------------------------------------

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
        // Loga o erro do arquivo específico e continua o loop
        console.error(`[Monitor] Falha ao processar arquivo ${change.file?.id}:`, err.message);
        // O loop 'for' vai para a próxima 'change'
      }
      // Fim do bloco try...catch interno
      // -----------------------------------------------------------------

    } // Fim do 'for (const change of changes)'
  }

  // ATUALIZA O TOKEN APÓS PROCESSAR TUDO
  // Esta parte agora é alcançada mesmo que arquivos falhem
  if (newToken && newToken !== pageToken) {
    console.log(`[Monitor] Novo token recebido: ${newToken.substring(0, 10)}...`);
    try {
      await setPageToken(newToken);
      console.log('[Monitor] Token atualizado com sucesso!');
    } catch (err) {
      // Se falhar aqui, o próximo ciclo re-tentará com o token antigo,
      // mas o try/catch interno impedirá o "loop mortal"
      console.error('[Monitor] ERRO CRÍTICO AO ATUALIZAR TOKEN!', err.message);
    }
  }

  console.log('[Monitor] === CICLO CONCLUÍDO ===');
}

// === INICIAR SERVIDOR (ALTERADO) ===
// NOVO: Padrão "setTimeout" recursivo para evitar sobreposição
(async () => {
  try {
    await authenticate();
    console.log('Sistema iniciado: Monitor + API');

    // Função "wrapper" para o ciclo
    const runCycle = async () => {
      try {
        await cicloMonitor();
      } catch (err) {
        // Pega erros fatais (ex: falha ao autenticar, falha na API do Google)
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