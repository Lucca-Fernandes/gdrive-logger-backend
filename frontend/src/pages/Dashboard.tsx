// src/pages/Dashboard.tsx
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import StatsCharts from '../components/StatsCharts';
import AppHeader from '../components/AppHeader';
import AnaliseCargos from '../components/AnaliseCargos';
import {
  Paper, Box, TextField, InputAdornment,  
  Button, Card, CardContent, ToggleButton, ToggleButtonGroup, Typography
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import { Search, Refresh, AccessTime, Person, InsertDriveFile } from '@mui/icons-material';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatePicker } from '@mui/x-date-pickers/DatePicker'; 
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

const SIDEBAR_WIDTH = 250;
const API_URL = 'https://gdrive-logger-backend.onrender.com/api';

interface Editor { 
  documentId: string; documentName: string; documentLink: string; 
  folderPath: string; editorName: string; totalMinutes: number; lastEdit: string | null; 
}
interface EixoSummary { eixo: string; totalMinutes: number; }
interface EditorRanking { editorName: string; total: number; }
interface StatsSummary { totalMinutes: number; totalEditors: number; totalDocs: number; }
interface CargoSummary {
  cargoName: string;
  totalMinutes: number;
  totalEditors: number;
  lastEdit: string | null;
}
type DatePreset = 'hoje' | 'semana' | 'mes' | 'custom';

