import { Box, Typography, Link } from '@mui/material';

export default function Footer() {
  return (
    <Box 
      p={4}
      bgcolor="primary.main" 
      color="white"          
      textAlign="center"
      mt={4} 
    >
      
      <Typography variant="body1" color="white"> 
        © {new Date().getFullYear()} N.I.C
      </Typography>

      
      <Typography variant="body2" color="white"> 
        Monitoramento de Produtividade desenvolvido pelo{' '}
        <Link 
          href="https://seusite.com.br" 
          target="_blank" 
          rel="noopener noreferrer"
          color="inherit" 
          sx={{ fontWeight: 'bold' }} 
        >
          NIC
        </Link>
        . | Atualizado em: {new Date().toLocaleTimeString('pt-BR')}
      </Typography>
    </Box>
  );
}