// src/components/AppHeader.tsx
import React from 'react';
import { AppBar, Toolbar, Box, Button, } from '@mui/material';

const AppHeader: React.FC = () => {
  return (
    <AppBar position="static" sx={{ bgcolor: '#003366', height: 90 }}>
      <Toolbar sx={{ height: '100%', px: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <img 
            src="./logo_NIC-PNG.png" 
            alt="NIC Logo" 
            style={{ height: 150, width: 150, }}
          />
         
        </Box>

        <Box sx={{ flexGrow: 1 }} />

        <Button color="inherit" sx={{ color: 'white', textTransform: 'none', fontWeight: 500, mx: 1 }}>
          Dashboard
        </Button>
        <Button color="inherit" sx={{ color: 'white', textTransform: 'none', fontWeight: 500, mx: 1 }}>
          Relatórios
        </Button>
        <Button color="inherit" sx={{ color: 'white', textTransform: 'none', fontWeight: 500, mx: 1 }}>
          Configurações
        </Button>
        <Button color="inherit" sx={{ color: 'white', textTransform: 'none', fontWeight: 500, mx: 1 }}>
          Ajuda
        </Button>
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;