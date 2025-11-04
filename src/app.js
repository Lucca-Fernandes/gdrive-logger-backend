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
const TOKEN_KEY = 'PAGE_TOKEN'; // Chave na nova tabela system_config
const TEMPO_CICLO = 30 * 1000; // 30 segundos
const LIMITE_INATIVO = 3000; // 50 minutos (50 * 60)

// === FUNÇÕES DO TOKEN (NOVAS) ===
// Lendo da tabela 'system_config'
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

// Salvando na tabela 'system_config'
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

// === FUNÇÃO DE CAMINHO (COM CACHE) ===
const folderCache = new Map();
async function buildFolderPath(folderId, drive) {
  if (folderCache.has(folderId)) return folderCache.get(folderId);
  if (!folderId || folderId === 'root') return '/';
  
  try {
    // Implementação recursiva simples para o caminho
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
    folderCache.set(folderId, '/'); // Cacheia o erro como '/'
    return '/';
  }
}

// === CICLO DE MONITORAMENTO (LÓGICA REAL) ===
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
      return;
    } catch (err) {
      console.error('[Monitor] Falha ao obter token inicial:', err.message);
      return;
    }
  }

  console.log(`[Monitor] Verificando mudanças desde token: ${pageToken.substring(0, 10)}...`);

  let res;
  try {
     res = await drive.changes.list({
      pageToken: pageToken,
      fields: 'newStartPageToken, changes(file(id, name, modifiedTime, lastModifyingUser(displayName), webViewLink, parents))',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });
  } catch (err) {
     console.error('[Monitor] ERRO CRÍTICO na API (changes.list):', err.message);
     if (err.message.includes('Page token is not valid')) {
       console.error('[Monitor] Token de página inválido. Resetando token...');
       // Se o token expirar, ele será resetado e começará de novo
       await setPageToken(null); 
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
      try { // try...catch DENTRO do loop
        const file = change.file;
        if (!file?.id || !file?.modifiedTime || !file.lastModifyingUser) {
          continue; 
        }

        const editorName = file.lastModifyingUser?.displayName || 'desconhecido';
        const agora = new Date(file.modifiedTime);
        let tempoAdd = 0;

        // LÓGICA STATELESS: Busca o último REGISTRO daquele editor
        const current = await pool.query(
          `SELECT "event_time" FROM time_logs 
           WHERE "document_id" = $1 AND "editor_name" = $2 
           ORDER BY "event_time" DESC LIMIT 1`,
          [file.id, editorName]
        );

        if (current.rows.length > 0) {
          // Se já existe, calcula a diferença
          const ultimoEditDoDB = new Date(current.rows[0].event_time);
          const diff = (agora - ultimoEditDoDB) / 1000; // Em segundos

          // Se a data da mudança for mais antiga que a última gravada, ignora
          if (agora < ultimoEditDoDB) {
              console.log(`[Monitor] Ignorando evento antigo: ${file.name}`);
              continue;
          }

          if (diff >= 30 && diff <= LIMITE_INATIVO) {
            tempoAdd = Math.round(diff / 60 * 10) / 10;
          }
          // Se diff < 30 ou > LIMITE, tempoAdd é 0 e nada é gravado
        } else {
          // Primeiro registro desse editor, adiciona tempo base
          // (Este é o dado que foi migrado)
          tempoAdd = 0.5;
        }

        // SÓ GRAVA SE HOUVER TEMPO A ADICIONAR
        if (tempoAdd > 0) {
          const documentLink = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
          let folderPath = '/';
          if (file.parents && file.parents.length > 0) {
            folderPath = await buildFolderPath(file.parents[0], drive);
          }
          
          // LÓGICA REAL: Insere um novo evento de tempo
          await pool.query(`
            INSERT INTO time_logs 
              (document_id, document_name, document_link, folder_path, editor_name, minutes_added, event_time)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            file.id,
            file.name || 'Sem nome',
            documentLink,
            folderPath,
            editorName,
            tempoAdd,
            agora.toISOString()
          ]);

          console.log(`[Neon] +${tempoAdd} min → ${file.name} (${editorName}) [${folderPath}]`);
        }

      } catch (err) {
        console.error(`[Monitor] Falha ao processar arquivo ${change.file?.id}:`, err.message);
      }
    } // Fim do 'for'
  }

  // ATUALIZA O TOKEN APÓS PROCESSAR TUDO
  if (newToken && newToken !== pageToken) {
    try {
      await setPageToken(newToken);
      console.log(`[Monitor] Token atualizado: ${newToken.substring(0, 10)}...`);
    } catch (err) {
      console.error('[Monitor] ERRO CRÍTICO AO ATUALIZAR TOKEN!', err.message);
    }
  }

  console.log('[Monitor] === CICLO CONCLUÍDO ===');
}

// === INICIAR SERVIDOR (Robusto com setTimeout) ===
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
        // Agenda o próximo ciclo APÓS 30s
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