const { google } = require('googleapis');
const { KEY_FILE_PATH, SCOPES, SPREADSHEET_ID, SHEET_NAME } = require('./config.js'); 

const HEADERS = [
  'documento_id',
  'documento_nome',
  'ultimo_editor_nome',
  'data_ultima_modificacao',
  'data_primeira_edicao',
  'documento_link',
  'pastas_pai_nomes',
  'tempo_total_editado_min'  
];

class SheetsService {
  constructor() {
    const auth = new google.auth.GoogleAuth({
      keyFile: KEY_FILE_PATH,
      scopes: SCOPES,
    });
    this.sheets = google.sheets({ version: 'v4', auth });
    console.log("Sheets Service inicializado e autenticado.");
  }

  
  async initHeaders() {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:Z1`,
      });
      
      if (!response.data.values || 
          response.data.values.length === 0 || 
          response.data.values[0][0] !== HEADERS[0] || 
          response.data.values[0][7] !== HEADERS[7]) {
        console.log("Cabeçalhos desatualizados. Atualizando...");
        await this.sheets.spreadsheets.values.clear({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!1:1`,
        }).catch(() => {});
        
        await this.sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${SHEET_NAME}!A1`,
          valueInputOption: 'RAW',
          resource: { values: [HEADERS] },
        });
      }
    } catch (error) {
      console.error("Erro ao inicializar cabeçalhos:", error.message);
      throw error;
    }
  }

  
  async loadSheetData() {
    console.log("Carregando estado atual da planilha...");
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:C`,
        valueRenderOption: 'FORMATTED_VALUE',
      });
      
      const map = new Map();
      if (response.data.values) {
        response.data.values.forEach((row, index) => {
          if (index === 0) return;
          const fileId = row[0];
          const editorName = row[2] || 'N/A';
          if (fileId) {
            const key = `${fileId}-${editorName}`;
            map.set(key, index + 1);
          }
        });
      }
      console.log(`Planilha carregada. ${map.size} chaves monitoradas.`);
      return map;
    } catch (error) {
      if (error.code === 400 && error.message.includes("Unable to parse range")) {
        console.warn("Aba vazia. Mapa iniciará vazio.");
        return new Map();
      }
      console.error("Erro ao carregar planilha:", error.message);
      throw error;
    }
  }

  
  async getRowData(rowIndex) {
    try {
      const range = `${SHEET_NAME}!A${rowIndex}:H${rowIndex}`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: range,
      });

      if (!response.data.values || response.data.values.length === 0) return {};
      const row = response.data.values[0];

      return {
        documento_id: row[0],
        documento_nome: row[1],
        ultimo_editor_nome: row[2],
        data_ultima_modificacao: row[3],
        data_primeira_edicao: row[4],
        documento_link: row[5],
        pastas_pai_nomes: row[6],
        tempo_total_editado_min: row[7],
      };
    } catch (error) {
      console.error(`Erro ao ler linha ${rowIndex}:`, error.message);
      return {};
    }
  }

  
  _formatDataForSheet(fileData) {
    return HEADERS.map(header => fileData[header]);
  }

  
  async updateRow(rowIndex, fileData) {
    try {
      const range = `${SHEET_NAME}!A${rowIndex}`;
      const values = [this._formatDataForSheet(fileData)];
      
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: range,
        valueInputOption: 'USER_ENTERED',
        resource: { values },
      });
    } catch (error) {
      console.error(`Erro ao atualizar linha ${rowIndex}:`, error.message);
    }
  }

  
  async appendRow(fileData) {
    try {
      const values = [this._formatDataForSheet(fileData)];
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A:A`,        
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values },
      });
      
      const updatedRange = response.data.updates?.updatedRange;
      const match = updatedRange?.match(/!A(\d+):/);
      const newRowIndex = match ? parseInt(match[1]) : -1;
      
      if (newRowIndex > 0) {
        console.log(`[Planilha] Linha ${newRowIndex} ADICIONADA`);
      }
      return newRowIndex;
    } catch (error) {
      console.error(`Erro ao adicionar linha:`, error.message);
      return -1;
    }
  }
}

module.exports = { SheetsService };