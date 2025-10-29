// src/drive.js
const { google } = require('googleapis');
const path = require('path');

let driveClient = null;

async function authenticate() {
  try {
    const keyFile = path.join(process.cwd(), 'service-account.json');
    
    if (!require('fs').existsSync(keyFile)) {
      throw new Error(`ARQUIVO NÃO ENCONTRADO: ${keyFile}`);
    }

    const auth = new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });

    const client = await auth.getClient();
    driveClient = google.drive({ version: 'v3', auth: client });
    
    console.log('Google Drive autenticado com sucesso (via keyFile)!');
  } catch (err) {
    console.error('Erro na autenticação:', err.message);
    throw err;
  }
}

function getClient() {
  if (!driveClient) throw new Error('Drive não autenticado');
  return driveClient;
}

module.exports = { authenticate, getClient };