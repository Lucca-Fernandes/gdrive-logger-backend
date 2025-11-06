// src/pages/Dashboard.tsx
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import StatsCharts from '../components/StatsCharts';
import AppHeader from '../components/AppHeader'; // Agora é a Sidebar
import AnaliseCargos from '../components/AnaliseCargos';
import {
  Paper, Box, TextField, InputAdornment,  
  Button, Card, CardContent, ToggleButton, ToggleButtonGroup, Typography
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import { Search, Refresh, AccessTime, Person, InsertDriveFile } from '@mui/icons-material'; // Download removido
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatePicker } from '@mui/x-date-pickers/DatePicker'; 
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

// Adicionado aqui para referência da largura da Sidebar
const SIDEBAR_WIDTH = 250;

interface Editor { documentId: string; documentName: string; documentLink: string; folderPath: string; editorName: string; totalMinutes: number; lastEdit: string | null; }
interface EixoSummary { eixo: string; totalMinutes: number; }
interface EditorRanking { editorName: string; total: number; }
interface StatsSummary { totalMinutes: number; totalEditors: number; totalDocs: number; }
type DatePreset = 'hoje' | 'semana' | 'mes' | 'custom';

export default function Dashboard() {
  const [data, setData] = useState<Editor[]>([]);
  const [eixosData, setEixosData] = useState<EixoSummary[]>([]);
  const [editorPieData, setEditorPieData] = useState<EditorRanking[]>([]);
  const [statsData, setStatsData] = useState<StatsSummary>({ totalMinutes: 0, totalEditors: 0, totalDocs: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date | null>(endOfDay(new Date()));
  const [datePreset, setDatePreset] = useState<DatePreset>('hoje');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit] = useState(9);
  const API_URL = 'https://gdrive-logger-backend.onrender.com/api';

  const fetchData = useCallback(async (currentPage = 1, editorName?: string) => {
    // Certificando-se de que startDate e endDate sejam válidos antes da chamada
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
        search: editorName || search || undefined
      };

      if (!editorName) {
        const [dataRes, statsRes, rankingRes, eixosRes] = await Promise.all([
          axios.get(`${API_URL}/data`, { params: dataParams }),
          axios.get(`${API_URL}/stats-summary`, { params: dateParams }),
          axios.get(`${API_URL}/ranking`, { params: dateParams }),
          axios.get(`${API_URL}/eixos-summary`, { params: dateParams })
        ]);
        setStatsData(statsRes.data); setEditorPieData(rankingRes.data); setEixosData(eixosRes.data);
        setData(dataRes.data.data); setTotalCount(dataRes.data.total); setPage(currentPage);
      } else {
        const dataRes = await axios.get(`${API_URL}/data`, { params: dataParams });
        setData(dataRes.data.data); setTotalCount(dataRes.data.total); setPage(currentPage);
      }
    } catch (err) { console.error(err); setError(true); } finally { setLoading(false); }
  }, [API_URL, startDate, endDate, limit, search, datePreset]);


  // FUNÇÃO exportCSV REMOVIDA
  // const exportCSV = async () => { ... }


  useEffect(() => { fetchData(page); }, [startDate, endDate, page, fetchData]);

  const handleDatePresetChange = (_e: any, newPreset: DatePreset | null) => {
    if (!newPreset) return;
    setDatePreset(newPreset); setPage(1);
    if (newPreset === 'hoje') { setStartDate(startOfDay(new Date())); setEndDate(endOfDay(new Date())); }
    else if (newPreset === 'semana') { setStartDate(startOfWeek(new Date(), { locale: ptBR })); setEndDate(endOfWeek(new Date(), { locale: ptBR })); }
    else if (newPreset === 'mes') { setStartDate(startOfMonth(new Date())); setEndDate(endOfMonth(new Date())); }
  };

  const handleManualDateChange = (isStart: boolean, newValue: Date | null) => {
    if (isStart) setStartDate(newValue ? startOfDay(newValue) : null);
    else setEndDate(newValue ? endOfDay(newValue) : null);
    setDatePreset('custom'); setPage(1);
  };

  const handleSearch = () => { setPage(1); fetchData(1); };

  // O componente Dashboard deve ser envolvido pelo LocalizationProvider
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
      {/* 1. Box principal define o fundo da tela e o layout flexivel */}
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f4f6f8' }}> 
        
        {/* 2. Sidebar (AppHeader modificado) */}
        <AppHeader /> 
        
        {/* 3. Conteúdo Principal, deslocado para a direita da Sidebar e ocupando a largura restante */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            ml: `${SIDEBAR_WIDTH}px`, // Desloca o conteúdo para a direita
            // Ocupa 100% da largura da tela menos a sidebar
            width: { xs: '100%', md: `calc(100% - ${SIDEBAR_WIDTH}px)` }, 
          }}
        >
          {/* Box que substitui o Container para ocupar 100% da largura disponível, mantendo o padding */}
          <Box sx={{ py: 3, px: 3 }}> 
          
            {/* Botão de exportar REMOVIDO daqui
            <Box display="flex" justifyContent="flex-end" mb={2}>
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
            */}

          {/* 4. Conteúdo principal em Card/Paper para o efeito de "painel flutuante" */}
          <Paper elevation={3} sx={{ p: 3, borderRadius: 3 }}>
            
            {/* Seção de Filtros/Datas APRIMORADA com exibição condicional */}
            <Box mb={4}>
              <Grid container spacing={3} alignItems="center"> 
                
                {/* Data Início e Data Fim - Exibidos SOMENTE se datePreset for 'custom' */}
                {datePreset === 'custom' && (
                  <>
                    {/* Data Início */}
                    <Grid xs={12} sm={6} md={2.5}>
                      <DatePicker 
                        label="Data início" 
                        value={startDate} 
                        onChange={(v) => handleManualDateChange(true, v)} 
                        slotProps={{ 
                          textField: { 
                            fullWidth: true, 
                            size: 'small', 
                            sx: { '& .MuiOutlinedInput-root': { borderRadius: 3 } },
                            inputProps: { style: { fontSize: '1.1rem', padding: '10.5px 14px' } }
                          } 
                        }} 
                      />
                    </Grid>
                    
                    {/* Data Fim */}
                    <Grid xs={12} sm={6} md={2.5}>
                      <DatePicker 
                        label="Data fim" 
                        value={endDate} 
                        onChange={(v) => handleManualDateChange(false, v)} 
                        slotProps={{ 
                          textField: { 
                            fullWidth: true, 
                            size: 'small', 
                            sx: { '& .MuiOutlinedInput-root': { borderRadius: 3 } },
                            inputProps: { style: { fontSize: '1.1rem', padding: '10.5px 14px' } }
                          } 
                        }} 
                      />
                    </Grid>
                  </>
                )}

                {/* ToggleGroup e Botão Buscar - Layout flexível e condicional */}
                <Grid 
                    xs={12} 
                    // Se 'custom' (datas visíveis), o grupo é menor e alinha aos DatePickers
                    md={datePreset === 'custom' ? 4 : 8} 
                    lg={datePreset === 'custom' ? 4 : 8}
                    display="flex" 
                    gap={1} 
                    justifyContent="flex-start"
                >
                  <ToggleButtonGroup 
                    value={datePreset} 
                    exclusive 
                    onChange={handleDatePresetChange} 
                    size="small" 
                    sx={{ 
                      height: 40, 
                      borderRadius: 3, 
                      bgcolor: '#f5f5f5', 
                      // Aplica flexGrow: 1 somente quando não há campos de data
                      flexGrow: datePreset === 'custom' ? 0 : 1, 
                      '& .MuiToggleButtonGroup-grouped': { 
                        margin: 0.5, 
                        border: 0, 
                        borderRadius: 2, 
                        fontWeight: 500,
                        // Faz com que os botões se expandam para preencher o ToggleButtonGroup
                        flexGrow: datePreset === 'custom' ? 0 : 1, 
                        '&.Mui-selected': {
                          bgcolor: '#1976d2', 
                          color: 'white',
                          '&:hover': { bgcolor: '#115293' }
                        }
                      }
                    }}
                  >
                    <ToggleButton value="hoje" sx={{ px: { xs: 1, sm: 1.5 }, minWidth: 0 }}>HOJE</ToggleButton>
                    <ToggleButton value="semana" sx={{ px: { xs: 1, sm: 1.5 }, minWidth: 0 }}>SEMANA</ToggleButton>
                    <ToggleButton value="mes" sx={{ px: { xs: 1, sm: 1.5 }, minWidth: 0 }}>MÊS</ToggleButton>
                    <ToggleButton value="custom" sx={{ px: { xs: 1, sm: 1.5 }, minWidth: 0 }}>PERÍODO</ToggleButton>
                  </ToggleButtonGroup>
                  
                  <Button 
                    onClick={handleSearch} 
                    variant="contained" 
                    startIcon={<Refresh />} 
                    size="small" 
                    sx={{ 
                      height: 40, 
                      whiteSpace: 'nowrap', 
                      minWidth: '100px', 
                      borderRadius: 3,
                      fontWeight: 500 
                    }}
                  >
                    BUSCAR
                  </Button>
                </Grid>

                {/* Campo de Busca - Ocupa o restante do espaço */}
                <Grid 
                    xs={12} 
                    md={datePreset === 'custom' ? 2 : 4} // Ocupa 2 quando datas visíveis, 4 quando não
                >
                  <TextField 
                    fullWidth 
                    size="small" 
                    placeholder="Buscar por documento..." 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()} 
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                    InputProps={{ 
                      startAdornment: <InputAdornment position="start"><Search /></InputAdornment> 
                    }} 
                  />
                </Grid>
              </Grid>
            </Box>

            {/* ESTATÍSTICAS + GRÁFICOS */}
            {!loading && (
              <>
                {/* Cards de Estatísticas - Estilo Moderno e Arredondado */}
                <Grid container spacing={3} mb={4}>
                  {/* Card Minutos Totais (Azul) */}
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

                  {/* Card Editores Totais (Roxo) */}
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

                  {/* Card Documentos Totais (Laranja) */}
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
            />

          </Paper>
        </Box> 
      </Box> 
      </Box> 
    </LocalizationProvider>
  );
}