// src/drive.js
const { google } = require('googleapis');

let driveClient = null;

async function authenticate() {
  try {
    console.log('Iniciando autenticação via Secret Files...');

    // O Render monta Secret Files em /etc/secrets/
    const keyFile = '/etc/secrets/service-account.json';

    const auth = new google.auth.GoogleAuth({
      keyFilename: keyFile,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });

    const client = await auth.getClient();
    driveClient = google.drive({ version: 'v3', auth: client });

    console.log('Google Drive autenticado com sucesso (Secret Files)!');
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