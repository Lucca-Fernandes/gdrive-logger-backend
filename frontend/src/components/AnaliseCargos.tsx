// src/components/AnaliseCargos.tsx

import { useMemo } from 'react';
import { 
    Box, Typography, Card, CardContent, CardActions, Button, Chip, Avatar,
    Alert, Skeleton, Pagination, LinearProgress
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import { Person, AccessTime, Folder, Link as LinkIcon, ArrowBack } from '@mui/icons-material';
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Interfaces de Dados
interface Editor { 
    documentId: string; documentName: string; documentLink: string; 
    folderPath: string; editorName: string; totalMinutes: number; lastEdit: string | null; 
}
interface EditorSummary { 
    editorName: string; 
    totalMinutes: number; 
    totalDocuments: number; 
    lastEdit: string | null; 
}
interface CargoSummary {
    cargoName: string;
    totalMinutes: number;
    totalEditors: number;
    lastEdit: string | null;
}

// Interfaces de Props (Controladas pelo Dashboard)
interface AnaliseCargosProps {
    data: Editor[];
    loading: boolean;
    error: boolean;
    totalCount: number;
    limit: number;
    currentPage: number;
    onPageChange: (page: number) => void;
    fetchData: (page: number, searchString?: string) => void; 

    selectedCargo: string | undefined;
    selectedEditor: string | undefined; 
    onCargoSelect: (cargoName: string) => void;
    onEditorSelect: (editorName: string) => void;
    onBackToEditors: () => void; // Nível 3 -> 2
    onBackToCargos: () => void; // Nível 2 -> 1
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

// Mapeamento EditorName -> Cargo para acesso rápido
const getCargoByEditorName = (editorName: string) => CARGOS_MOCK[editorName] || 'Cargo Não Mapeado';

// Funcao auxiliar para garantir que o valor seja um número
const safeNumber = (value: any): number => parseFloat(value as string) || 0;

// Funcao para formatar a data
const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    return isValid(date) ? format(date, "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'Inválido';
};

// Funcao para formatar minutos em horas
const minutesToHours = (minutes: number) => (minutes / 60).toFixed(2);


export default function AnaliseCargos({ 
    data, loading, error, totalCount, limit, currentPage, onPageChange, fetchData,
    selectedCargo, selectedEditor, onCargoSelect, onEditorSelect, onBackToEditors, onBackToCargos
}: AnaliseCargosProps) {
    
    // Mapeia editores por cargo
    const editorsByCargoMap = useMemo(() => {
        const map = new Map<string, string[]>();
        Object.entries(CARGOS_MOCK).forEach(([editorName, cargo]) => {
            if (!map.has(cargo)) {
                map.set(cargo, []);
            }
            map.get(cargo)?.push(editorName);
        });
        return map;
    }, []);

    
    // === AGREGAÇÃO NÍVEL 1: CARGOS (Visualização Geral) ===
    const aggregatedCargos: CargoSummary[] = useMemo(() => {
        if (selectedCargo || selectedEditor) return []; 
        
        const totals: { [key: string]: { totalMinutes: number; editors: Set<string>; lastEdit: string | null } } = {};

        data.forEach(item => {
            const cargoName = getCargoByEditorName(item.editorName);
            
            if (!totals[cargoName]) {
                totals[cargoName] = { totalMinutes: 0, editors: new Set(), lastEdit: null };
            }
            
            const minutes = safeNumber(item.totalMinutes); 
            totals[cargoName].totalMinutes += minutes;
            totals[cargoName].editors.add(item.editorName);
            
            const currentEditTime = item.lastEdit ? new Date(item.lastEdit).getTime() : 0;
            const existingEditTime = totals[cargoName].lastEdit ? new Date(totals[cargoName].lastEdit).getTime() : 0;
            
            if (currentEditTime > existingEditTime) {
                totals[cargoName].lastEdit = item.lastEdit;
            }
        });

        // Adiciona cargos que existem no mock, mas não tiveram edições no período (para exibição completa)
        editorsByCargoMap.forEach((_editors, cargoName) => {
            if (!totals[cargoName]) {
                 totals[cargoName] = { 
                    totalMinutes: 0, 
                    editors: new Set(editorsByCargoMap.get(cargoName)), 
                    lastEdit: null 
                };
            }
        });

        return Object.keys(totals).map(name => ({
            cargoName: name,
            totalMinutes: totals[name].totalMinutes,
            totalEditors: totals[name].editors.size,
            lastEdit: totals[name].lastEdit,
        })).sort((a, b) => b.totalMinutes - a.totalMinutes); 
    }, [data, selectedCargo, selectedEditor, editorsByCargoMap]);

    
    // === AGREGAÇÃO NÍVEL 2: EDITORES (Visualização por Cargo) ===
    const aggregatedEditors: EditorSummary[] = useMemo(() => {
        if (!selectedCargo || selectedEditor) return []; 
        
        const totals: { [key: string]: { totalMinutes: number; documents: Set<string>; lastEdit: string | null } } = {};

        // 1. Filtra os dados de entrada para incluir apenas editores do cargo selecionado
        const editorsInSelectedCargo = editorsByCargoMap.get(selectedCargo) || [];
        
        const filteredData = data.filter(item => 
            editorsInSelectedCargo.includes(item.editorName)
        );

        // 2. Agrega os dados filtrados por Editor
        filteredData.forEach(item => {
            const editorName = item.editorName;
            if (!totals[editorName]) {
                totals[editorName] = { totalMinutes: 0, documents: new Set(), lastEdit: null };
            }
            
            const minutes = safeNumber(item.totalMinutes); 
            totals[editorName].totalMinutes += minutes;
            totals[editorName].documents.add(item.documentId);
            
            const currentEditTime = item.lastEdit ? new Date(item.lastEdit).getTime() : 0;
            const existingEditTime = totals[editorName].lastEdit ? new Date(totals[editorName].lastEdit).getTime() : 0;
            
            if (currentEditTime > existingEditTime) {
                totals[editorName].lastEdit = item.lastEdit;
            }
        });

        // 3. Garante que todos os editores do mock no cargo sejam listados, mesmo sem minutos
        editorsInSelectedCargo.forEach(editorName => {
            if (!totals[editorName]) {
                 totals[editorName] = { 
                    totalMinutes: 0, 
                    documents: new Set(), 
                    lastEdit: null 
                };
            }
        });

        return Object.keys(totals).map(name => ({
            editorName: name,
            totalMinutes: totals[name].totalMinutes,
            totalDocuments: totals[name].documents.size,
            lastEdit: totals[name].lastEdit,
        })).sort((a, b) => b.totalMinutes - a.totalMinutes); 
    }, [data, selectedCargo, selectedEditor, editorsByCargoMap]);


    const pageCount = Math.ceil(totalCount / limit);

    // Lida com a Paginação (apenas Nível 3)
    const handlePaginationChange = (page: number) => {
        onPageChange(page);
        if (selectedEditor) {
            // Pagina o Nível 3 (Documentos)
            fetchData(page, selectedEditor);
        }
    }
    
    // --- Renderização dos Documentos (Nível 3) ---
    const renderDocumentList = () => (
        <>
            <Button 
                onClick={onBackToEditors} 
                variant="outlined" 
                size="small" 
                startIcon={<ArrowBack />}
                sx={{ mb: 3 }}
            >
                 Voltar para Editores ({selectedCargo})
            </Button>

            <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 'bold' }}>
                Documentos Editados por: <span style={{ color: '#1976d2' }}>{selectedEditor}</span>
            </Typography>
            
            {error && <Alert severity="error" sx={{ mb: 3 }}>Erro ao carregar dados.</Alert>}
            
            {loading ? (
                <Grid container spacing={3}>
                    {[...Array(limit)].map((_, i) => (
                        <Grid xs={12} sm={6} lg={4} key={i}>
                            <Card><CardContent><Skeleton height={150} /></CardContent></Card>
                        </Grid>
                    ))}
                </Grid>
            ) : data.length === 0 ? (
                <Box textAlign="center" py={8}>
                    <Typography variant="h6" color="text.secondary">Nenhum documento encontrado para {selectedEditor}.</Typography>
                </Box>
            ) : (
                // Lista de documentos (Card padrão - O layout que você pediu)
                <Grid container spacing={3}>
                    {data.map((item) => (
                        <Grid xs={12} sm={6} lg={4} key={`${item.documentId}-${item.editorName}`}>
                            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: '0.3s', '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 } }}>
                                <CardContent sx={{ flexGrow: 1 }}>
                                    <Box display="flex" justifyContent="space-between" mb={2}>
                                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                                            {item.editorName.charAt(0).toUpperCase()}
                                        </Avatar>
                                        <Chip 
                                            label={`${safeNumber(item.totalMinutes).toFixed(1)} min`} 
                                            size="small" 
                                            color="primary" 
                                            icon={<AccessTime />} 
                                        />
                                    </Box>
                                    <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.documentName}</Typography>
                                    <Box display="flex" alignItems="center" gap={1} my={1} color="text.secondary">
                                        <Folder fontSize="small" />
                                        <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.folderPath}</Typography>
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
            
            {/* Paginação do Nível 3 */}
            {!loading && totalCount > limit && (
                <Box display="flex" justifyContent="center" mt={4}>
                    <Pagination 
                        count={pageCount} 
                        page={currentPage} 
                        onChange={(_e, v) => handlePaginationChange(v)} 
                        color="primary" 
                    />
                </Box>
            )}
        </>
    );

    // --- Renderização da Lista de Editores (Nível 2) ---
    const renderEditorList = () => (
        <>
            <Button 
                onClick={onBackToCargos} 
                variant="outlined" 
                size="small" 
                startIcon={<ArrowBack />}
                sx={{ mb: 3 }}
            >
                 Voltar para Cargos
            </Button>
            
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
                Editores em: <span style={{ color: '#1976d2' }}>{selectedCargo}</span>
            </Typography>
            <Typography variant="subtitle1" color="text.secondary" mb={4}>
                Selecione um editor para ver seus documentos.
            </Typography>
            
            {loading && <LinearProgress sx={{ my: 2 }} />}

            {aggregatedEditors.length === 0 && !loading ? (
                 <Alert severity="info" sx={{ my: 2 }}>Nenhum editor encontrado no cargo "{selectedCargo}" com atividades no período.</Alert>
            ) : (
                <Grid container spacing={3}>
                    {aggregatedEditors.map(editor => {
                        const hasActivity = editor.totalMinutes > 0;
                        return (
                            <Grid xs={12} sm={6} md={3} key={editor.editorName}>
                                <Card 
                                    onClick={() => onEditorSelect(editor.editorName)}
                                    sx={{ 
                                        cursor: 'pointer', p: 2, textAlign: 'center', height: '100%', 
                                        transition: '0.2s', '&:hover': { bgcolor: 'primary.light', boxShadow: 3 } 
                                    }}
                                >
                                    <Avatar sx={{ bgcolor: hasActivity ? 'success.main' : 'error.main', mx: 'auto', mb: 1.5 }}>
                                        <Person />
                                    </Avatar>
                                    <Typography variant="body1" fontWeight="bold" mt={1}>{editor.editorName}</Typography>
                                    <Box mt={1}>
                                        <Chip 
                                            label={`${editor.totalMinutes.toFixed(1)} min`} 
                                            size="small" 
                                            color={hasActivity ? 'success' : 'default'} 
                                            icon={<AccessTime />} 
                                            sx={{ mb: 0.5 }}
                                        />
                                        <Typography variant="body2" color="text.secondary">
                                            {editor.totalDocuments} Documento(s)
                                        </Typography>
                                    </Box>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}
        </>
    );

    // --- Renderização da Lista de Cargos (Nível 1) ---
    const renderCargoList = () => (
        <>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>Análise de Produtividade por Cargo</Typography>
            <Typography variant="subtitle1" color="text.secondary" mb={4}>
                Selecione um cargo para visualizar os editores e seus documentos.
            </Typography>
            
            {loading && <LinearProgress sx={{ my: 2 }} />}

            {aggregatedCargos.length === 0 && !loading ? (
                <Alert severity="info" sx={{ my: 2 }}>Nenhuma atividade encontrada para os cargos mapeados no período selecionado.</Alert>
            ) : (
                <Grid container spacing={3}>
                    {aggregatedCargos.map(cargo => {
                        const hasActivity = cargo.totalMinutes > 0;
                        return (
                            <Grid xs={12} sm={6} md={3} key={cargo.cargoName}>
                                <Card 
                                    onClick={() => onCargoSelect(cargo.cargoName)}
                                    sx={{ 
                                        cursor: 'pointer', p: 3, textAlign: 'center', height: '100%', 
                                        transition: '0.2s', '&:hover': { bgcolor: 'primary.light', boxShadow: 3 } 
                                    }}
                                >
                                    <Folder fontSize="large" color={hasActivity ? 'primary' : 'disabled'} />
                                    <Typography variant="h6" mt={1}>{cargo.cargoName}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {cargo.totalEditors} Editores
                                    </Typography>
                                    <Typography variant="body2" fontWeight="bold" color={hasActivity ? 'success.main' : 'error.main'} mt={1}>
                                        {minutesToHours(cargo.totalMinutes)} horas
                                    </Typography>
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}
        </>
    );

    return (
        <Box mt={4}>
            {selectedEditor 
                ? renderDocumentList() // Nível 3: Documentos (Tabela/Cards que o usuário quer)
                : selectedCargo 
                    ? renderEditorList() // Nível 2: Editores
                    : renderCargoList() // Nível 1: Cargos
            }
        </Box>
    );
}