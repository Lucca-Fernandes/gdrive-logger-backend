// src/components/StatsCharts.tsx
import { useMemo } from 'react'; 
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Card, CardContent, Typography, Box } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
// REMOVIDOS AccessTime, Person, InsertDriveFile pois não são mais usados neste arquivo.

// --- Interfaces ---
interface EixoData {
  eixo: string;
  totalMinutes: number;
}
interface EditorRanking {
  editorName: string; // Vem como 'editorName' do backend (/ranking)
  total: number;      // Vem como 'total' do backend (/ranking)
}


// Define as props que o componente espera
interface StatsChartsProps {
  // statsData: StatsData; // REMOVIDO: Não é mais necessário, pois os cards não estão aqui.
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
  const { name, percent } = props;
  if (percent < 0.05) return null; 
  return `${name}: ${(percent * 100).toFixed(0)}%`;
};

// 🌟 CORREÇÃO: Removida a prop 'statsData' das chaves do objeto, pois não é mais usada.
export default function StatsCharts({ editorPieData, eixosData }: StatsChartsProps) {

  // Converte { editorName, total } para { name, value }
  const pieChartData = useMemo(() => {
    return editorPieData.map(item => ({
      name: item.editorName,       
      value: Number(item.total)  
    }));
  }, [editorPieData]);

  return (
    <Box mt={4} px={3}> 
      {/* Título foi mantido, mas removi o título "Estatísticas do Período" pois ele já está no Dashboard */}
      
      <Grid container spacing={3}>
        
        {/* OS 3 CARDS DE MÉTRICAS RÁPIDAS FORAM REMOVIDOS DAQUI */}

        {/* ========================================================== */}
        {/* GRÁFICO DE PIZZA (Permanece) */}
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
                    data={pieChartData} 
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value" 
                    nameKey="name" 
                  >
                    {pieChartData.map((_, index) => ( 
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

        {/* GRÁFICO DE EIXOS (Permanece) */}
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