import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, Typography, Box, Grid } from '@mui/material';
import { AccessTime, Person, FolderOpen, InsertDriveFile } from '@mui/icons-material';

interface Editor {
  editorName: string;
  totalMinutes: number;
  documentName: string;
}

interface StatsChartsProps {
  data: Editor[];
}

const COLORS = ['#1976d2', '#9c27b0', '#ff9800', '#4caf50', '#f44336', '#00bcd4'];

export default function StatsCharts({ data }: StatsChartsProps) {
  // MÉTRICAS
  const totalMinutes = data.reduce((sum, item) => sum + item.totalMinutes, 0);
  const totalEditors = new Set(data.map(d => d.editorName)).size;
  const totalDocs = new Set(data.map(d => d.documentName)).size;

  // GRÁFICO DE PIZZA: TEMPO POR EDITOR
  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(item => {
      map.set(item.editorName, (map.get(item.editorName) || 0) + item.totalMinutes);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(1)) }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  // GRÁFICO DE BARRAS: EDIÇÕES POR DOCUMENTO (TOP 6)
  const barData = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(item => {
      map.set(item.documentName, (map.get(item.documentName) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, count]) => ({
        name: name.length > 20 ? name.substring(0, 17) + '...' : name,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [data]);

  // LABEL PERSONALIZADO COM TIPAGEM CORRETA
  const renderCustomLabel = (props: any) => {
    const { name, percent } = props;
    if (percent < 0.05) return null; // Oculta rótulos pequenos
    return `${name}: ${(percent * 100).toFixed(0)}%`;
  };

  return (
    <Box mt={4}>
      <Typography variant="h6" fontWeight="bold" mb={3} color="primary">
        Gestão à Vista
      </Typography>

      <Grid container spacing={3}>
        {/* MÉTRICAS RÁPIDAS */}
        <Grid xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#e3f2fd', height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <AccessTime color="primary" />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {totalMinutes.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Minutos totais
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#f3e5f5', height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Person color="secondary" />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {totalEditors}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Editores
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#fff3e0', height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <InsertDriveFile color="warning" />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {totalDocs}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Documentos
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#e8f5e9', height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <FolderOpen color="success" />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {pieData.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Ativos hoje
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* GRÁFICO DE PIZZA */}
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                Tempo por Editor
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value} min`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* GRÁFICO DE BARRAS */}
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                Documentos Mais Editados
              </Typography>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#1976d2" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}