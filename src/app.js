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
const TOKEN_KEY = 'PAGE_TOKEN';
const TEMPO_CICLO = 30 * 1000;
const LIMITE_INATIVO = 3000;

// === FUNÇÕES DO TOKEN (Sem alterações) ===
async function getPageToken() {
  try {
    const res = await pool.query(
      'SELECT config_value FROM system_config WHERE config_key = $1',
      [TOKEN_KEY]
    );
    return res.rows[0]?.config_value || null;
  } catch (err) {
    console.error('[Token] Erro ao ler:', err.message);
    return null;
  }
}

async function setPageToken(token) {
  try {
    await pool.query(`
      INSERT INTO system_config (config_key, config_value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (config_key) DO UPDATE SET
        config_value = EXCLUDED.config_value,
        updated_at = NOW()
    `, [TOKEN_KEY, token]);
  } catch (err) {
    console.error('[Token] Erro ao salvar:', err.message);
    throw err; 
  }
}

// === FUNÇÃO DE CAMINHO (Sem alterações) ===
const folderCache = new Map();
async function buildFolderPath(folderId, drive) {
  if (folderCache.has(folderId)) return folderCache.get(folderId);
  if (!folderId || folderId === 'root') return '/';
  
  try {
    const res = await drive.files.get({ 
      fileId: folderId, 
      fields: 'name, parents',
      supportsAllDrives: true
    });
    const name = res.data.name;
    const parentId = res.data.parents ? res.data.parents[0] : null;
    const parentPath = await buildFolderPath(parentId, drive);
    const fullPath = (parentPath === '/' ? '' : parentPath) + '/' + name;
    folderCache.set(folderId, fullPath);
    return fullPath;
  } catch (err) {
    console.warn(`[Path] Pasta ${folderId} não encontrada: ${err.message}`);
    folderCache.set(folderId, '/');
    return '/';
  }
}

// ==========================================================
// CICLO DE MONITORAMENTO (CORRIGIDO COM PAGINAÇÃO)
// ==========================================================
async function cicloMonitor() {
  console.log('[Monitor] === INICIANDO CICLO ===');
  const drive = getClient();
  
  // 1. Obtém o token salvo no DB (ex: 51063)
  let dbPageToken = await getPageToken();
  
  if (!dbPageToken) {
    // Lógica de primeira execução (continua igual)
    console.log('[Monitor] Primeira execução: obtendo token inicial...');
    try {
      const res = await drive.changes.getStartPageToken({ supportsAllDrives: true });
      dbPageToken = res.data.startPageToken;
      await setPageToken(dbPageToken);
      console.log('[Monitor] Token inicial salvo! Próximo ciclo em 30s.');
      return;
    } catch (err) {
      console.error('[Monitor] Falha ao obter token inicial:', err.message);
      return;
    }
  }

  console.log(`[Monitor] Verificando mudanças desde token: ${dbPageToken.substring(0, 10)}...`);

  let newStartPageToken = null; // Armazena o token final para salvar no DB
  let nextToken = dbPageToken; // O token a ser usado na próxima chamada de API *dentro* do loop
  let totalChanges = 0;

  // 2. Inicia um loop DO...WHILE para lidar com a paginação da API
  do {
    let res;
    try {
      res = await drive.changes.list({
        pageToken: nextToken,
        // Adiciona 'nextPageToken' aos campos pedidos
        fields: 'newStartPageToken, nextPageToken, changes(file(id, name, modifiedTime, lastModifyingUser(displayName), webViewLink, parents))',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });
    } catch (err) {
      console.error('[Monitor] ERRO CRÍTICO na API (changes.list):', err.message);
      if (err.message.includes('Page token is not valid')) {
         console.error('[Monitor] Token de página inválido. Resetando token...');
         await setPageToken(null); // Reseta o token para um novo
      }
      return; // Para o ciclo
    }

    const changes = res.data.changes || [];
    
    if (changes.length > 0) {
      totalChanges += changes.length;
      console.log(`[Monitor] ... processando ${changes.length} mudança(s) ...`);
      
      // 3. Processa o lote atual de mudanças
      for (const change of changes) {
        try {
          const file = change.file;
          if (!file?.id || !file?.modifiedTime || !file.lastModifyingUser) continue; 

          const editorName = file.lastModifyingUser?.displayName || 'desconhecido';
          const agora = new Date(file.modifiedTime);
          let tempoAdd = 0;

          // Lógica de cálculo de tempo (continua igual)
          const current = await pool.query(
            `SELECT "event_time" FROM time_logs 
             WHERE "document_id" = $1 AND "editor_name" = $2 
             ORDER BY "event_time" DESC LIMIT 1`,
            [file.id, editorName]
          );

          if (current.rows.length > 0) {
            const ultimoEditDoDB = new Date(current.rows[0].event_time);
            const diff = (agora - ultimoEditDoDB) / 1000; 

            if (agora < ultimoEditDoDB) {
              continue; // Ignora evento antigo
            }
            if (diff >= 30 && diff <= LIMITE_INATIVO) {
              tempoAdd = Math.round(diff / 60 * 10) / 10;
            }
          } else {
            tempoAdd = 0.5; // Primeira edição
          }

          if (tempoAdd > 0) {
            const documentLink = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
            let folderPath = '/';
            if (file.parents && file.parents.length > 0) {
              folderPath = await buildFolderPath(file.parents[0], drive);
            }
            
            await pool.query(`
              INSERT INTO time_logs 
                (document_id, document_name, document_link, folder_path, editor_name, minutes_added, event_time)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              file.id, file.name || 'Sem nome', documentLink, folderPath, editorName, tempoAdd, agora.toISOString()
            ]);
            console.log(`[Neon] +${tempoAdd} min → ${file.name} (${editorName})`);
          }
        } catch (err) {
          console.error(`[Monitor] Falha ao processar arquivo ${change.file?.id}:`, err.message);
        }
      } // Fim do 'for'
    }

    // 4. Prepara a próxima iteração do loop
    newStartPageToken = res.data.newStartPageToken;
    nextToken = res.data.nextPageToken; // Se isto for 'null', o loop 'while' pára

  } while (nextToken); // Continua o loop se a API disse que há mais páginas

  // 5. Fim do loop. Agora podemos salvar o token final.
  if (totalChanges === 0) {
    console.log('[Monitor] Nenhuma mudança detectada.');
  } else {
    console.log(`[Monitor] Total de ${totalChanges} mudança(s) processada(s).`);
  }

  // 6. Salva o token final no DB (só se for diferente do token inicial)
  if (newStartPageToken && newStartPageToken !== dbPageToken) {
    try {
      await setPageToken(newStartPageToken);
      console.log(`[Monitor] Token atualizado: ${newStartPageToken.substring(0, 10)}...`);
    } catch (err) {
      console.error('[Monitor] ERRO CRÍTICO AO ATUALIZAR TOKEN!', err.message);
    }
  }

  console.log('[Monitor] === CICLO CONCLUÍDO ===');
}

(async () => {
  try {
    await authenticate();
    console.log('Sistema iniciado: Monitor + API');

    const runCycle = async () => {
      try {
        await cicloMonitor();
      } catch (err) {
        console.error('[Monitor] Erro fatal no ciclo:', err.message);
      } finally {
        setTimeout(runCycle, TEMPO_CICLO);
      }
    };
    
    await runCycle();

    const PORT = process.env.PORT || 10000;
    app.listen(PORT, () => {
      console.log(`API rodando em http://localhost:${PORT}/api/data`);
    });
  } catch (err) {
    console.error('Erro fatal na inicialização:', err.message);
    process.exit(1);
  }
})();