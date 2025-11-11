// src/components/CargoPieChart.tsx
import { PieChart } from '@mui/x-charts';
import { Box, Typography, Card, CardContent } from '@mui/material';

interface CargoSummary {
  cargoName: string;
  totalMinutes: number;
}

interface CargoPieChartProps {
  cargosSummary: CargoSummary[];
}

const cargoColors = [
  '#1976d2', '#388e3c', '#f57c00', '#d32f2f', '#7b1fa2',
  '#689f38', '#0288d1', '#c2185b', '#512da8', '#00796b'
];

export default function CargoPieChart({ cargosSummary }: CargoPieChartProps) {
  const totalMinutes = cargosSummary.reduce((acc, c) => acc + c.totalMinutes, 0);
  if (totalMinutes === 0) return <Typography>Sem dados</Typography>;

  const pieData = cargosSummary
    .filter(c => c.totalMinutes > 0 && c.cargoName !== 'Cargo Não Mapeado')
    .map((cargo, index) => ({
      id: index,
      value: cargo.totalMinutes,
      label: cargo.cargoName,
      percentage: (cargo.totalMinutes / totalMinutes) * 100,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <PieChart
        series={[{
          data: pieData.map((d, i) => ({
            ...d,
            color: cargoColors[i % cargoColors.length]
          })),
          innerRadius: 60,
          outerRadius: 100,
          paddingAngle: 3,
          cornerRadius: 6,
        }]}
        width={300}
        height={300}
        slotProps={{
          legend: { }
        }}
      />
      <Box sx={{ mt: 2, flexGrow: 1, overflowY: 'auto' }}>
        {pieData.map((item, idx) => (
          <Box key={item.id} display="flex" justifyContent="space-between" alignItems="center" py={0.6}>
            <Box display="flex" alignItems="center" gap={1}>
              <Box sx={{
                width: 10, height: 10, borderRadius: '50%',
                bgcolor: cargoColors[idx % cargoColors.length]
              }} />
              <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
                {item.label}
              </Typography>
            </Box>
            <Typography variant="body2" fontWeight="bold">
              {item.percentage.toFixed(1)}%
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}