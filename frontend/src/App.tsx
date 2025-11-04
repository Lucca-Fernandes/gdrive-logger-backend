import { BrowserRouter } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import Footer from './components/Footer';
import { Box } from '@mui/material';
function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;