// src/pages/Dashboard.tsx
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import StatsCharts from '../components/StatsCharts';
import {
  Container, Paper, Typography, Box, TextField, InputAdornment,
  Button, Card, CardContent, CardActions, Chip, Avatar,
  Skeleton, Alert, Pagination, 
  ToggleButton, ToggleButtonGroup
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2'; 
import { Search, Download, Refresh, AccessTime, Person, Folder, Link as LinkIcon } from '@mui/icons-material';
import { 
  format, isValid, 
  startOfDay, endOfDay, 
  startOfWeek, endOfWeek, 
  startOfMonth, endOfMonth 
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// Interfaces
interface Editor {
  documentId: string;
  documentName: string;
  documentLink: string;
  folderPath: string;
  editorName: string;
  totalMinutes: number;
  lastEdit: string | null; 
}
// ==========================================================
// NOVA INTERFACE PARA OS EIXOS
// ==========================================================
interface EixoSummary {
  eixo: string;
  totalMinutes: number;
}

type DatePreset = 'hoje' | 'semana' | 'mes' | 'custom';

export default function Dashboard() {
  const [data, setData] = useState<Editor[]>([]);
  // ==========================================================
  // NOVO ESTADO PARA OS EIXOS
  // ==========================================================
  const [eixosData, setEixosData] = useState<EixoSummary[]>([]);
  
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

  // ==========================================================
  // FETCHDATA MODIFICADO
  // Busca dados dos cards e dados dos eixos em paralelo
  // ==========================================================
  const fetchData = async (currentPage = 1) => {
    if (!startDate || !endDate) {
      setData([]);
      setEixosData([]); // Limpa dados dos eixos
      setTotalCount(0);
      setLoading(false);
      return;
    }
    
    setError(false);
    setLoading(true);
    try {
      // Parâmetros para ambas as requisições
      const params = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      // Parâmetros para a paginação (apenas para /data)
      const dataParams = {
        ...params,
        page: currentPage,
        limit: limit,
      };

      // Busca os dois endpoints em paralelo
      const [dataRes, eixosRes] = await Promise.all([
        axios.get(`${API_URL}/data`, { params: dataParams }),
        axios.get(`${API_URL}/eixos-summary`, { params })
      ]);

      setData(dataRes.data.data);
      setTotalCount(dataRes.data.total); 
      setPage(currentPage); 
      
      setEixosData(eixosRes.data); // <-- SALVA OS DADOS DOS EIXOS

    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => { /* ... (seu código de exportação) ... */ };

  useEffect(() => {
    fetchData(page);
  }, [startDate, endDate, page]); 

  // Handlers de data (handleDatePresetChange, handleManualDateChange)
  // ... (Nenhuma mudança necessária aqui) ...
  const handleDatePresetChange = (
    _event: React.MouseEvent<HTMLElement>,
    newPreset: DatePreset | null,
  ) => {
    if (newPreset === null) return; 
    setDatePreset(newPreset);
    setPage(1); 
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
    setDatePreset('custom'); 
    setPage(1);
    if (isStart) {
      setStartDate(newValue ? startOfDay(newValue) : null);
    } else {
      setEndDate(newValue ? endOfDay(newValue) : null);
    }
  };


  const formatDate = (dateStr: string | null) => { /* ... (sem mudanças) ... */ 
    if (!dateStr) return 'Data inválida';
    const date = new Date(dateStr);
    return isValid(date) ? format(date, "dd 'de' MMM 'às' HH:mm", { locale: ptBR }) : 'Data inválida';
  };
  
  const filteredData = useMemo(() => {
    if (!search) return data;
    return data.filter(
      (item) =>
        item.editorName.toLowerCase().includes(search.toLowerCase()) ||
        item.documentName.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  const pageCount = Math.ceil(totalCount / limit);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* --- LOGO --- */}
      <Box display="flex" justifyContent="center" mb={0}>
        <img src="../../public/logo_NIC-PNG.png" alt="Logo da Empresa" height={350} width={500} />
      </Box>

      <Paper elevation={6} sx={{ borderRadius: 3, overflow: 'hidden', mt: -8 }}>
        {/* --- HEADER --- */}
        <Box p={4} bgcolor="primary.main" color="white">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h4" fontWeight="bold">
              Monitor de Edição
            </Typography>
            <Box display="flex" gap={1}>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<Download />}
                onClick={exportCSV}
              >
                Exportar CSV
              </Button>
            </Box>
          </Box>
        </Box>
        
        {/* --- FILTROS RÁPIDOS --- */}
        <Box p={3} pb={2} display="flex" justifyContent="center" flexWrap="wrap" gap={2}>
          <ToggleButtonGroup
            value={datePreset}
            exclusive
            onChange={handleDatePresetChange}
            color="primary"
          >
            <ToggleButton value="hoje">Hoje</ToggleButton>
            <ToggleButton value="semana">Esta Semana</ToggleButton>
            <ToggleButton value="mes">Este Mês</ToggleButton>
            <ToggleButton value="custom">Período</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        
        {/* --- FILTROS MANUAIS E BUSCA --- */}
        <Box p={3} pt={0}>
          <Grid container spacing={2} alignItems="center">
            <Grid xs={12} sm={6} md={3}>
              <DatePicker
                label="Data Início"
                value={startDate}
                onChange={(newValue) => handleManualDateChange(true, newValue)}
                slotProps={{ textField: { fullWidth: true, margin: 'none' } }}
                disabled={datePreset !== 'custom'}
              />
            </Grid>
            <Grid xs={12} sm={6} md={3}>
              <DatePicker
                label="Data Fim"
                value={endDate}
                onChange={(newValue) => handleManualDateChange(false, newValue)}
                slotProps={{ textField: { fullWidth: true, margin: 'none' } }}
                disabled={datePreset !== 'custom'}
              />
            </Grid>
            <Grid xs={12} sm={6} md={2}>
                <Button 
                  onClick={() => fetchData(1)}
                  variant="contained" 
                  fullWidth 
                  startIcon={<Refresh />}
                  sx={{ height: '56px' }}
                >
                  Buscar
                </Button>
            </Grid>
            <Grid xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                placeholder="Filtrar resultado por editor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  startAdornment: ( <InputAdornment position="start"><Search /></InputAdornment> ),
                }}
                variant="outlined"
              />
            </Grid>
          </Grid>
        </Box>
        
        {/* ========================================================== */}
        {/* GRÁFICOS DE GESTÃO - CORREÇÃO (linha 246) */}
        {/* Agora passa a prop 'eixosData' que estava faltando */}
        {/* ========================================================== */}
        {!loading && (filteredData.length > 0 || eixosData.length > 0) && (
          <StatsCharts data={filteredData} eixosData={eixosData} />
        )}

        {/* --- CONTENT (Cards) --- */}
        <Box p={3} pt={0} mt={6}>
          {error && ( 
            <Alert severity="error" sx={{ mb: 3 }}>
              Erro ao carregar dados. Verifique a conexão.
            </Alert>
          )}
          {loading ? (
            /* ... (Esqueleto de loading) ... */
            <Grid container spacing={3}>
              {[...Array(limit)].map((_, i) => (
                <Grid xs={12} sm={6} lg={4} key={i}>
                  <Card><CardContent><Skeleton height={150} /></CardContent></Card>
                </Grid>
              ))}
            </Grid>
          ) : filteredData.length === 0 ? (
            <Box textAlign="center" py={8}>
              <Typography variant="h6" color="text.secondary">
                {search ? 'Nenhum resultado para esta busca' : 'Nenhum dado encontrado para este período'}
              </Typography>
            </Box>
          ) : (
            /* DADOS REAIS (filtrados e paginados) */
            <Grid container spacing={3}>
              {filteredData.map((item) => (
                <Grid xs={12} sm={6} lg={4} key={`${item.documentId}-${item.editorName}`}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: '0.3s',
                      '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box display="flex" justifyContent="space-between" mb={2}>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          <Person />
                        </Avatar>
                        <Chip
                          label={`${Number(item.totalMinutes).toFixed(1)} min`}
                          size="small"
                          color="primary"
                          icon={<AccessTime />}
                        />
                      </Box>
                      <Typography variant="h6" fontWeight="bold" gutterBottom noWrap>
                        {item.documentName}
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1} my={1} color="text.secondary">
                        <Folder fontSize="small" />
                        <Typography variant="body2" noWrap>
                          {item.folderPath}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gap={1} my={1}>
                        <Person fontSize="small" />
                        <Typography variant="body2" fontWeight="medium">
                          {item.editorName}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(item.lastEdit)}
                      </Typography>
                    </CardContent>
                    <CardActions>
                      <Button
                        size="small"
                        startIcon={<LinkIcon />}
                        href={item.documentLink}
                        target="_blank"
                        fullWidth
                        variant="outlined"
                      >
                        Abrir no Drive
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {/* --- PAGINAÇÃO --- */}
          {!loading && totalCount > limit && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination 
                count={pageCount}
                page={page}
                onChange={(_event, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}
        </Box>

      </Paper>
    </Container>
  );
}