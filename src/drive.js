// src/drive.js
const { google } = require('googleapis');

let driveClient = null;

async function authenticate() {
  const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const jwtClient = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/drive.readonly']
  );

  await jwtClient.authorize();
  driveClient = google.drive({ version: 'v3', auth: jwtClient });
  console.log('Google Drive autenticado.');
}

function getClient() {
  if (!driveClient) throw new Error('Drive não autenticado');
  return driveClient;
}

module.exports = { authenticate, getClient };