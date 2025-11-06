// src/components/StatsCharts.tsx
import { useMemo } from 'react'; 
import {
  BarChart, 
  PieChart, // Usado para o gráfico de distribuição (coluna da direita)
} from '@mui/x-charts';
import { Card, CardContent, Typography, Box } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';

// --- Interfaces (MANTIDAS) ---
interface EixoData {
  eixo: string;
  totalMinutes: number;
  [key: string]: any; 
}
interface EditorRanking {
  editorName: string; 
  total: number; 
  [key: string]: any; 
}
interface StatsChartsProps {
  editorPieData: EditorRanking[];
  eixosData: EixoData[]; 
  pieChartOnly?: boolean;
}
// --- Fim Interfaces ---

// Função para formatar o nome do Editor no eixo (usada no Pie Chart)
const formatEditorName = (name: string): string => {
    const parts = name.split(' ');
    // Mostra apenas o primeiro nome
    return parts[0]; 
};


export default function StatsCharts({ editorPieData, pieChartOnly = false }: StatsChartsProps) { 
  // O EixosData foi removido das dependências, mas mantido na interface para evitar erro no Dashboard.tsx

  // Prepara dados para o Bar Chart de Editores (Ranking)
  const editorBarChartData = useMemo(() => {
    const sortedData = editorPieData
      .map(item => ({
        name: item.editorName, 
        value: Number(item.total), // Valor em minutos
      }))
      // ORDENAÇÃO para gráfico VERTICAL: Decrescente (o maior vem primeiro, à esquerda)
      .sort((a, b) => b.value - a.value); 

    return { dataset: sortedData, editorNames: sortedData.map(item => item.name) };
  }, [editorPieData]);
  
  // Prepara dados para o PIE CHART (Editores)
  const editorPieChartData = useMemo(() => {
    return editorPieData.map((item, index) => ({
        id: index,
        value: Number(item.total),
        label: formatEditorName(item.editorName),
    }));
  }, [editorPieData]);

  // Value Formatter
  const valueFormatter = (value: number | null): string => 
    value !== null ? `${value.toFixed(1)} min` : '0 min'; 

  const editorSeries = [
      { 
        dataKey: 'value', 
        label: 'Minutos', 
        color: '#9c27b0', // Roxo
        valueFormatter: valueFormatter,
      },
  ];

  // ==========================================================
  // LÓGICA DE RENDERIZAÇÃO CONDICIONAL
  // ==========================================================
  
  // 1. RENDERIZA APENAS O GRÁFICO DE PIZZA (para a coluna da direita)
  if (pieChartOnly) {
      const totalMinutes = editorPieData.reduce((acc, curr) => acc + curr.total, 0);

      return (
          <Box sx={{ height: '100%', minHeight: 300, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <PieChart
                  series={[
                      {
                          data: editorPieChartData,
                          innerRadius: 80, // Cria o efeito Donut
                          outerRadius: 120,
                          paddingAngle: 3,
                          cornerRadius: 5,
                          startAngle: -90,
                          endAngle: 270,
                      },
                  ]}
                  width={300}
                  height={300}
                  slotProps={{
                  }}
              />
              <Box sx={{ mt: 2, width: '100%', maxWidth: 300 }}>
                  {/* SIMULAÇÃO DE LEGENDA ABAIXO DO GRÁFICO */}
                  {editorPieChartData.map((item, index) => (
                      <Box key={item.id} display="flex" alignItems="center" justifyContent="space-between" py={0.5}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Box sx={{ 
                                width: 10, height: 10, borderRadius: '50%', 
                                bgcolor: `hsl(${(index * 360 / editorPieChartData.length) % 360}, 70%, 50%)` 
                            }} /> 
                            <Typography variant="body2">{item.label}</Typography>
                          </Box>
                          <Typography variant="body2" fontWeight="bold">{(item.value / totalMinutes * 100).toFixed(1)}%</Typography>
                      </Box>
                  ))}
              </Box>
          </Box>
      );
  }

  // 2. RENDERIZA APENAS O GRÁFICO DE RANKING (o único gráfico principal restante)
  return (
    <Box mt={4} px={3}> 
      <Grid container spacing={3}>
        
        {/* GRÁFICO DE BARRAS (Ranking de Produtividade) - AGORA EM LARGURA TOTAL (md=12) */}
        <Grid xs={12} md={12}>
          <Card elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                Ranking de Produtividade por Editor
              </Typography>
              <Box sx={{ height: 450, width: '100%' }}> {/* Aumentei a altura para 450 */}
                <BarChart
                    dataset={editorBarChartData.dataset}
                    xAxis={[{ 
                        scaleType: 'band', 
                        data: editorBarChartData.editorNames,
                        dataKey: 'name', 
                        // Mostra o nome completo para melhor identificação
                        valueFormatter: (value: string) => value, 
                        tickLabelStyle: { 
                            fontSize: 10, // Diminui a fonte
                            angle: -45, 
                            textAnchor: 'end',
                        },
                    }]}
                    yAxis={[{ 
                        scaleType: 'linear',
                        label: 'Minutos',
                        tickLabelStyle: { fontSize: 10 }
                    }]}
                    series={editorSeries}
                    layout="vertical"
                    margin={{ top: 20, right: 20, bottom: 100, left: 40 }} // Aumentei a margem inferior
                    slotProps={{
                        bar: {
                            rx: 5,
                            ry: 5,
                        },
                    }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* O GRÁFICO DE EIXOS FOI REMOVIDO DAQUI */}

      </Grid>
    </Box>
  );
}