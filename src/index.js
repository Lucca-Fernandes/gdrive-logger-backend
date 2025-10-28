const { DriveService } = require('./drive-service.js');
const { SheetsService } = require('./sheets-service.js');

// --- CONFIGURAÇÃO DO MONITOR ---
const INTERVALO_EM_SEGUNDOS = 30;
// --------------------------------

const driveService = new DriveService();
const sheetsService = new SheetsService();

let savedPageToken;
let compositeKeyToRowIndexMap = new Map();

// Armazena último timestamp por (docId + editor) para calcular intervalo
const ultimoTimestampMap = new Map(); // "docId-editor" → Date

const MIN_EDICAO_SEGUNDOS = 30;     // 30 segundos
const MAX_INTERVALO_MINUTOS = 50;   // 50 minutos

/**
 * Inicializa o monitor
 */
async function initializeMonitor() {
  console.log("Iniciando monitor...");
  try {
    savedPageToken = await driveService.getStartToken();
    console.log("Token inicial do Drive salvo.");
    
    await sheetsService.initHeaders();
    
    compositeKeyToRowIndexMap = await sheetsService.loadSheetData();
    
    console.log("--- Monitoramento iniciado ---");
    const intervalInMs = INTERVALO_EM_SEGUNDOS * 1000;
    setInterval(runMonitorCycle, intervalInMs);
    runMonitorCycle();
    
  } catch (error) {
    console.error("Falha fatal ao inicializar o monitor:", error.message);
    process.exit(1);
  }
}

/**
 * Ciclo principal de monitoramento
 */
async function runMonitorCycle() {
  if (!savedPageToken) return;

  console.log(`\n[${new Date().toISOString()}]`);
  console.log(`Iniciando ciclo... Buscando mudanças desde o último token.`);
  
  try {
    const { changes, newStartPageToken } = await driveService.listChanges(savedPageToken);
    savedPageToken = newStartPageToken; 

    if (changes.length === 0) {
      console.log("Nenhuma mudança detectada neste ciclo.");
    } else {
      console.log(`Detectadas ${changes.length} mudanças. Processando arquivos...`);
      
      const modifiedFilesData = await driveService.processFileChanges(changes);

      if (modifiedFilesData.length > 0) {
        console.log(`SUCESSO! ${modifiedFilesData.length} arquivos relevantes modificados detectados.`);
        
        for (const fileData of modifiedFilesData) {
          const editorName = fileData.ultimo_editor_nome || 'N/A';
          const key = `${fileData.documento_id}-${editorName}`;
          const existingRowIndex = compositeKeyToRowIndexMap.get(key);

          // --- 1. Converter data_ultima_modificacao para Date ---
          const [dataStr, horaStr] = fileData.data_ultima_modificacao.split(' ');
          const [dia, mes, ano] = dataStr.split('/');
          const agora = new Date(`${ano}-${mes}-${dia}T${horaStr}:00Z`);

          // --- 2. Calcular tempo a ser adicionado ---
          let tempoAdicionadoMin = 0;
          if (ultimoTimestampMap.has(key)) {
            const ultimo = ultimoTimestampMap.get(key);
            const diffSegundos = (agora - ultimo) / 1000;
            const diffMinutos = diffSegundos / 60;

            if (diffSegundos >= MIN_EDICAO_SEGUNDOS && diffMinutos <= MAX_INTERVALO_MINUTOS) {
              tempoAdicionadoMin = Math.round(diffMinutos * 10) / 10; // 1 casa decimal
            }
          }

          // --- 3. Ler dados da planilha e definir data_primeira_edicao ---
          let tempoAtualPlanilha = 0;
          let dataPrimeiraEdicao = null;

          if (existingRowIndex) {
            const rowData = await sheetsService.getRowData(existingRowIndex);
            tempoAtualPlanilha = parseFloat(rowData.tempo_total_editado_min) || 0;
            
            if (rowData.data_primeira_edicao && rowData.data_primeira_edicao.trim() !== '') {
              dataPrimeiraEdicao = rowData.data_primeira_edicao;
            }
          }

          // Primeira detecção: usar data_ultima_modificacao (com limite de criação)
          if (!dataPrimeiraEdicao) {
            const [criacaoData, criacaoHora] = fileData.data_criacao.split(' ');
            const [diaC, mesC, anoC] = criacaoData.split('/');
            const dataCriacaoArquivo = new Date(`${anoC}-${mesC}-${diaC}T${criacaoHora}:00Z`);
            
            const dataUltimaMod = agora;

            dataPrimeiraEdicao = dataUltimaMod >= dataCriacaoArquivo 
              ? fileData.data_ultima_modificacao 
              : fileData.data_criacao;
          }

          // --- 4. Somar tempo e preparar dados ---
          const novoTempoTotal = tempoAtualPlanilha + tempoAdicionadoMin;

          const dataForSheet = {
            documento_id: fileData.documento_id,
            documento_nome: fileData.documento_nome,
            ultimo_editor_nome: editorName,
            data_ultima_modificacao: fileData.data_ultima_modificacao,
            data_primeira_edicao: dataPrimeiraEdicao,
            documento_link: fileData.documento_link,
            pastas_pai_nomes: fileData.pastas_pai_nomes,
            tempo_total_editado_min: novoTempoTotal.toFixed(1),
          };

          // --- 5. Atualizar ou adicionar linha ---
          if (existingRowIndex) {
            await sheetsService.updateRow(existingRowIndex, dataForSheet);
            if (tempoAdicionadoMin > 0) {
              console.log(`[Planilha] Linha ${existingRowIndex} ATUALIZADA: +${tempoAdicionadoMin.toFixed(1)} min → ${novoTempoTotal.toFixed(1)} min total`);
            }
          } else {
            const newRowIndex = await sheetsService.appendRow(dataForSheet);
            if (newRowIndex > 0) {
              compositeKeyToRowIndexMap.set(key, newRowIndex);
              console.log(`[Planilha] Linha ${newRowIndex} ADICIONADA: ${novoTempoTotal.toFixed(1)} min (primeira edição: ${dataPrimeiraEdicao})`);
            }
          }

          // --- 6. Atualizar timestamp em memória ---
          ultimoTimestampMap.set(key, agora);
        }
      } else {
        console.log("As mudanças foram filtradas (ver logs 'Debug' acima).");
      }
    }
    
    console.log(`Próxima verificação em ${INTERVALO_EM_SEGUNDOS} segundos.`);

  } catch (error) {
    console.error("Erro grave durante o ciclo de monitoramento:", error.message);
  }
}

// --- Inicia o Monitor ---
initializeMonitor();