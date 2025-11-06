// src/pages/Dashboard.tsx
import { useState, useEffect, useCallback, type Dispatch, type SetStateAction } from 'react'; 
import axios from 'axios';
import StatsCharts from '../components/StatsCharts';
import AppHeader from '../components/AppHeader'; // Assume que é a Sidebar
import AnaliseCargos from '../components/AnaliseCargos';
import {
  Paper, Box, TextField, InputAdornment,  
  Button, Card, CardContent, ToggleButton, ToggleButtonGroup, Typography
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
// Importa o ícone de seta de volta e outros ícones
import { Search, Refresh, AccessTime, Person, InsertDriveFile, Download } from '@mui/icons-material'; 
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatePicker } from '@mui/x-date-pickers/DatePicker'; 
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

const SIDEBAR_WIDTH = 250;
const API_URL = 'https://gdrive-logger-backend.onrender.com/api'; // Certifique-se de que a URL está correta

// Interfaces de Dados (Mantenha conforme seu projeto)
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


  const fetchData = useCallback(async (currentPage = 1, searchOverride?: string) => {
    
    // 1. Prioridade do Filtro: Override (e.g., Editor) > Busca Manual > Drill-down
    let currentFilter: string | undefined = undefined;
    
    if (searchOverride !== undefined) {
        currentFilter = searchOverride;
    } else if (selectedEditor) {
        currentFilter = selectedEditor;
    } else if (selectedCargo) {
        currentFilter = selectedCargo;
    } else if (search) {
        currentFilter = search;
    }

    // 2. Lógica de Data (mantida)
    const start = datePreset === 'custom' && !startDate ? null : startDate;
    const end = datePreset === 'custom' && !endDate ? null : endDate;
    
    if (!start || !end) {
        if (datePreset !== 'custom') { 
            if (!startDate || !endDate) return setData([]), setLoading(false);
        } else {
             return setData([]), setLoading(false);
        }
    }
    
    setError(false); setLoading(true);
    
    try {
      const dateParams = { startDate: (start || startDate)?.toISOString(), endDate: (end || endDate)?.toISOString() };
      const dataParams = {
        ...dateParams,
        page: currentPage,
        limit,
        // Envia o filtro determinado pela lógica de prioridade
        search: currentFilter || undefined 
      };

      // 3. Chama APIs de Stats/Ranking apenas se não houver filtro ativo (Nível 1)
      if (!currentFilter) { 
        const [dataRes, statsRes, rankingRes, eixosRes] = await Promise.all([
          axios.get(`${API_URL}/data`, { params: dataParams }),
          axios.get(`${API_URL}/stats-summary`, { params: dateParams }),
          axios.get(`${API_URL}/ranking`, { params: dateParams }),
          axios.get(`${API_URL}/eixos-summary`, { params: dateParams })
        ]);
        setStatsData(statsRes.data); setEditorPieData(rankingRes.data); setEixosData(eixosRes.data);
        setData(dataRes.data.data); setTotalCount(dataRes.data.total); setPage(currentPage);
      } else {
        // Níveis 2 e 3 ou BUSCA MANUAL ATIVA: Apenas dados filtrados são necessários
        const dataRes = await axios.get(`${API_URL}/data`, { params: dataParams });
        setData(dataRes.data.data); setTotalCount(dataRes.data.total); setPage(currentPage);
      }
    } catch (err) { console.error(err); setError(true); } finally { setLoading(false); }
  }, [startDate, endDate, limit, search, datePreset, selectedCargo, selectedEditor]); 
  
  // Efeito para recarregar quando os filtros de data/drill-down mudam
  useEffect(() => { 
    // Garante que a primeira página de dados seja carregada corretamente
    fetchData(page); 
  }, [startDate, endDate, page, fetchData]); 

  // === FUNÇÕES DE NAVEGAÇÃO E BUSCA ===
  
  // 1. Busca Manual (Sobrescreve qualquer drill-down)
  const handleSearch = () => { 
    setSelectedCargo(undefined); 
    setSelectedEditor(undefined);
    setPage(1); 
    // fetchData(1) usará o state `search`
    fetchData(1); 
  };
  
  // 2. Nível 1 -> Nível 2 (Seleciona o Cargo)
  const handleCargoSelect = (cargoName: string) => {
    setSearch(''); // Limpa a busca manual
    setSelectedCargo(cargoName);
    setSelectedEditor(undefined); 
    setPage(1);
    // Não precisa de fetchData: o useEffect pega a mudança de state e chama fetchData(1)
  };

  // 3. Nível 2 -> Nível 3 (Seleciona o Editor/Funcionário)
  const handleEditorSelect = (editorName: string) => {
    setSearch(''); // Limpa a busca manual
    setSelectedEditor(editorName);
    setPage(1);
    // Força o filtro do editor (busca Nível 3)
    fetchData(1, editorName); 
  };

  // 4. Nível 3 -> Nível 2 (Volta para a lista de Editores/Funcionários do Cargo)
  const handleBackToEditors = () => {
    setSearch(''); // Limpa a busca manual
    setSelectedEditor(undefined); 
    setPage(1);
    // Não precisa de fetchData: o useEffect pega a mudança de state e chama fetchData(1)
  };
  
  // 5. Nível 2 -> Nível 1 (Volta para a lista de Cargos)
  const handleBackToCargos = () => {
    setSearch(''); // Limpa a busca manual
    setSelectedCargo(undefined);
    setSelectedEditor(undefined);
    setPage(1);
    // Pede ao Dashboard para carregar os dados gerais novamente (filtro = undefined)
    fetchData(1, undefined); 
  };
  
  // 6. Lógica de Data (mantida)
  const handleDatePresetChange = (_e: any, newPreset: DatePreset | null) => {
    if (!newPreset) return;
    setDatePreset(newPreset); setPage(1);
    setSelectedCargo(undefined); setSelectedEditor(undefined); // Reseta drill-down
    if (newPreset === 'hoje') { setStartDate(startOfDay(new Date())); setEndDate(endOfDay(new Date())); }
    else if (newPreset === 'semana') { setStartDate(startOfWeek(new Date(), { locale: ptBR })); setEndDate(endOfWeek(new Date(), { locale: ptBR })); }
    else if (newPreset === 'mes') { setStartDate(startOfMonth(new Date())); setEndDate(endOfMonth(new Date())); }
  };

  const handleManualDateChange = (isStart: boolean, newValue: Date | null) => {
    if (isStart) setStartDate(newValue ? startOfDay(newValue) : null);
    else setEndDate(newValue ? endOfDay(newValue) : null);
    setDatePreset('custom'); setPage(1);
    setSelectedCargo(undefined); setSelectedEditor(undefined); // Reseta drill-down
  };

  // 7. Exportar CSV (se aplicável no seu projeto)
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
            
            {/* Box de Ações no Topo - Botão Exportar (Direita) */}
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
                {/* Cards de Estatísticas (Mantenha o seu código de cards aqui) */}
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
              // PROPS DE NAVEGAÇÃO - ESTAS DEVEM ESTAR PRESENTES!
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