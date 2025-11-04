// src/App.tsx
import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import Footer from './components/Footer';
import { Box, CssBaseline } from '@mui/material';

// Imports do DatePicker
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ptBR } from 'date-fns/locale'; // Para datas em português

function App() {
  return (
    <BrowserRouter>
      {/* 1. Adiciona o Provedor de Datas */}
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
        <CssBaseline />
        <Box sx={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh', 
        }}>
          <Box component="main" sx={{
            flexGrow: 1, 
          }}>
            <AppRoutes />
          </Box>
          <Footer />
        </Box>
      </LocalizationProvider>
    </BrowserRouter>
  );
}

export default App;