// src/pages/Dashboard.tsx
import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react';
import axios from 'axios';
import StatsCharts from '../components/StatsCharts';
import AppHeader from '../components/AppHeader';
import AnaliseCargos from '../components/AnaliseCargos';
import {
  Paper, Box, TextField, InputAdornment,  
  Button, Card, CardContent, ToggleButton, ToggleButtonGroup, Typography
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import { Search, Refresh, AccessTime, Person, InsertDriveFile, Download } from '@mui/icons-material';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatePicker } from '@mui/x-date-pickers/DatePicker'; 
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

const SIDEBAR_WIDTH = 250;
const API_URL = 'https://gdrive-logger-backend.onrender.com/api';

// Interfaces de Dados
interface Editor { 
    documentId: string; documentName: string; documentLink: string; 
    folderPath: string; editorName: string; totalMinutes: number; lastEdit: string | null; 
}
interface EixoSummary { eixo: string; totalMinutes: number; }
interface EditorRanking { editorName: string; total: number; }
interface StatsSummary { totalMinutes: number; totalEditors: number; totalDocs: number; }
type DatePreset = 'hoje' | 'semana' | 'mes' | 'custom';

export default function Dashboard() {
  const [data, setData] = useState<Editor[]>([]);
  const [eixosData, setEixosData] = useState<EixoSummary[]>([]);
  const [editorPieData, setEditorPieData] = useState<EditorRanking[]>([]);
  const [statsData, setStatsData] = useState<StatsSummary>({ totalMinutes: 0, totalEditors: 0, totalDocs: 0 });
  const [search, setSearch] = useState(''); // Busca manual do usuário
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date | null>(endOfDay(new Date()));
  const [datePreset, setDatePreset] = useState<DatePreset>('hoje');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit] = useState(9);
  
  // ESTADOS PARA O DRILL-DOWN DE 3 NÍVEIS
  const [selectedCargo, setSelectedCargo] = useState<string | undefined>(undefined);
  const [selectedEditor, setSelectedEditor] = useState<string | undefined>(undefined);

  // === FUNÇÃO DE BUSCA DA API (useCallback) ===
  const fetchData = useCallback(async (currentPage = 1, searchOverride?: string) => {
    
    // O filtro da API é a busca manual/override (usado no Nível 3 ou na busca manual)
    const currentFilter = searchOverride !== undefined ? searchOverride : (search || undefined);
    
    const start = datePreset === 'custom' && !startDate ? null : startDate;
    const end = datePreset === 'custom' && !endDate ? null : endDate;
    
    if (!start || !end) {
        if (datePreset !== 'custom') { 
            if (!startDate || !endDate) return setData([]), setLoading(false);
        } else {
             return setData([]), setLoading(false);
        }
    }
    
    setError(false); 
    setLoading(true);

    try {
      const dateParams = { startDate: (start || startDate)?.toISOString(), endDate: (end || endDate)?.toISOString() };
      const dataParams = {
        ...dateParams,
        page: currentPage,
        limit,
        search: currentFilter 
      };

      // 1. Chamada de dados principal (/data)
      const dataRes = await axios.get(`${API_URL}/data`, { params: dataParams });
      setData(dataRes.data.data); 
      setTotalCount(dataRes.data.total); 
      setPage(currentPage);
      
      // 2. Chamadas de Stats/Ranking/Eixos (SÓ CARREGA SE NÃO HOUVER FILTRO ATIVO)
      // selectedCargo e selectedEditor são verificados aqui para garantir que o Dashboard principal
      // não exiba stats de um filtro específico de drill-down
      if (!currentFilter && !selectedCargo && !selectedEditor) { 
        const [statsRes, rankingRes, eixosRes] = await Promise.all([
          axios.get(`${API_URL}/stats-summary`, { params: dateParams }),
          axios.get(`${API_URL}/ranking`, { params: dateParams }),
          axios.get(`${API_URL}/eixos-summary`, { params: dateParams })
        ]);
        setStatsData(statsRes.data); 
        setEditorPieData(rankingRes.data); 
        setEixosData(eixosRes.data);
      }
      
    } catch (err) { 
        console.error(err); 
        setError(true); 
    } finally { 
        setLoading(false); 
    }
    
  // As dependências 'selectedCargo' e 'selectedEditor' garantem que a função seja recriada
  // quando o estado de drill-down muda.
  }, [startDate, endDate, limit, search, datePreset, selectedCargo, selectedEditor]); 
  
  // ==========================================================
  // LÓGICA DE RECARGA: SÓ DISPARA A BUSCA GERAL NO NÍVEL 1 OU NÍVEL 3 (Com busca manual)
  // ==========================================================
  useEffect(() => { 
    // A chamada de API só deve ser automática se:
    // 1. Estiver no Nível 1 (sem cargo/editor selecionado)
    // 2. Estiver no Nível 3 (com selectedEditor)
    // 3. Estiver com uma busca manual (search) ativa
    if (!selectedCargo || selectedEditor || search) {
        fetchData(page); 
    }
    // NÃO CHAMA: Se estiver no Nível 2 (selectedCargo && !selectedEditor), 
    // pois ele usa agregação LOCAL
    
  }, [fetchData, page, selectedCargo, selectedEditor, search]); 

  // === FUNÇÕES DE NAVEGAÇÃO E BUSCA ===
  
  const handleSearch = () => { 
    // CORREÇÃO: Ao buscar manualmente, reseta os estados de drill-down
    setSelectedCargo(undefined); 
    setSelectedEditor(undefined);
    setPage(1); 
    fetchData(1); 
  };
  
  // Nível 1 -> Nível 2 (Seleciona o Cargo/Pasta) - Agregação Local
  const handleCargoSelect = (cargoName: string) => {
    setSearch(''); 
    setSelectedCargo(cargoName);
    setSelectedEditor(undefined); 
    setPage(1);
    // NÃO CHAMA fetchData: usa os dados carregados do Nível 1 para agregação local.
  };

  // Nível 2 -> Nível 3 (Seleciona o Editor/Funcionário) - Nova Chamada de API
  const handleEditorSelect = (editorName: string) => {
    setSearch(''); 
    setSelectedEditor(editorName);
    setPage(1);
    // CHAMA fetchData explicitamente com o override do editor.
    fetchData(1, editorName); 
  };

  // Nível 3 -> Nível 2 (Volta para a lista de Editores/Funcionários do Cargo) - Agregação Local
  const handleBackToEditors = () => {
    setSearch(''); 
    setSelectedEditor(undefined); 
    setPage(1);
    // NÃO CHAMA fetchData: volta para a agregação local do Nível 2.
    // É importante que o 'data' ainda contenha todos os dados do cargo selecionado.
  };
  
  // Nível 2 -> Nível 1 (Volta para a lista de Cargos/Eixos) - Nova Chamada de API
  const handleBackToCargos = () => {
    setSearch(''); 
    setSelectedCargo(undefined);
    setSelectedEditor(undefined);
    setPage(1);
    // CHAMA fetchData para RECARREGAR os dados gerais (filtro = undefined).
    fetchData(1, undefined); 
  };
  
  // Lógica de Data (mantida)
  const handleDatePresetChange = (_e: any, newPreset: DatePreset | null) => {
    if (!newPreset) return;
    setDatePreset(newPreset); setPage(1);
    setSelectedCargo(undefined); setSelectedEditor(undefined); // Reset Drill-down
    if (newPreset === 'hoje') { setStartDate(startOfDay(new Date())); setEndDate(endOfDay(new Date())); }
    else if (newPreset === 'semana') { setStartDate(startOfWeek(new Date(), { locale: ptBR })); setEndDate(endOfWeek(new Date(), { locale: ptBR })); }
    else if (newPreset === 'mes') { setStartDate(startOfMonth(new Date())); setEndDate(endOfMonth(new Date())); }
  };

  const handleManualDateChange = (isStart: boolean, newValue: Date | null) => {
    if (isStart) setStartDate(newValue ? startOfDay(newValue) : null);
    else setEndDate(newValue ? endOfDay(newValue) : null);
    setDatePreset('custom'); setPage(1);
    setSelectedCargo(undefined); setSelectedEditor(undefined); // Reset Drill-down
  };

  // Exportar CSV (mantido)
  const exportCSV = async () => { /* ... sua lógica de exportação ... */ };
  
  // === RENDERIZAÇÃO ===
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f4f6f8' }}> 
        <AppHeader /> 
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            ml: `${SIDEBAR_WIDTH}px`,
            width: { xs: '100%', md: `calc(100% - ${SIDEBAR_WIDTH}px)` }, 
          }}
        >
          <Box sx={{ py: 3, px: 3 }}> 
            
            <Box display="flex" justifyContent="flex-end" alignItems="center" mb={2} sx={{ minHeight: '36.5px' }}>
              <Button 
                variant="contained" 
                size="small" 
                startIcon={<Download />}
                onClick={exportCSV}
                disabled={loading || data.length === 0}
                sx={{ 
                  bgcolor: '#6a1b9a', 
                  '&:hover': { bgcolor: '#4a148c' },
                  textTransform: 'none',
                  fontWeight: 500,
                  borderRadius: 3 
                }}
              >
                EXPORTAR CSV
              </Button>
            </Box>

          <Paper elevation={3} sx={{ p: 3, borderRadius: 3 }}>
            
            {/* Seção de Filtros/Datas */}
            <Box mb={4}>
              <Grid container spacing={3} alignItems="center"> 
                {datePreset === 'custom' && (
                  <>
                    <Grid xs={12} sm={6} md={2.5}>
                      <DatePicker label="Data início" value={startDate} onChange={(v) => handleManualDateChange(true, v)} slotProps={{ textField: { fullWidth: true, size: 'small', sx: { '& .MuiOutlinedInput-root': { borderRadius: 3 } }, inputProps: { style: { fontSize: '1.1rem', padding: '10.5px 14px' } } } }} />
                    </Grid>
                    <Grid xs={12} sm={6} md={2.5}>
                      <DatePicker label="Data fim" value={endDate} onChange={(v) => handleManualDateChange(false, v)} slotProps={{ textField: { fullWidth: true, size: 'small', sx: { '& .MuiOutlinedInput-root': { borderRadius: 3 } }, inputProps: { style: { fontSize: '1.1rem', padding: '10.5px 14px' } } } }} />
                    </Grid>
                  </>
                )}
                <Grid md={datePreset === 'custom' ? 4 : 8} lg={datePreset === 'custom' ? 4 : 8} display="flex" gap={1} justifyContent="flex-start">
                  <ToggleButtonGroup value={datePreset} exclusive onChange={handleDatePresetChange} size="small" sx={{ height: 40, borderRadius: 3, bgcolor: '#f5f5f5', flexGrow: datePreset === 'custom' ? 0 : 1, '& .MuiToggleButtonGroup-grouped': { margin: 0.5, border: 0, borderRadius: 2, fontWeight: 500, flexGrow: datePreset === 'custom' ? 0 : 1, '&.Mui-selected': { bgcolor: '#1976d2', color: 'white', '&:hover': { bgcolor: '#115293' } } } }}>
                    <ToggleButton value="hoje" sx={{ px: { xs: 1, sm: 1.5 }, minWidth: 0 }}>HOJE</ToggleButton>
                    <ToggleButton value="semana" sx={{ px: { xs: 1, sm: 1.5 }, minWidth: 0 }}>SEMANA</ToggleButton>
                    <ToggleButton value="mes" sx={{ px: { xs: 1, sm: 1.5 }, minWidth: 0 }}>MÊS</ToggleButton>
                    <ToggleButton value="custom" sx={{ px: { xs: 1, sm: 1.5 }, minWidth: 0 }}>PERÍODO</ToggleButton>
                  </ToggleButtonGroup>
                  <Button onClick={handleSearch} variant="contained" startIcon={<Refresh />} size="small" sx={{ height: 40, whiteSpace: 'nowrap', minWidth: '100px', borderRadius: 3, fontWeight: 500 }}>BUSCAR</Button>
                </Grid>
                <Grid md={datePreset === 'custom' ? 2 : 4}>
                  <TextField 
                    fullWidth 
                    size="small" 
                    placeholder="Buscar por documento/editor..." 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()} 
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }} 
                    InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} 
                  />
                </Grid>
              </Grid>
            </Box>

            {/* ESTATÍSTICAS + GRÁFICOS - Oculta em Nível 2 ou 3 (Drill-down) */}
            {!loading && !selectedCargo && !selectedEditor && ( 
              <>
                {/* Cards de Estatísticas (Mantido) */}
                <Grid container spacing={3} mb={4}>
                  <Grid xs={12} sm={4}>
                    <Card sx={{ borderRadius: 3, boxShadow: 1, p: 1 }}> 
                      <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, '&:last-child': { pb: 2 } }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>MINUTOS TOTAIS</Typography>
                          <Typography variant="h3" fontWeight="bold" color="#1976d2">
                            {statsData.totalMinutes.toFixed(1)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Minutos no período
                          </Typography>
                        </Box>
                        <Box sx={{ bgcolor: '#e3f2fd', p: 1.5, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <AccessTime sx={{ fontSize: 24, color: '#1976d2' }} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid xs={12} sm={4}>
                    <Card sx={{ borderRadius: 3, boxShadow: 1, p: 1 }}>
                      <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, '&:last-child': { pb: 2 } }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>EDITORES TOTAIS</Typography>
                          <Typography variant="h3" fontWeight="bold" color="#673ab7">
                            {statsData.totalEditors}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Editores no período
                          </Typography>
                        </Box>
                        <Box sx={{ bgcolor: '#ede7f6', p: 1.5, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Person sx={{ fontSize: 24, color: '#673ab7' }} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid xs={12} sm={4}>
                    <Card sx={{ borderRadius: 3, boxShadow: 1, p: 1 }}>
                      <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, '&:last-child': { pb: 2 } }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>DOCUMENTOS TOTAIS</Typography>
                          <Typography variant="h3" fontWeight="bold" color="#ff9800">
                            {statsData.totalDocs}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Documentos no período
                          </Typography>
                        </Box>
                        <Box sx={{ bgcolor: '#fff3e0', p: 1.5, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <InsertDriveFile sx={{ fontSize: 24, color: '#ff9800' }} />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Gráfico principal (StatsCharts) */}
                <StatsCharts editorPieData={editorPieData} eixosData={eixosData} />
              </>
            )}
            
            {/* COMPONENTE DE ANÁLISE POR CARGOS */}
            <AnaliseCargos
              data={data}
              loading={loading}
              error={error}
              totalCount={totalCount}
              limit={limit}
              currentPage={page}
              onPageChange={setPage}
              fetchData={fetchData} 
              // PROPS DE NAVEGAÇÃO
              selectedCargo={selectedCargo}
              selectedEditor={selectedEditor}
              onCargoSelect={handleCargoSelect}
              onEditorSelect={handleEditorSelect}
              onBackToEditors={handleBackToEditors} 
              onBackToCargos={handleBackToCargos}
            />

          </Paper>
        </Box> 
      </Box> 
      </Box> 
    </LocalizationProvider>
  );
}