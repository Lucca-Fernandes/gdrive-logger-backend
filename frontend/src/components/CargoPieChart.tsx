// src/components/CargoPieChart.tsx
import { PieChart } from '@mui/x-charts';
import { Box, Typography } from '@mui/material';
import {
  Folder, Person, Business, Analytics, Code, DesignServices,
  Calculate, School, HealthAndSafety, Engineering, AccountBalance,
  Science, Brush, Camera, MusicNote, Sports, Language
} from '@mui/icons-material';

interface CargoSummary {
  cargoName: string;
  totalMinutes: number;
}

interface CargoPieChartProps {
  cargosSummary: CargoSummary[];
}

// === 20+ CORES ÚNICAS ===
const uniqueColors = [
  '#1976d2', '#d32f2f', '#388e3c', '#f57c00', '#7b1fa2',
  '#689f38', '#0288d1', '#c2185b', '#512da8', '#00796b',
  '#f44336', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4',
  '#8bc34a', '#ff5722', '#673ab7', '#0097a7', '#cddc39'
];

// === MAPA DE ÍCONES ===
const cargoIconMap: Record<string, any> = {
  'gerente': Business,
  'diretor': AccountBalance,
  'analista': Analytics,
  'desenvolvedor': Code,
  'designer': DesignServices,
  'contador': Calculate,
  'professor': School,
  'médico': HealthAndSafety,
  'engenheiro': Engineering,
  'cientista': Science,
  'artista': Brush,
  'fotógrafo': Camera,
  'músico': MusicNote,
  'atleta': Sports,
  'linguista': Language,
  'coordenador': Folder,
  'assistente': Person,
  'revisor': Folder,
  'roteirista': Brush,
  'pesquisa': Science,
  'design': DesignServices,
};

const getCargoIcon = (name: string): any => {
  const lower = name.toLowerCase();
  for (const key in cargoIconMap) {
    if (lower.includes(key)) return cargoIconMap[key];
  }
  return Folder;
};

export default function CargoPieChart({ cargosSummary }: CargoPieChartProps) {
  const totalMinutes = cargosSummary.reduce((acc, c) => acc + c.totalMinutes, 0);
  if (totalMinutes === 0) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" height="100%">
        <Typography color="text.secondary">Sem dados</Typography>
      </Box>
    );
  }

  const pieData = cargosSummary
    .filter(c => c.totalMinutes > 0 && c.cargoName !== 'Cargo Não Mapeado')
    .map((cargo, index) => ({
      id: index,
      value: cargo.totalMinutes,
      label: cargo.cargoName,
      percentage: (cargo.totalMinutes / totalMinutes) * 100,
      color: uniqueColors[index % uniqueColors.length],
      Icon: getCargoIcon(cargo.cargoName),
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      {/* Gráfico */}
      <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <PieChart
          series={[
            {
              data: pieData.map(d => ({ id: d.id, value: d.value, color: d.color })),
              innerRadius: 70,
              outerRadius: 110,
              paddingAngle: 2,
              cornerRadius: 8,
            },
          ]}
          slotProps={{ legend: {  } }}
          width={280}
          height={280}
        />
      </Box>

      {/* Legenda com Scroll Horizontal */}
      <Box
        sx={{
          mt: 3,
          px: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          '&::-webkit-scrollbar': { height: 6 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(0,0,0,0.3)', borderRadius: 3 },
        }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 4,
            minWidth: 'max-content',
            py: 1,
          }}
        >
          {pieData.map((item) => {
            const Icon = item.Icon;
            return (
              <Box
                key={item.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: 90,
                  flex: '0 0 auto',
                }}
              >
                <Icon sx={{ fontSize: 28, color: item.color, mb: 0.5 }} />
                <Typography
                  variant="body2"
                  fontWeight="medium"
                  sx={{
                    textAlign: 'center',
                    maxWidth: 120,
                    lineHeight: 1.3,
                    wordBreak: 'break-word',
                  }}
                >
                  {item.label}
                </Typography>
                <Typography
                  variant="h6"
                  fontWeight="bold"
                  color={item.color}
                  sx={{ mt: 0.5, fontSize: '1.1rem' }}
                >
                  {item.percentage.toFixed(0)}%
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}