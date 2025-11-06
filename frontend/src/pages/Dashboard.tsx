// src/pages/Dashboard.tsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import StatsCharts from '../components/StatsCharts';
import AppHeader from '../components/AppHeader';
import {
  Container, Paper, Box, TextField, InputAdornment,
  Button, Card, CardContent, CardActions, Chip, Avatar,
  Skeleton, Alert, Pagination, ToggleButton, ToggleButtonGroup, Typography 
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import { Search, Refresh, AccessTime, Person, Folder, Link as LinkIcon, InsertDriveFile, Download } from '@mui/icons-material';
import { format, isValid, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

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

  const fetchData = async (currentPage = 1) => {
    if (!startDate || !endDate) return setData([]), setLoading(false);
    setError(false); setLoading(true);
    try {
      const dateParams = { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
      const dataParams = { ...dateParams, page: currentPage, limit, search: search || undefined };
      const [dataRes, statsRes, rankingRes, eixosRes] = await Promise.all([
        axios.get(`${API_URL}/data`, { params: dataParams }),
        axios.get(`${API_URL}/stats-summary`, { params: dateParams }),
        axios.get(`${API_URL}/ranking`, { params: dateParams }),
        axios.get(`${API_URL}/eixos-summary`, { params: dateParams })
      ]);
      setData(dataRes.data.data); setTotalCount(dataRes.data.total); setPage(currentPage);
      setStatsData(statsRes.data); setEditorPieData(rankingRes.data); setEixosData(eixosRes.data);
    } catch (err) { console.error(err); setError(true); } finally { setLoading(false); }
  };

  const exportCSV = async () => {
    try {
      const res = await axios.get(`${API_URL}/export`, {
        responseType: 'blob',
        params: { search: search || undefined, startDate: startDate?.toISOString(), endDate: endDate?.toISOString() },
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url;
      link.setAttribute('download', `relatorio_eventos_${new Date().toISOString().split('T')[0]}.csv`);
      link.click(); link.remove();
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchData(page); }, [startDate, endDate, page]);

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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    return isValid(date) ? format(date, "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'Inválido';
  };

  const pageCount = Math.ceil(totalCount / limit);

  return (
    <>
      <AppHeader />
      <Container maxWidth="xl" sx={{ py: 3 }}>
      
       <Box sx={{ 
            bgcolor: 'primary.main', 
            color: 'white', 
            p: 2, 
            borderRadius: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            mb: 3
          }}>
            <Typography variant="h6" fontWeight="bold">
              Monitor de Edição
            </Typography>
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
                fontWeight: 500
              }}
            >
              EXPORTAR CSV
            </Button>
          </Box>


        <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
          
          <Box mb={4}>
            <Grid container spacing={2} alignItems="center">
              {/* Data Início */}
              <Grid xs={12} sm={6} md={2.5}>
                <DatePicker 
                  label="Data início" 
                  value={startDate} 
                  onChange={(v) => handleManualDateChange(true, v)} 
                  slotProps={{ 
                    textField: { fullWidth: true, size: 'small' } 
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
                    textField: { fullWidth: true, size: 'small' } 
                  }} 
                />
              </Grid>
              
              {/* ToggleGroup e Botão Buscar - Agrupados e Otimizados */}
              <Grid xs={12} md={4} display="flex" gap={1}>
                <ToggleButtonGroup 
                  value={datePreset} 
                  exclusive 
                  onChange={handleDatePresetChange} 
                  size="small" 
                  sx={{ height: 40, flexGrow: 1 }} // flexGrow para ocupar espaço
                >
                  {/* Redução do padding/minWidth para compactar em telas pequenas */}
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
                  sx={{ height: 40, whiteSpace: 'nowrap', minWidth: '100px' }} // Altura e largura fixas
                >
                  BUSCAR
                </Button>
              </Grid>

              {/* Campo de Busca */}
              <Grid xs={12} sm={6} md={2}>
                <TextField 
                  fullWidth 
                  size="small" 
                  placeholder="Buscar por editor ou documento..." 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()} 
                  InputProps={{ 
                    startAdornment: <InputAdornment position="start"><Search /></InputAdornment> 
                  }} 
                />
              </Grid>
            </Grid>
          </Box>

          {/* ESTATÍSTICAS + GRÁFICOS + CARDS */}
          {!loading && (
            <>
              <Box mb={4}>
                <Typography variant="subtitle1" fontWeight="bold" align="center" color="primary" mb={2}>Estatísticas do Período</Typography>
                <Grid container spacing={2}>
                  <Grid xs={12} sm={4}><Card sx={{ bgcolor: '#e3f2fd' }}><CardContent><Box display="flex" alignItems="center" gap={2}><AccessTime color="primary" /><Box><Typography variant="h4" fontWeight="bold">{statsData.totalMinutes.toFixed(1)}</Typography><Typography variant="body2" color="text.secondary">Minutos no período</Typography></Box></Box></CardContent></Card></Grid>
                  <Grid xs={12} sm={4}><Card sx={{ bgcolor: '#f3e5f5' }}><CardContent><Box display="flex" alignItems="center" gap={2}><Person color="secondary" /><Box><Typography variant="h4" fontWeight="bold">{statsData.totalEditors}</Typography><Typography variant="body2" color="text.secondary">Editores no período</Typography></Box></Box></CardContent></Card></Grid>
                  <Grid xs={12} sm={4}><Card sx={{ bgcolor: '#fff3e0' }}><CardContent><Box display="flex" alignItems="center" gap={2}><InsertDriveFile color="warning" /><Box><Typography variant="h4" fontWeight="bold">{statsData.totalDocs}</Typography><Typography variant="body2" color="text.secondary">Documentos no período</Typography></Box></Box></CardContent></Card></Grid>
                </Grid>
              </Box>
              <StatsCharts editorPieData={editorPieData} eixosData={eixosData} />
            </>
          )}
          

          <Box mt={4}>
            {error && <Alert severity="error" sx={{ mb: 3 }}>Erro ao carregar dados.</Alert>}
            {loading ? (
              <Grid container spacing={3}>{[...Array(limit)].map((_, i) => (<Grid xs={12} sm={6} lg={4} key={i}><Card><CardContent><Skeleton height={150} /></CardContent></Card></Grid>))}</Grid>
            ) : data.length === 0 ? (
              <Box textAlign="center" py={8}><Typography variant="h6" color="text.secondary">{search ? 'Nenhum resultado para esta busca' : 'Nenhum dado encontrado para este período'}</Typography></Box>
            ) : (
              <Grid container spacing={3}>
                {data.map((item) => (
                  <Grid xs={12} sm={6} lg={4} key={`${item.documentId}-${item.editorName}`}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: '0.3s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 } }}>
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Box display="flex" justifyContent="space-between" mb={2}><Avatar sx={{ bgcolor: 'primary.main' }}><Person /></Avatar><Chip label={`${Number(item.totalMinutes).toFixed(1)} min`} size="small" color="primary" icon={<AccessTime />} /></Box>
                        <Typography variant="h6" fontWeight="bold" gutterBottom noWrap>{item.documentName}</Typography>
                        <Box display="flex" alignItems="center" gap={1} my={1} color="text.secondary"><Folder fontSize="small" /><Typography variant="body2" noWrap>{item.folderPath}</Typography></Box>
                        <Box display="flex" alignItems="center" gap={1} my={1}><Person fontSize="small" /><Typography variant="body2" fontWeight="medium">{item.editorName}</Typography></Box>
                        <Typography variant="caption" color="text.secondary">{formatDate(item.lastEdit)}</Typography>
                      </CardContent>
                      <CardActions>
                        <Button size="small" startIcon={<LinkIcon />} href={item.documentLink} target="_blank" fullWidth variant="outlined">Abrir no Drive</Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
            {!loading && totalCount > limit && (
              <Box display="flex" justifyContent="center" mt={4}>
                <Pagination count={pageCount} page={page} onChange={(_e, v) => setPage(v)} color="primary" />
              </Box>
            )}
          </Box>
        </Paper>
      </Container>
    </>
  );
}