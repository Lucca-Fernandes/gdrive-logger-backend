// src/components/StatsCharts.tsx
import { useMemo } from 'react';
import { BarChart } from '@mui/x-charts';
import { Card, CardContent, Typography, Box } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';

interface EditorRanking {
  editorName: string;
  total: number;
}
interface CargoSummary {
  cargoName: string;
  totalMinutes: number;
  totalEditors: number;
}

interface StatsChartsProps {
  editorPieData: EditorRanking[];
  cargosSummary: CargoSummary[];
  showCargoDistribution?: boolean;
}

export default function StatsCharts({
  editorPieData,
  showCargoDistribution = true,
}: StatsChartsProps) {

  const editorBarChartData = useMemo(() => {
    const sorted = editorPieData
      .map(item => ({ name: item.editorName, value: Number(item.total) }))
      .sort((a, b) => b.value - a.value);
    return { dataset: sorted, editorNames: sorted.map(i => i.name) };
  }, [editorPieData]);

  const series = [{
    dataKey: 'value',
    label: 'Minutos',
    color: '#9c27b0',
    valueFormatter: (v: number | null) => v ? `${v.toFixed(1)} min` : '0 min',
  }];

  return (
    <Box mt={4} px={3}>
      <Grid container spacing={4} alignItems="flex-start">
        <Grid xs={12} md={showCargoDistribution ? 8 : 12}>
          <Card elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" mb={2}>
                Ranking de Produtividade por Editor
              </Typography>
              <Box sx={{ height: 420 }}>
                <BarChart
                  dataset={editorBarChartData.dataset}
                  xAxis={[{
                    scaleType: 'band',
                    dataKey: 'name',
                    tickLabelStyle: { angle: -45, textAnchor: 'end', fontSize: 11 },
                  }]}
                  yAxis={[{ label: 'Minutos' }]}
                  series={series}
                  layout="vertical"
                  margin={{ top: 20, right: 30, bottom: 100, left: 60 }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}