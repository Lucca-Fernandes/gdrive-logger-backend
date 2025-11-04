// src/components/StatsCharts.tsx
import { useMemo } from 'react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Card, CardContent, Typography, Box } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import { AccessTime, Person, InsertDriveFile } from '@mui/icons-material';

// Interfaces
interface EditorData {
  editorName: string;
  totalMinutes: number;
  documentName: string;
}
interface EixoData {
  eixo: string;
  totalMinutes: number;
}
interface StatsChartsProps {
  data: EditorData[];
  eixosData: EixoData[]; // <-- NOVA PROP
}

const COLORS = ['#1976d2', '#9c27b0', '#ff9800', '#4caf50', '#f44336', '#00bcd4'];

// Função para encurtar nomes de eixos no gráfico
const formatEixoName = (name: string) => {
  if (name.length > 20) {
    return name.substring(0, 17) + '...';
  }
  return name;
};

export default function StatsCharts({ data, eixosData }: StatsChartsProps) {
  // MÉTRICAS (calculadas a partir dos dados dos cards)
  const totalMinutes = data.reduce((sum, item) => sum + Number(item.totalMinutes), 0);
  const totalEditors = new Set(data.map(d => d.editorName)).size;
  const totalDocs = new Set(data.map(d => d.documentName)).size;

  // GRÁFICO DE PIZZA: TEMPO POR EDITOR (Nenhuma mudança aqui)
  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    data.forEach(item => {
      map.set(item.editorName, (map.get(item.editorName) || 0) + Number(item.totalMinutes));
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Number(value.toFixed(1)) }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  // LABEL PERSONALIZADO (Nenhuma mudança aqui)
  const renderCustomLabel = (props: any) => {
    const { name, percent } = props;
    if (percent < 0.05) return null; 
    return `${name}: ${(percent * 100).toFixed(0)}%`;
  };

  return (
    <Box mt={4} px={3}> 
      <Typography variant="h6" fontWeight="bold" mb={3} align="center" color="primary">
        Monitoramento de Produtividade
      </Typography>

      <Grid container spacing={3}>
        {/* MÉTRICAS RÁPIDAS (Nenhuma mudança aqui) */}
        <Grid xs={12} sm={6} md={4}>
          <Card sx={{ bgcolor: '#e3f2fd', height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <AccessTime color="primary" />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {totalMinutes.toFixed(1)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Minutos no período
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={4}>
          <Card sx={{ bgcolor: '#f3e5f5', height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <Person color="secondary" />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {totalEditors}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Editores no período
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid xs={12} sm={6} md={4}>
          <Card sx={{ bgcolor: '#fff3e0', height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <InsertDriveFile color="warning" />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {totalDocs}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Documentos no período
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* GRÁFICO DE PIZZA (Nenhuma mudança aqui) */}
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                Tempo por Editor
              </Typography>
              <ResponsiveContainer width="100%" height={380}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${value} min`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* ========================================================== */}
        {/* NOVO GRÁFICO: TEMPO POR EIXO */}
        {/* ========================================================== */}
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                Tempo por Eixo
              </Typography>
              <ResponsiveContainer width="100%" height={380}>
                <BarChart data={eixosData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis 
                    dataKey="eixo" 
                    type="category" 
                    width={150} // Aumenta o espaço para o label
                    tickFormatter={formatEixoName}
                  />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)} min`} />
                  <Legend />
                  <Bar dataKey="totalMinutes" name="Minutos" fill="#1976d2" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}