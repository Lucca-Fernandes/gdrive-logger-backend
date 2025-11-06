// src/components/AppHeader.tsx (AGORA É O COMPONENTE SIDEBAR)

import React from 'react';
import { Box, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider } from '@mui/material';
import { Dashboard as DashboardIcon, BarChart, Settings, Help } from '@mui/icons-material';

// Define a largura da sidebar
const SIDEBAR_WIDTH = 250;

const AppHeader: React.FC = () => {
    // Menu items
    const menuItems = [
        { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
        { text: 'Relatórios', icon: <BarChart />, path: '/reports' },
        { text: 'Configurações', icon: <Settings />, path: '/settings' },
        { text: 'Ajuda', icon: <Help />, path: '/help' },
    ];
    
    // Funcao placeholder para navegacao
    const handleNavigation = (path: string) => {
        // Em uma aplicacao real, usaria useNavigate()
        console.log(`Navigating to: ${path}`);
    };

    return (
        <Box
            // Estilo fixo para a Sidebar
            sx={{
                width: SIDEBAR_WIDTH,
                flexShrink: 0,
                bgcolor: '#212121', // Fundo escuro similar ao da referencia
                color: 'white',
                position: 'fixed',
                height: '100vh',
                zIndex: 1200, 
                boxShadow: 3,
                overflowY: 'auto', // Permite scroll se houver muitos itens
            }}
        >
            {/* Secao do Logo */}
            <Box sx={{ p: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', height: 120, mt: -4, ml: 6 }}>
                 <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                     <img 
                        src="./logo_NIC-PNG.png" 
                        alt="NIC Logo" 
                        style={{ height: 150, width: 150 }} 
                      />
                    
                 </Box>
            </Box>
            
            <Divider sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />

            {/* Links do Menu */}
            <List sx={{ p: 1 }}>
                {menuItems.map((item) => (
                    <ListItem key={item.text} disablePadding>
                        <ListItemButton 
                            onClick={() => handleNavigation(item.path)}
                            sx={{ 
                                borderRadius: 1, 
                                '&:hover': { bgcolor: '#424242' },
                                // Simular link ativo para 'Dashboard'
                                bgcolor: item.text === 'Dashboard' ? '#313131' : 'inherit', 
                                color: item.text === 'Dashboard' ? 'white' : 'grey.400',
                            }}
                        >
                            <ListItemIcon sx={{ color: item.text === 'Dashboard' ? '#6200EE' : 'grey.400', minWidth: 40 }}>
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: 500, color: 'inherit' }} />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </Box>
    );
};

export default AppHeader;