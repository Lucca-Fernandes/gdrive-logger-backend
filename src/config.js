const path = require('path');

// O caminho para o arquivo de chave JSON
const KEY_FILE_PATH = path.join(__dirname, '..', 'service-account-key.json');

// --- CONFIGURAÇÃO DO SHEETS ---
// Cole o ID da sua Planilha Google
const SPREADSHEET_ID = '1TIii-MEezht9K1XSagO9rIRSlA_AMuvjuCICDeB_L5Y'; // Seu ID
// Coloque o nome da aba que você criou
const SHEET_NAME = 'Log'; 
// ------------------------------

// ATUALIZAÇÃO: Adicionamos o escopo do Google Sheets
const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/spreadsheets' // Permissão para ler/escrever planilhas
];

// Não precisamos mais da lista de pastas
// O script monitora TUDO que o robô pode ver.

module.exports = {
  KEY_FILE_PATH,
  SCOPES,
  SPREADSHEET_ID,
  SHEET_NAME,
};