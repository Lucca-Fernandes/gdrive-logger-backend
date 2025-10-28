const { google } = require('googleapis');
const { KEY_FILE_PATH, SCOPES } = require('./config.js'); 

/**
 * Formata data ISO para padrão brasileiro: DD/MM/AAAA HH:mm
 * @param {string} isoString 
 * @returns {string}
 */
function formatarDataHoraBR(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date)) return '';
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const ano = date.getFullYear();
  const hora = String(date.getHours()).padStart(2, '0');
  const minuto = String(date.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
}

class DriveService {
  constructor() {
    const auth = new google.auth.GoogleAuth({
      keyFile: KEY_FILE_PATH,
      scopes: SCOPES,
    });
    this.drive = google.drive({ version: 'v3', auth });
    this.folderNameCache = new Map();
    console.log("Drive Service (JS) inicializado e autenticado.");
  }

  async getStartToken() {
    try {
      const response = await this.drive.changes.getStartPageToken({
        supportsAllDrives: true,
      });
      return response.data.startPageToken;
    } catch (error) {
      console.error("Erro ao pegar o token inicial:", error.message);
      throw error;
    }
  }

  async listChanges(savedToken) {
    let allChanges = [];
    let newStartPageToken = savedToken;
    let pageToken = savedToken;
    try {
      do {
        const response = await this.drive.changes.list({
          pageToken: pageToken,
          fields: 'newStartPageToken, nextPageToken, changes(fileId, removed)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });
        if (response.data.changes) {
            allChanges = allChanges.concat(response.data.changes);
        }
        newStartPageToken = response.data.newStartPageToken;
        pageToken = response.data.nextPageToken;
      } while (pageToken);
      return { changes: allChanges, newStartPageToken: newStartPageToken };
    } catch (error) {
      console.error("Erro ao listar mudanças:", error.message);
      throw error;
    }
  }

  async processFileChanges(changes) {
    const finalFileData = [];
    const processedFileIds = new Set();

    for (const change of changes) {
      if (change.removed || !change.fileId || processedFileIds.has(change.fileId)) { 
        continue;
      }
      
      try {
        const file = await this.getFileDetails(change.fileId);
        if (!file) continue; 

        const MimetypesRastreados = [
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.google-apps.document'
        ];
        
        const isFileMonitorado = MimetypesRastreados.includes(file.mimeType);
        const notTrashed = !file.trashed;

        if (isFileMonitorado && notTrashed) { 
          let parentFolderNames = [];
          if (file.parents && file.parents.length > 0) {
            parentFolderNames = await Promise.all(
              file.parents.map(parentId => this.getFolderName(parentId))
            );
          }

          // --- DADOS FORMATADOS COM DATA BR ---
          const fileData = {
            documento_id: file.id,
            documento_nome: file.name,
            documento_link: file.webViewLink,
            data_criacao: formatarDataHoraBR(file.createdTime),
            data_ultima_modificacao: formatarDataHoraBR(file.modifiedTime),
            ultimo_editor_nome: file.lastModifyingUser?.displayName || 'N/A',
            ultimo_editor_email: file.lastModifyingUser?.emailAddress || 'N/A',
            pastas_pai_nomes: parentFolderNames.join(', '),
          };

          // LOG DE DEBUG (opcional - remova depois se quiser)
          console.log('[DEBUG] Arquivo processado →', {
            id: file.id,
            nome: file.name,
            editor: fileData.ultimo_editor_nome,
            modificado: fileData.data_ultima_modificacao,
            criado: fileData.data_criacao
          });

          finalFileData.push(fileData);
          processedFileIds.add(file.id);
        
        } else {
          if (file.name) { 
            console.log(`[Debug] Mudança ignorada: ${file.name} (Tipo Válido: ${isFileMonitorado}, Não Lixeira: ${notTrashed}, Tipo: ${file.mimeType})`);
          }
        }
      } catch (error) {
        if (!error.message.includes("not found")) {
          console.error(`Erro ao processar File ID ${change.fileId}: ${error.message}`);
        }
      }
    }
    return finalFileData;
  }
  
  async getFolderName(folderId) {
    if (this.folderNameCache.has(folderId)) {
      return this.folderNameCache.get(folderId);
    }
    try {
      const response = await this.drive.files.get({
        fileId: folderId,
        fields: 'name',
        supportsAllDrives: true,
      });
      const folderName = response.data.name;
      this.folderNameCache.set(folderId, folderName);
      return folderName;
    } catch (error) {
      console.error(`[Cache] Erro ao buscar nome da pasta ${folderId}: ${error.message}`);
      return folderId;
    }
  }
  
  async getFileDetails(fileId) {
     try {
        const response = await this.drive.files.get({
            fileId: fileId,
            fields: 'id, name, mimeType, webViewLink, createdTime, modifiedTime, trashed, parents, lastModifyingUser(displayName, emailAddress)',
            supportsAllDrives: true,
        });
        return response.data;
     } catch (error) {
         if (error.code === 404 || error.code === 403) {
            console.log(`[Debug] Arquivo ${fileId} não encontrado ou sem permissão.`);
            return null; 
         }
        console.error(`Erro inesperado ao buscar detalhes do arquivo ${fileId}:`, error); 
        throw error;
     }
  }
}

module.exports = { DriveService };