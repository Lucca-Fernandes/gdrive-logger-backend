// src/components/AnaliseCargos.tsx
import {
  Box, Typography, Card, CardContent, CardActions, Button, Chip, Avatar,
  Alert, Skeleton, Pagination, LinearProgress
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import { Person, AccessTime, Folder, Link as LinkIcon, ArrowBack } from '@mui/icons-material';
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import CargoPieChart from './CargoPieChart';

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
interface EditorSummary {
  editorName: string;
  totalMinutes: number;
  totalDocuments: number;
  lastEdit: string | null;
}
interface CargoSummary {
  cargoName: string;
  totalMinutes: number;
  totalEditors: number;
  lastEdit: string | null;
}

interface AnaliseCargosProps {
  data: Editor[];
  loading: boolean;
  error: boolean;
  totalCount: number;
  limit: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  fetchData: () => void;

  selectedCargo: string | undefined;
  selectedEditor: string | undefined;
  editorsSummary: EditorSummary[];
  cargosSummary: CargoSummary[];

  onCargoSelect: (cargoName: string) => void;
  onEditorSelect: (editorName: string) => void;
  onBackToEditors: () => void;
  onBackToCargos: () => void;
}

const safeNumber = (value: any): number => parseFloat(value as string) || 0;
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return 'Nunca';
  const date = new Date(dateStr);
  return isValid(date) ? format(date, "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'Inválido';
};
const minutesToHours = (minutes: number) => (minutes / 60).toFixed(2);

export default function AnaliseCargos({
  data,
  loading,
  error,
  totalCount,
  limit,
  currentPage,
  onPageChange,
  fetchData,
  selectedCargo,
  selectedEditor,
  editorsSummary,
  cargosSummary,
  onCargoSelect,
  onEditorSelect,
  onBackToEditors,
  onBackToCargos,
}: AnaliseCargosProps) {

  const pageCount = Math.ceil(totalCount / limit);

  const handlePaginationChange = (page: number) => {
    onPageChange(page);
    fetchData();
  };

  // === DADOS CORRETOS PARA CADA NÍVEL ===
  const aggregatedCargos: CargoSummary[] = selectedCargo || selectedEditor ? [] : cargosSummary;

  // AQUI ESTAVA O BUG: editorsSummary já vem do backend certinho!
  const aggregatedEditors: EditorSummary[] = selectedCargo ? editorsSummary : [];

  // === RENDER DOCUMENTOS (NÍVEL 3) ===
  const renderDocumentList = () => (
    <>
      <Button onClick={onBackToEditors} variant="outlined" size="small" startIcon={<ArrowBack />} sx={{ mb: 3 }}>
        Voltar para Editores ({selectedCargo})
      </Button>

      <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
        Documentos Editados por: <span style={{ color: '#1976d2' }}>{selectedEditor}</span>
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>Erro ao carregar dados.</Alert>}

      {loading ? (
        <Grid container spacing={3}>
          {[...Array(limit)].map((_, i) => (
            <Grid xs={12} sm={6} lg={4} key={i}>
              <Card><CardContent><Skeleton height={150} /></CardContent></Card>
            </Grid>
          ))}
        </Grid>
      ) : data.length === 0 ? (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary">
            Nenhum documento encontrado para {selectedEditor}.
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {data.map((item) => (
            <Grid xs={12} sm={6} lg={4} key={`${item.documentId}-${item.editorName}`}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: '0.3s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 } }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box display="flex" justifyContent="space-between" mb={2}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>{item.editorName.charAt(0).toUpperCase()}</Avatar>
                    <Chip label={`${safeNumber(item.totalMinutes).toFixed(1)} min`} size="small" color="primary" icon={<AccessTime />} />
                  </Box>
                  <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.documentName}
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1} my={1} color="text.secondary">
                    <Folder fontSize="small" />
                    <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.folderPath}
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1} my={1}>
                    <Person fontSize="small" />
                    <Typography variant="body2" fontWeight="medium">{item.editorName}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary">{formatDate(item.lastEdit)}</Typography>
                </CardContent>
                <CardActions>
                  <Button size="small" startIcon={<LinkIcon />} href={item.documentLink} target="_blank" fullWidth variant="outlined">
                    Abrir no Drive
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {!loading && totalCount > limit && (
        <Box display="flex" justifyContent="center" mt={4}>
          <Pagination count={pageCount} page={currentPage} onChange={(_e, v) => handlePaginationChange(v)} color="primary" />
        </Box>
      )}
    </>
  );

  // === RENDER EDITORES (NÍVEL 2) ===
  const renderEditorList = () => (
    <>
      <Button onClick={onBackToCargos} variant="outlined" size="small" startIcon={<ArrowBack />} sx={{ mb: 3 }}>
        Voltar para Cargos
      </Button>

      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
        Editores em: <span style={{ color: '#1976d2' }}>{selectedCargo}</span>
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" mb={4}>
        Selecione um editor para ver seus documentos.
      </Typography>

      {loading && <LinearProgress sx={{ my: 2 }} />}

      {aggregatedEditors.length === 0 && !loading ? (
        <Alert severity="info" sx={{ my: 2 }}>
          Nenhum editor encontrado no cargo "{selectedCargo}" com atividades no período.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {aggregatedEditors.map((editor: EditorSummary) => {
            const hasActivity = editor.totalMinutes > 0;
            return (
              <Grid xs={12} sm={6} md={3} key={editor.editorName}>
                <Card
                  onClick={() => onEditorSelect(editor.editorName)}
                  sx={{
                    cursor: 'pointer',
                    p: 2,
                    textAlign: 'center',
                    height: '100%',
                    transition: '0.2s',
                    '&:hover': { bgcolor: 'primary.light', boxShadow: 3 },
                  }}
                >
                  <Avatar sx={{ bgcolor: hasActivity ? 'success.main' : 'error.main', mx: 'auto', mb: 1.5 }}>
                    <Person />
                  </Avatar>
                  <Typography variant="body1" fontWeight="bold" mt={1}>
                    {editor.editorName}
                  </Typography>
                  <Box mt={1}>
                    <Chip
                      label={`${editor.totalMinutes.toFixed(1)} min`}
                      size="small"
                      color={hasActivity ? 'success' : 'default'}
                      icon={<AccessTime />}
                      sx={{ mb: 0.5 }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {editor.totalDocuments} documento{editor.totalDocuments !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </>
  );

  const renderCargoList = () => (
    <>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: "bold" }}>
        Análise de Produtividade por Cargo
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" mb={4}>
        Selecione um cargo para visualizar os editores e seus documentos.
      </Typography>

      {loading && <LinearProgress sx={{ my: 2 }} />}

      {aggregatedCargos.length === 0 && !loading ? (
        <Alert severity="info" sx={{ my: 2 }}>
          Nenhuma atividade encontrada para os cargos mapeados no período selecionado.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {/* ---------- ESQUERDA – CARDS COM TAMANHO FIXO ---------- */}
          <Grid xs={12} md={6}>
            <Box
              sx={{
                display: "grid",
                gap: 3,
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                // garante que a grade não ultrapasse a metade da tela
                maxWidth: "100%",
              }}
            >
              {aggregatedCargos
                .filter((c) => c.cargoName !== "Cargo Não Mapeado")
                .map((cargo) => {
                  const hasActivity = cargo.totalMinutes > 0;
                  return (
                    <Card
                      key={cargo.cargoName}
                      onClick={() => onCargoSelect(cargo.cargoName)}
                      sx={{
                        cursor: "pointer",
                        p: 3,
                        textAlign: "center",
                        height: 160,               // ALTURA FIXA
                        transition: "0.2s",
                        "&:hover": { bgcolor: "primary.light", boxShadow: 3 },
                      }}
                    >
                      <Folder
                        fontSize="large"
                        color={hasActivity ? "primary" : "disabled"}
                      />
                      <Typography variant="h6" mt={1} noWrap>
                        {cargo.cargoName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {cargo.totalEditors} Editores
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        color={hasActivity ? "success.main" : "error.main"}
                        mt={1}
                      >
                        {minutesToHours(cargo.totalMinutes)} horas
                      </Typography>
                    </Card>
                  );
                })}
            </Box>
          </Grid>

          {/* DIREITA: Gráfico de Pizza */}
          <Grid xs={12} md={6}>
            <Card sx={{ height: '100%', minHeight: 420, p: 2, boxShadow: 3, borderRadius: 3 }}>
              <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom textAlign="center">
                  Distribuição por Cargo
                </Typography>
                <Box sx={{ flexGrow: 1, minHeight: 0 }}>
                  <CargoPieChart cargosSummary={cargosSummary} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </>
  );

  return (
    <Box mt={4}>
      {selectedEditor ? renderDocumentList() : selectedCargo ? renderEditorList() : renderCargoList()}
    </Box>
  );
}