import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    Container,
    Box,
    TextField,
    Button,
    Alert,
    CssBaseline,
} from '@mui/material';

const API_URL = 'https://gdrive-logger-backend.onrender.com/api';




export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            const res = await axios.post(`${API_URL}/login`, {
                username,
                password,
            });

            if (res.data.success) {
                localStorage.setItem('isLoggedIn', 'true');
                navigate('/dashboard');
            }
        } catch (err) {
            localStorage.removeItem('isLoggedIn');
            setError('Usuário ou senha inválidos.');
            console.error(err);
        }
    };

    return (
        <Box
            sx={{
                height: '90vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'grey.50', 
            }}
        >
            <Container component="main" maxWidth="xs">
                <CssBaseline />
                <Box
                    sx={{
                        padding: 4, // Adicionado padding
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        bgcolor: 'white', // Fundo branco para o formulário
                        borderRadius: 2, // Bordas arredondadas
                        boxShadow: 4,
                         // Sombra
                    }}
                >
                    <Box
                        component="img"
                        sx={{
                            m: 1,
                            height: 150,
                        }}
                        alt="Logo da Empresa"
                        src="./logo_NIC-PNG.png" />



                    <Box component="form" onSubmit={handleLogin} noValidate sx={{ mt: 1 }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            id="username"
                            label="Usuário"
                            name="username"
                            autoComplete="username"
                            autoFocus
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="password"
                            label="Senha"
                            type="password"
                            id="password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />


                        {error && (
                            <Alert severity="error" sx={{ width: '100%', mt: 1 }}>
                                {error}
                            </Alert>
                        )}

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2 }}
                        >
                            Entrar
                        </Button>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}