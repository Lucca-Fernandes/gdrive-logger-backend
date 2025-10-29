// src/drive.js
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const path = require('path');

let driveClient = null;

async function authenticate() {
  try {
    const keyFile = path.join(process.cwd(), 'service-account.json');
    
    console.log('Usando keyFile:', keyFile);

    if (!require('fs').existsSync(keyFile)) {
      throw new Error(`ARQUIVO NÃO ENCONTRADO: ${keyFile}`);
    }

    // MÉTODO OFICIAL: JWT COM keyFile
    const auth = new JWT({
      keyFile, // ← ARQUIVO JSON INTEIRO
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });

    // Autoriza
    await auth.authorize();

    driveClient = google.drive({ version: 'v3', auth });
    
    console.log('Google Drive autenticado com sucesso (método oficial)!');
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