export default function Dashboard() {
  const [data, setData] = useState<Editor[]>([]);
  const [eixosData, setEixosData] = useState<EixoSummary[]>([]);
  const [editorPieData, setEditorPieData] = useState<EditorRanking[]>([]);
  const [statsData, setStatsData] = useState<StatsSummary>({ totalMinutes: 0, totalEditors: 0, totalDocs: 0 });
  const [cargosSummary, setCargosSummary] = useState<CargoSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [startDate, setStartDate] = useState<Date | null>(startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date | null>(endOfDay(new Date()));
  const [datePreset, setDatePreset] = useState<DatePreset>('hoje');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [limit] = useState(9);
  
  // DRILL-DOWN
  const [selectedCargo, setSelectedCargo] = useState<string | undefined>(undefined);
  const [selectedEditor, setSelectedEditor] = useState<string | undefined>(undefined);
  const [editorsSummary, setEditorsSummary] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;

    setLoading(true);
    setError(false);

    try {
      const dateParams = { 
        startDate: startDate.toISOString(), 
        endDate: endDate.toISOString() 
      };

      if (selectedCargo && !selectedEditor) {
        const [editorsRes] = await Promise.all([
          axios.get(`${API_URL}/cargo/${selectedCargo}/editors-summary`, { params: dateParams })
        ]);
        setEditorsSummary(editorsRes.data);
        setData([]);
        setLoading(false);
        return;
      }

      if (selectedEditor) {
        const dataRes = await axios.get(`${API_URL}/data`, { 
          params: { ...dateParams, search: selectedEditor, page, limit } 
        });
        setData(dataRes.data.data);
        setTotalCount(dataRes.data.total);
        setLoading(false);
        return;
      }

      const [statsRes, rankingRes, eixosRes, cargosRes] = await Promise.all([
        axios.get(`${API_URL}/stats-summary`, { params: dateParams }),
        axios.get(`${API_URL}/ranking`, { params: dateParams }),
        axios.get(`${API_URL}/eixos-summary`, { params: dateParams }),
        axios.get(`${API_URL}/cargos-summary`, { params: dateParams })
      ]);

      setStatsData(statsRes.data);
      setEditorPieData(rankingRes.data);
      setEixosData(eixosRes.data);
      setCargosSummary(cargosRes.data);

      if (search) {
        const dataRes = await axios.get(`${API_URL}/data`, { 
          params: { ...dateParams, search, page, limit } 
        });
        setData(dataRes.data.data);
        setTotalCount(dataRes.data.total);
      } else {
        setData([]);
        setTotalCount(0);
      }

    } catch (err: any) {
      console.error('Erro no fetchData:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, search, selectedCargo, selectedEditor, page, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    setPage(1);
  };

  const handleCargoSelect = (cargoName: string) => {
    setSearch('');
    setSelectedCargo(cargoName);
    setSelectedEditor(undefined);
    setPage(1);
  };

  const handleEditorSelect = (editorName: string) => {
    setSearch('');
    setSelectedEditor(editorName);
    setPage(1);
  };

  const handleBackToEditors = () => {
    setSelectedEditor(undefined);
    setPage(1);
  };

  const handleBackToCargos = () => {
    setSearch('');
    setSelectedCargo(undefined);
    setSelectedEditor(undefined);
    setPage(1);
  };

  const handleDatePresetChange = (_e: any, newPreset: DatePreset | null) => {
    if (!newPreset) return;
    setDatePreset(newPreset);
    setPage(1);
    setSelectedCargo(undefined);
    setSelectedEditor(undefined);
    if (newPreset === 'hoje') {
      setStartDate(startOfDay(new Date()));
      setEndDate(endOfDay(new Date()));
    } else if (newPreset === 'semana') {
      setStartDate(startOfWeek(new Date(), { locale: ptBR }));
      setEndDate(endOfWeek(new Date(), { locale: ptBR }));
    } else if (newPreset === 'mes') {
      setStartDate(startOfMonth(new Date()));
      setEndDate(endOfMonth(new Date()));
    }
  };

  const handleManualDateChange = (isStart: boolean, newValue: Date | null) => {
    if (isStart) setStartDate(newValue ? startOfDay(newValue) : null);
    else setEndDate(newValue ? endOfDay(newValue) : null);
    setDatePreset('custom');
    setPage(1);
    setSelectedCargo(undefined);
    setSelectedEditor(undefined);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f4f6f8' }}>
        <AppHeader />
        <Box component="main" sx={{ flexGrow: 1, ml: `${SIDEBAR_WIDTH}px`, width: { xs: '100%', md: `calc(100% - ${SIDEBAR_WIDTH}px)` } }}>
          <Box sx={{ py: 3, px: 3 }}>
            <Paper elevation={3} sx={{ p: 3, borderRadius: 3 }}>
              {/* FILTROS DE DATA E BUSCA */}
              <Box mb={4}>
                <Grid container spacing={3} alignItems="center">
                  {/* Date Pickers (apenas no modo custom) */}
                  {datePreset === 'custom' && (
                    <>
                      <Grid xs={12} sm={6} md={3}>
                        <DatePicker
                          label="Data início"
                          value={startDate}
                          onChange={(v) => handleManualDateChange(true, v)}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              size: 'small',
                              sx: { '& .MuiOutlinedInput-root': { borderRadius: 3 } }
                            }
                          }}
                        />
                      </Grid>
                      <Grid xs={12} sm={6} md={3}>
                        <DatePicker
                          label="Data fim"
                          value={endDate}
                          onChange={(v) => handleManualDateChange(false, v)}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              size: 'small',
                              sx: { '& .MuiOutlinedInput-root': { borderRadius: 3 } }
                            }
                          }}
                        />
                      </Grid>
                    </>
                  )}

                  {/* Botões de Período + BUSCAR (alinhado à direita) */}
                  <Grid xs={12} md={datePreset === 'custom' ? 6 : 12}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                      {/* Botões de período */}
                      <ToggleButtonGroup
                        value={datePreset}
                        exclusive
                        onChange={handleDatePresetChange}
                        size="small"
                        sx={{
                          display: 'flex',
                          gap: 1.5,
                          flexWrap: 'wrap',
                          '& .MuiToggleButton-root': {
                            borderRadius: 3,
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            px: 2.5,
                            py: 1,
                            border: '1px solid #1976d2',
                            color: '#1976d2',
                            bgcolor: 'transparent',
                            '&.Mui-selected': {
                              bgcolor: '#1976d2',
                              color: 'white',
                              '&:hover': { bgcolor: '#1565c0' },
                            },
                            '&:hover': {
                              bgcolor: 'rgba(25, 118, 210, 0.08)',
                            },
                          },
                        }}
                      >
                        <ToggleButton value="hoje">HOJE</ToggleButton>
                        <ToggleButton value="semana">SEMANA</ToggleButton>
                        <ToggleButton value="mes">MÊS</ToggleButton>
                        <ToggleButton value="custom">PERÍODO</ToggleButton>
                      </ToggleButtonGroup>

                      {/* Botão BUSCAR à direita */}
                      <Button
                        onClick={handleSearch}
                        variant="contained"
                        startIcon={<Refresh />}
                        size="small"
                        sx={{
                          height: 40,
                          borderRadius: 3,
                          fontWeight: 600,
                          fontSize: '0.875rem',
                          px: 3,
                          textTransform: 'none',
                          minWidth: 120,
                          boxShadow: 2,
                          '&:hover': { boxShadow: 4 },
                        }}
                      >
                        BUSCAR
                      </Button>
                    </Box>
                  </Grid>
                </Grid>

                {/* Campo de busca (abaixo dos filtros) */}
                <Grid container spacing={3} mt={2}>
                  <Grid xs={12}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Buscar por documento/editor..."
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

              {/* Estatísticas e gráficos */}
              {!loading && !selectedCargo && !selectedEditor && !search && (
                <>
                  <Grid container spacing={3} mb={4}>
                    <Grid xs={12} sm={4}>
                      <Card sx={{ borderRadius: 3, boxShadow: 1 }}>
                        <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>MINUTOS TOTAIS</Typography>
                            <Typography variant="h3" fontWeight="bold" color="#1976d2">
                              {statsData.totalMinutes.toFixed(1)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">Minutos no período</Typography>
                          </Box>
                          <Box sx={{ bgcolor: '#e3f2fd', p: 1.5, borderRadius: '50%' }}>
                            <AccessTime sx={{ fontSize: 24, color: '#1976d2' }} />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid xs={12} sm={4}>
                      <Card sx={{ borderRadius: 3, boxShadow: 1 }}>
                        <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>EDITORES TOTAIS</Typography>
                            <Typography variant="h3" fontWeight="bold" color="#673ab7">
                              {statsData.totalEditors}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">Editores no período</Typography>
                          </Box>
                          <Box sx={{ bgcolor: '#ede7f6', p: 1.5, borderRadius: '50%' }}>
                            <Person sx={{ fontSize: 24, color: '#673ab7' }} />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                    <Grid xs={12} sm={4}>
                      <Card sx={{ borderRadius: 3, boxShadow: 1 }}>
                        <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                          <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>DOCUMENTOS TOTAIS</Typography>
                            <Typography variant="h3" fontWeight="bold" color="#ff9800">
                              {statsData.totalDocs}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">Documentos no período</Typography>
                          </Box>
                          <Box sx={{ bgcolor: '#fff3e0', p: 1.5, borderRadius: '50%' }}>
                            <InsertDriveFile sx={{ fontSize: 24, color: '#ff9800' }} />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  </Grid>
                  <StatsCharts editorPieData={editorPieData} cargosSummary={cargosSummary} showCargoDistribution={false} />
                </>
              )}

              {/* COMPONENTE PRINCIPAL */}
              <AnaliseCargos
                data={data}
                loading={loading}
                error={error}
                totalCount={totalCount}
                limit={limit}
                currentPage={page}
                onPageChange={setPage}
                fetchData={fetchData}
                selectedCargo={selectedCargo}
                selectedEditor={selectedEditor}
                editorsSummary={editorsSummary}
                cargosSummary={cargosSummary}
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