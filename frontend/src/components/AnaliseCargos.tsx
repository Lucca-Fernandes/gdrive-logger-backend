// src/components/AnaliseCargos.tsx

import { useState, useMemo } from 'react';
import { 
    Box, Typography, Card, CardContent, CardActions, Button, Chip, Avatar,
    Alert, Skeleton, Pagination
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import { Person, AccessTime, Folder, Link as LinkIcon } from '@mui/icons-material';
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Reutilizamos a interface Editor, que agora virá filtrada por cargo
interface Editor { 
    documentId: string; documentName: string; documentLink: string; 
    folderPath: string; editorName: string; totalMinutes: number; lastEdit: string | null; 
}

// Interfaces de dados passadas pelo Dashboard
interface AnaliseCargosProps {
    data: Editor[];
    loading: boolean;
    error: boolean;
    totalCount: number;
    limit: number;
    currentPage: number;
    onPageChange: (page: number) => void;
    // Nova função para buscar dados com filtro de editor/cargo
    fetchData: (page: number, editorName?: string) => void;
}

// Mapeamento Corrigido: EditorName (prefixo do email) -> Cargo
const CARGOS_MOCK: { [key: string]: string } = {
    // Editores Ativos
    'everton.marques': 'Web Designer',
    'flavio.junior': 'Roteirista',
    'jonatas.barreto': 'Roteirista',
    'amanda.delrio': 'Revisão',
    'nilce.almeida': 'Revisão',
    'monica.alves': 'Pesquisa Iconográfica',
    'nubia.santiago': 'Pesquisa Iconográfica',
    'gabriela.amaro': 'Designer Gráfico',
    'laura.amorim': 'Designer Gráfico',
    'stephanie.gomes': 'Revisão',
    'thiago.santos': 'Designer Gráfico',
    'viviane.gonzaga': 'Design Educacional',
    'willy': 'Revisão',
    'liliene.santana': 'Design Educacional',
    'tamires.ferreira': 'Design Educacional',
    'vicente.silva': 'Design Educacional',
    
    // Outros Colaboradores (incluídos no mock para exibição)
    'deijiane.cruz': 'Coordenadora do Eixo de Gestão',
    'matheus.souza': 'Coordenadora do Eixo de Gestão',
    'leandro.azevedo': 'Coordenadora de TI',
    'valerio.oliveira': 'Coordenador de Validação',
    'fabio.pessoa': 'Coordenador de Turismo',
};


// Funcao para formatar a data
const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    return isValid(date) ? format(date, "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'Inválido';
};

export default function AnaliseCargos({ 
    data, loading, error, totalCount, limit, currentPage, onPageChange, fetchData
}: AnaliseCargosProps) {
    const [selectedCargo, setSelectedCargo] = useState<string | null>(null);
    const [selectedEditor, setSelectedEditor] = useState<string | null>(null);

    // 1. Gerar lista de cargos únicos e lista de editores por cargo
    const cargoMap = useMemo(() => {
        const map = new Map<string, string[]>();
        Object.entries(CARGOS_MOCK).forEach(([editorName, cargo]) => {
            if (!map.has(cargo)) {
                map.set(cargo, []);
            }
            map.get(cargo)?.push(editorName);
        });
        return map;
    }, []);

    const uniqueCargos = useMemo(() => Array.from(cargoMap.keys()).sort(), [cargoMap]);
    
    // Calcula o número total de páginas para a paginação
    const pageCount = Math.ceil(totalCount / limit);

    // Lida com a seleção de Cargo
    const handleCargoSelect = (cargo: string) => {
        setSelectedCargo(cargo);
        setSelectedEditor(null);
    };
    
    // Lida com a seleção do Editor
    const handleEditorSelect = (editorName: string) => {
        setSelectedEditor(editorName);
        fetchData(1, editorName); 
    }

    // Lida com a mudança de página
    const handlePaginationChange = (page: number) => {
        onPageChange(page);
        if (selectedEditor) {
            fetchData(page, selectedEditor);
        } else {
            // Se voltarmos para o modo geral, buscamos os dados gerais da nova página
            // Nota: Este caminho não deve ser atingido se a navegação estiver correta (sem editor selecionado, não há lista de documentos)
            fetchData(page);
        }
    }
    
    // --- Renderização dos Documentos (Lista de Cards) ---
    const renderDocumentList = () => (
        <>
            <Button 
                onClick={() => setSelectedEditor(null)} 
                variant="outlined" 
                size="small" 
                sx={{ mb: 3 }}
            >
                &larr; Voltar para Editores ({selectedCargo})
            </Button>

            <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
                Documentos Editados por: <span style={{ color: '#1976d2' }}>{selectedEditor}</span>
            </Typography>
            
            {error && <Alert severity="error" sx={{ mb: 3 }}>Erro ao carregar dados.</Alert>}
            
            {loading ? (
                // Esqueletos para carregamento
                <Grid container spacing={3}>
                    {[...Array(limit)].map((_, i) => (
                        <Grid xs={12} sm={6} lg={4} key={i}>
                            <Card><CardContent><Skeleton height={150} /></CardContent></Card>
                        </Grid>
                    ))}
                </Grid>
            ) : data.length === 0 ? (
                // Nenhum resultado
                <Box textAlign="center" py={8}>
                    <Typography variant="h6" color="text.secondary">Nenhum documento encontrado para {selectedEditor}.</Typography>
                </Box>
            ) : (
                // Lista de documentos (Card padrão - movida do Dashboard para cá)
                <Grid container spacing={3}>
                    {data.map((item) => (
                        <Grid xs={12} sm={6} lg={4} key={`${item.documentId}-${item.editorName}`}>
                            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: '0.3s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 } }}>
                                <CardContent sx={{ flexGrow: 1 }}>
                                    <Box display="flex" justifyContent="space-between" mb={2}>
                                        <Avatar sx={{ bgcolor: 'primary.main' }}><Person /></Avatar>
                                        <Chip label={`${Number(item.totalMinutes).toFixed(1)} min`} size="small" color="primary" icon={<AccessTime />} />
                                    </Box>
                                    <Typography variant="h6" fontWeight="bold" gutterBottom noWrap>{item.documentName}</Typography>
                                    <Box display="flex" alignItems="center" gap={1} my={1} color="text.secondary">
                                        <Folder fontSize="small" />
                                        <Typography variant="body2" noWrap>{item.folderPath}</Typography>
                                    </Box>
                                    <Box display="flex" alignItems="center" gap={1} my={1}>
                                        <Person fontSize="small" />
                                        <Typography variant="body2" fontWeight="medium">{item.editorName}</Typography>
                                    </Box>
                                    <Typography variant="caption" color="text.secondary">{formatDate(item.lastEdit)}</Typography>
                                </CardContent>
                                <CardActions>
                                    <Button size="small" startIcon={<LinkIcon />} href={item.documentLink} target="_blank" fullWidth variant="outlined">Abrir no Drive</Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}
            
            {/* Paginação */}
            {!loading && totalCount > limit && (
                <Box display="flex" justifyContent="center" mt={4}>
                    <Pagination count={pageCount} page={currentPage} onChange={(_e, v) => handlePaginationChange(v)} color="primary" />
                </Box>
            )}
        </>
    );

    // --- Renderização da Lista de Editores (após Cargo selecionado) ---
    const renderEditorList = () => (
        <>
            <Button 
                onClick={() => setSelectedCargo(null)} 
                variant="outlined" 
                size="small" 
                sx={{ mb: 3 }}
            >
                &larr; Voltar para Cargos
            </Button>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>{selectedCargo}</Typography>
            <Typography variant="subtitle1" color="text.secondary" mb={4}>
                Selecione um editor para ver seus documentos.
            </Typography>

            <Grid container spacing={3}>
                {cargoMap.get(selectedCargo!)?.map(editorName => (
                    <Grid xs={12} sm={6} md={3} key={editorName}>
                        <Card 
                            onClick={() => handleEditorSelect(editorName)}
                            sx={{ 
                                cursor: 'pointer', p: 2, textAlign: 'center', height: '100%', 
                                transition: '0.2s', '&:hover': { bgcolor: 'primary.light', boxShadow: 3 } 
                            }}
                        >
                            <Person fontSize="large" color="primary" />
                            <Typography variant="body1" fontWeight="bold" mt={1}>{editorName}</Typography>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </>
    );

    // --- Renderização da Lista de Cargos ---
    const renderCargoList = () => (
        <>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>Análise de Produtividade por Cargo</Typography>
            <Typography variant="subtitle1" color="text.secondary" mb={4}>
                Selecione um cargo para visualizar os editores e seus documentos.
            </Typography>
            
            <Grid container spacing={3}>
                {uniqueCargos.map(cargo => (
                    <Grid xs={12} sm={6} md={3} key={cargo}>
                        <Card 
                            onClick={() => handleCargoSelect(cargo)}
                            sx={{ 
                                cursor: 'pointer', p: 3, textAlign: 'center', height: '100%', 
                                transition: '0.2s', '&:hover': { bgcolor: 'primary.light', boxShadow: 3 } 
                            }}
                        >
                            <Folder fontSize="large" color="secondary" />
                            <Typography variant="h6" mt={1}>{cargo}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {cargoMap.get(cargo)?.length} Editores
                            </Typography>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </>
    );

    return (
        <Box mt={4}>
            {selectedEditor 
                ? renderDocumentList()
                : selectedCargo 
                    ? renderEditorList()
                    : renderCargoList()
            }
        </Box>
    );
}