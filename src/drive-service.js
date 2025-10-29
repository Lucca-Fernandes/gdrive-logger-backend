// src/drive-service.js
const { google } = require('googleapis');
require('dotenv').config();

class DriveService {
  constructor() {
    this.drive = null;
    this.pageToken = null;
  }

  async authenticate() {
    try {
      // Lê o JSON completo da variável de ambiente
      const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

      const jwtClient = new google.auth.JWT(
        serviceAccount.client_email,
        null, // sem keyFile
        serviceAccount.private_key.replace(/\\n/g, '\n'), // conserta \n
        ['https://www.googleapis.com/auth/drive.readonly']
      );

      await jwtClient.authorize();
      this.drive = google.drive({ version: 'v3', auth: jwtClient });
      console.log('Drive Service (JS) inicializado e autenticado.');
    } catch (err) {
      console.error('Erro na autenticação do Drive:', err.message);
      throw err;
    }
  }

  async getStartToken() {
    const res = await this.drive.changes.getStartPageToken();
    return res.data.startPageToken;
  }

  async listChanges(pageToken) {
    const res = await this.drive.changes.list({
      pageToken,
      fields: 'changes(file/id, file/name, file/modifiedTime, file/parents, file/webViewLink), newStartPageToken',
      pageSize: 100,
      includeRemoved: false,
    });
    return {
      changes: res.data.changes || [],
      newStartPageToken: res.data.newStartPageToken,
    };
  }

  async getFileParents(fileId) {
    try {
      const res = await this.drive.files.get({
        fileId,
        fields: 'parents',
      });
      return res.data.parents || [];
    } catch {
      return [];
    }
  }

  async getFolderPath(parentId, path = []) {
    if (!parentId) return path;
    try {
      const res = await this.drive.files.get({
        fileId: parentId,
        fields: 'name, parents',
      });
      path.unshift(res.data.name);
      if (res.data.parents && res.data.parents[0]) {
        return this.getFolderPath(res.data.parents[0], path);
      }
    } catch (err) {
      console.error('Erro ao buscar pasta:', err.message);
    }
    return path;
  }

  async processFileChanges(changes) {
    const files = [];
    for (const change of changes) {
      const file = change.file;
      if (!file || !file.id || !file.modifiedTime) continue;

      const parents = await this.getFileParents(file.id);
      const folderPath = parents.length > 0 ? await this.getFolderPath(parents[0]) : [];
      const folderPathStr = folderPath.join(' > ');

      const [date, time] = file.modifiedTime.split('T');
      const [year, month, day] = date.split('-');
      const [hour, minute] = time.split(':');
      const modificadoBR = `${day}/${month}/${year} ${hour}:${minute}`;

      files.push({
        documento_id: file.id,
        documento_nome: file.name || 'Sem nome',
        documento_link: file.webViewLink || '',
        pastas_pai_nomes: folderPathStr,
        data_ultima_modificacao: modificadoBR,
        ultimo_editor_nome: 'Desconhecido',
      });
    }
    return files;
  }
}

module.exports = { DriveService };