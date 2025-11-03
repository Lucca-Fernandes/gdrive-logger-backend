import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import StatsCharts from '../components/StatsCharts';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  InputAdornment,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Avatar,
  Tooltip,
  IconButton,
  Skeleton,
  Alert,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2'; 
import { Search, Download, Refresh, AccessTime, Person, Folder, Link as LinkIcon } from '@mui/icons-material';
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

  const API_URL = 'https://gdrive-logger-backend.onrender.com/api';

  const fetchData = async () => {
    setError(false);
    try {
      const res = await axios.get(`${API_URL}/data`, {
        params: { limit: 100 },
      });
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
        params: { editor: search || undefined },
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
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredData = useMemo(() => {
    if (!search) return data;
    return data.filter(
      (item) =>
        item.editorName.toLowerCase().includes(search.toLowerCase()) ||
        item.documentName.toLowerCase().includes(search.toLowerCase())
    );
  }, [data, search]);

  // FUNÇÃO SEGURA PARA FORMATAR DATA
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Data inválida';
    const date = new Date(dateStr);
    return isValid(date) ? format(date, "dd 'de' MMM 'às' HH:mm", { locale: ptBR }) : 'Data inválida';
  };

  return (
    <Container maxWidth="xl" sx={{ py: 2, mt: -8}}>

      
      <Box 
        display="flex" 
        justifyContent="center" 
        mb={0} // Adiciona uma margem abaixo do logo
      >
        <img 
          src="../../public/logo_NIC-PNG.png" // <-- MUDE ESTE CAMINHO
          alt="Logo da Empresa" 
          height={400} width={600} // Ajuste a altura conforme necessário
        />
      </Box>
      

      <Paper elevation={6} sx={{ borderRadius: 3, overflow: 'hidden', mt: -8 }}>
        {/* HEADER */}
        <Box p={4} bgcolor="primary.main" color="white">
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h4" fontWeight="bold">
              Monitor de Edição
            </Typography>
            <Box display="flex" gap={1}>
              <Tooltip title="Atualizar">
                <IconButton onClick={fetchData} color="inherit">
                  <Refresh />
                </IconButton>
              </Tooltip>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<Download />}
                onClick={exportCSV}
              >
                CSV
              </Button>
            </Box>
          </Box>
        </Box>

        {/* SEARCH */}
        <Box p={3} pb={2}>
          <TextField
            fullWidth
            placeholder="Buscar por editor ou documento..."
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
        {/* GRÁFICOS DE GESTÃO */}
        {!loading && filteredData.length > 0 && (
          <StatsCharts data={filteredData} />
        )}
        {/* CONTENT */}
        <Box p={3} pt={0} mt={6}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              Erro ao carregar dados. Tentando novamente...
            </Alert>
          )}

          {/* LOADING */}
          {loading ? (
            <Grid container spacing={3}>
              {[...Array(6)].map((_, i) => (
                <Grid xs={12} sm={6} lg={4} key={i}>
                  <Card>
                    <CardContent>
                      <Skeleton height={60} />
                      <Skeleton />
                      <Skeleton width="60%" />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : filteredData.length === 0 ? (
            <Box textAlign="center" py={8}>
              <Typography variant="h6" color="text.secondary">
                {search ? 'Nenhum resultado encontrado' : 'Nenhum documento editado ainda'}
              </Typography>
            </Box>
          ) : (
            /* DADOS REAIS */
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
                          label={`${item.totalMinutes.toFixed(1)} min`}
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

        {/* FOOTER */}
        <Box p={2} bgcolor="grey.100" textAlign="center">
          <Typography variant="caption" color="text.secondary">
            Atualizado em {new Date().toLocaleTimeString('pt-BR')}
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}