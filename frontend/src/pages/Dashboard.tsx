// src/pages/Dashboard.tsx
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import StatsCharts from '../components/StatsCharts';
import {
  Container, Paper, Typography, Box, TextField, InputAdornment,
  Button, Card, CardContent, CardActions, Chip, Avatar,
  Skeleton, Alert,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import { Search, Download, Refresh, AccessTime, Person, Folder, Link as LinkIcon } from '@mui/icons-material';
// Imports de Data
import { format, isValid, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DatePicker } from '@mui/x-date-pickers/DatePicker'; // <-- NOVO

interface Editor {
  documentId: string;
  documentName: string;
  documentLink: string;
  folderPath: string;
  editorName: string;
  totalMinutes: number;
  lastEdit: string | null;
}

export default function Dashboard() {
  const [data, setData] = useState<Editor[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);


  const [startDate, setStartDate] = useState<Date | null>(startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date | null>(endOfDay(new Date()));
  // ==========================================================

  const API_URL = 'https://gdrive-logger-backend.onrender.com/api';

  const fetchData = async () => {
    if (!startDate || !endDate) {
      setData([]);
      setLoading(false);
      return;
    }

    setError(false);
    setLoading(true); 
    try {
      const params: any = {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };

      const res = await axios.get(`${API_URL}/data`, { params });
      setData(res.data.data);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => {
    try {
      const res = await axios.get(`${API_URL}/export`, {
        responseType: 'blob',
        params: {
          editor: search || undefined,
          startDate: startDate ? startDate.toISOString() : undefined,
          endDate: endDate ? endDate.toISOString() : undefined,
        },
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio_${new Date().toISOString().split('T')[0]}.csv`);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
    }
  };


  useEffect(() => {
    
    fetchData();
  }, []); 

 

  const filteredData = useMemo(() => {
    
    if (!search) return data;
    return data.filter(
      (item) =>
        item.editorName.toLowerCase().includes(search.toLowerCase()) ||
        item.documentName.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Data inválida';
    const date = new Date(dateStr);
    return isValid(date) ? format(date, "dd 'de' MMM 'às' HH:mm", { locale: ptBR }) : 'Data inválida';
  };

  
  const handleClearDates = () => {
    setStartDate(null);
    setEndDate(null);
  };

  const handleFilter = () => {
    fetchData();
  };

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

        <Box p={3} pb={2}>
          <Grid container spacing={2} alignItems="center">
            <Grid xs={12} md={3}>
              <DatePicker
                label="Data Início"
                value={startDate}
                onChange={(newValue) => setStartDate(newValue ? startOfDay(newValue) : null)}
                slotProps={{ textField: { fullWidth: true, margin: 'none' } }}
              />
            </Grid>
            <Grid xs={12} md={3}>
              <DatePicker
                label="Data Fim"
                value={endDate}
                onChange={(newValue) => setEndDate(newValue ? endOfDay(newValue) : null)}
                slotProps={{ textField: { fullWidth: true, margin: 'none' } }}
              />
            </Grid>
            <Grid xs={12} md={2}>
              <Button
                onClick={handleClearDates}
                variant="outlined"
                fullWidth
                sx={{ height: '56px' }}
              >
                Limpar Datas
              </Button>
            </Grid>
            <Grid xs={12} md={4}>
              <Button
                onClick={handleFilter}
                variant="contained"
                fullWidth
                startIcon={<Refresh />}
                sx={{ height: '56px' }}
              >
                Buscar Período
              </Button>
            </Grid>
          </Grid>
        </Box>

        <Box p={3} pt={0}>
          <TextField
            fullWidth
            placeholder="Filtrar resultado atual por editor ou documento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            variant="outlined"
          />
        </Box>
        
        {!loading && filteredData.length > 0 && (
          <StatsCharts data={filteredData} />
        )}

        <Box p={3} pt={0} mt={6}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              Erro ao carregar dados. Verifique a conexão.
            </Alert>
          )}

          {loading ? (
            /* Esqueleto de loading */
            <Grid container spacing={3}>
              {[...Array(6)].map((_, i) => (
                <Grid xs={12} sm={6} lg={4} key={i}>
                  <Card><CardContent><Skeleton height={60} /></CardContent></Card>
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
            /* DADOS REAIS (filtrados) */
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
        </Box>

      </Paper>
    </Container>
  );
}