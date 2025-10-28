// src/index.js
const { DriveService } = require('./drive-service.js');
const PostgresService = require('./postgres-service.js');
require('dotenv').config();

const INTERVALO_EM_SEGUNDOS = parseInt(process.env.MONITOR_INTERVAL) || 30;
const MIN_EDICAO_SEGUNDOS = 30;
const MAX_INTERVALO_MINUTOS = 50;

const driveService = new DriveService();
const postgresService = new PostgresService();

let savedPageToken;
const ultimoTimestampMap = new Map();

// --- FUNÇÃO SEGURA PARA CONVERTER DATA ---
function parseDateTime(dateInput) {
  if (!dateInput) return new Date();
  
  // Se já for Date
  if (dateInput instanceof Date) return dateInput;
  
  // Se for string no formato DD/MM/AAAA HH:MM
  if (typeof dateInput === 'string') {
    const [date, time] = dateInput.split(' ');
    if (!date || !time) return new Date();
    const [day, month, year] = date.split('/');
    if (!day || !month || !year) return new Date();
    return new Date(`${year}-${month}-${day}T${time}:00Z`);
  }
  
  return new Date(); // fallback
}

async function initializeMonitor() {
  console.log('Iniciando monitor → Neon...');
  savedPageToken = await driveService.getStartToken();
  setInterval(runMonitorCycle, INTERVALO_EM_SEGUNDOS * 1000);
  runMonitorCycle();
}

async function runMonitorCycle() {
  if (!savedPageToken) return;

  try {
    const { changes, newStartPageToken } = await driveService.listChanges(savedPageToken);
    savedPageToken = newStartPageToken;

    if (changes.length === 0) return;

    const modifiedFilesData = await driveService.processFileChanges(changes);
    if (modifiedFilesData.length === 0) return;

    // --- REMOVER DUPLICATAS ---
    const uniqueFiles = [];
    const seen = new Set();
    for (const file of modifiedFilesData) {
      const key = `${file.documento_id}-${file.ultimo_editor_nome}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueFiles.push(file);
      }
    }

    for (const fileData of uniqueFiles) {
      const editorName = fileData.ultimo_editor_nome || 'Desconhecido';
      const key = `${fileData.documento_id}-${editorName}`;

      const agora = parseDateTime(fileData.data_ultima_modificacao);

      let tempoAdicionadoMin = 0;
      if (ultimoTimestampMap.has(key)) {
        const diffSegundos = (agora - ultimoTimestampMap.get(key)) / 1000;
        const diffMinutos = diffSegundos / 60;
        if (diffSegundos >= MIN_EDICAO_SEGUNDOS && diffMinutos <= MAX_INTERVALO_MINUTOS) {
          tempoAdicionadoMin = Math.round(diffMinutos * 10) / 10;
        }
      }

      const current = await postgresService.getCurrentTime(fileData.documento_id, editorName);
      const totalMinutes = current.totalMinutes + tempoAdicionadoMin;
      
      // --- firstEdit: string ISO ou null ---
      let firstEditISO = current.firstEdit;
      if (!firstEditISO) {
        firstEditISO = agora.toISOString();
      }

      await postgresService.upsert({
        documento_id: fileData.documento_id,
        documento_nome: fileData.documento_nome,
        documento_link: fileData.documento_link,
        pastas_pai_nomes: fileData.pastas_pai_nomes,
        ultimo_editor_nome: editorName,
        data_primeira_edicao: firstEditISO,
        data_ultima_modificacao: agora.toISOString(),
        tempo_total_editado_min: totalMinutes.toFixed(1)
      });

      if (tempoAdicionadoMin > 0) {
        console.log(`[Neon] +${tempoAdicionadoMin} min → ${editorName} em "${fileData.documento_nome}"`);
      }

      ultimoTimestampMap.set(key, agora);
    }
  } catch (err) {
    console.error('Erro no ciclo:', err.message);
  }
}

initializeMonitor();