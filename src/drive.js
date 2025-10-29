// src/drive.js
const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

let driveClient = null;

async function authenticate() {
  try {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT não definido');

    const serviceAccount = JSON.parse(raw);

    // Corrige \n na chave
    const privateKey = (serviceAccount.private_key || '')
      .replace(/\\n/g, '\n')
      .trim();

    const auth = new JWT({
      email: serviceAccount.client_email,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive.readonly']
    });

    await auth.authorize();
    driveClient = google.drive({ version: 'v3', auth });
    console.log('Google Drive autenticado com sucesso (via ENV)!');
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