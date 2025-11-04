// src/components/StatsCharts.tsx
import { useMemo } from 'react'; // <-- 1. IMPORTE useMemo
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Card, CardContent, Typography, Box } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import { AccessTime, Person, InsertDriveFile } from '@mui/icons-material';

// --- Interfaces ---
interface EixoData {
  eixo: string;
  totalMinutes: number;
}
interface EditorRanking {
  editorName: string; // Vem como 'editorName' do backend (/ranking)
  total: number;      // Vem como 'total' do backend (/ranking)
}
interface StatsData {
  totalMinutes: number;
  totalEditors: number;
  totalDocs: number;
}
// Define as props que o componente espera
interface StatsChartsProps {
  statsData: StatsData;
  editorPieData: EditorRanking[];
  eixosData: EixoData[]; 
}
// --- Fim Interfaces ---

const COLORS = ['#1976d2', '#9c27b0', '#ff9800', '#4caf50', '#f44336', '#00bcd4'];

// Função para encurtar nomes de eixos no gráfico
const formatEixoName = (name: string) => {
  if (name.length > 20) {
    return name.substring(0, 17) + '...';
  }
  return name;
};

// Label personalizado para o Gráfico de Pizza
const renderCustomLabel = (props: any) => {
  const { name, percent } = props; // Esta função espera 'name'
  if (percent < 0.05) return null; 
  return `${name}: ${(percent * 100).toFixed(0)}%`;
};

export default function StatsCharts({ statsData, editorPieData, eixosData }: StatsChartsProps) {

  // ==========================================================
  // 2. CRIE A VARIÁVEL TRANSFORMADA
  // Converte { editorName, total } para { name, value }
  // ==========================================================
  const pieChartData = useMemo(() => {
    return editorPieData.map(item => ({
      name: item.editorName,       // Converte 'editorName' para 'name'
      value: Number(item.total)  // Converte 'total' para 'value'
    }));
  }, [editorPieData]);
  // ==========================================================

  return (
    <Box mt={4} px={3}> 
      <Typography variant="h6" fontWeight="bold" mb={3} align="center" color="primary">
        Estatísticas do Período
      </Typography>

      <Grid container spacing={3}>
        {/* MÉTRICAS RÁPIDAS (Usando a prop 'statsData') */}
        <Grid xs={12} sm={6} md={4}>
          <Card sx={{ bgcolor: '#e3f2fd', height: '100%' }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <AccessTime color="primary" />
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {statsData.totalMinutes.toFixed(1)}
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
                    {statsData.totalEditors}
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
                    {statsData.totalDocs}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Documentos no período
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* ========================================================== */}
        {/* GRÁFICO DE PIZZA (Atualizado para usar os dados transformados) */}
        {/* ========================================================== */}
        <Grid xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                Tempo por Editor
              </Typography>
              <ResponsiveContainer width="100%" height={380}>
                <PieChart>
                  <Pie
                    data={pieChartData} // <-- 3. USA A NOVA VARIÁVEL
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value" // <-- 4. USA A CHAVE PADRÃO 'value'
                    nameKey="name"  // <-- 5. USA A CHAVE PADRÃO 'name'
                  >
                    {pieChartData.map((_, index) => ( // <-- 6. USA A NOVA VARIÁVEL
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)} min`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* GRÁFICO DE EIXOS (Usando a prop 'eixosData') */}
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
                    width={150} 
                    tickFormatter={formatEixoName}
                  />
                  <Tooltip formatter={(value: number) => `${Number(value).toFixed(1)} min`} />
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