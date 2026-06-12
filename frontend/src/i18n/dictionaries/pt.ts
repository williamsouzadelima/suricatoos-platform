// English source string -> Brazilian Portuguese (pt-BR).
// Missing keys fall back to the English source automatically.
const pt: Record<string, string> = {
    // ── Navigation / sidebar ─────────────────────────────────────────────
    'New Flow': 'Novo Fluxo',
    Dashboard: 'Painel',
    Flows: 'Fluxos',
    Templates: 'Modelos',
    Resources: 'Recursos',
    Knowledges: 'Conhecimento',
    Settings: 'Configurações',
    'Recent Flows': 'Fluxos Recentes',
    'Favorite Flows': 'Fluxos Favoritos',
    'AI Pentest': 'Pentest com IA',
    'Toggle Sidebar': 'Alternar barra lateral',
    'Toggle favorite': 'Alternar favorito',
    'Upload file': 'Enviar arquivo',

    // ── User menu ────────────────────────────────────────────────────────
    Theme: 'Tema',
    Language: 'Idioma',
    'Change Password': 'Alterar senha',
    'Log out': 'Sair',
    'System theme': 'Tema do sistema',
    'Light theme': 'Tema claro',
    'Dark theme': 'Tema escuro',

    // ── Login ────────────────────────────────────────────────────────────
    Login: 'Login',
    Password: 'Senha',
    'Sign in': 'Entrar',
    'Update Password': 'Atualizar senha',
    or: 'ou',
    'Enter your email': 'Digite seu e-mail',
    'Enter your password': 'Digite sua senha',
    'You need to change your password before continuing.':
        'Você precisa alterar sua senha antes de continuar.',
    'Autonomous ': 'Teste de invasão ',
    'penetration testing': 'autônomo',
    'Orchestrated by AI agents — describe the target, and Suricatoos plans and executes the engagement end to end.':
        'Orquestrado por agentes de IA — descreva o alvo, e a Suricatoos planeja e executa o teste de ponta a ponta.',
    'Multi-agent recon, exploitation & reporting':
        'Reconhecimento, exploração e relatórios multiagente',
    'Tools executed in isolated Docker sandboxes':
        'Ferramentas executadas em sandboxes Docker isolados',
    'Persistent vector memory across engagements':
        'Memória vetorial persistente entre engajamentos',

    // ── New flow ─────────────────────────────────────────────────────────
    'New flow': 'Novo fluxo',
    'Start a new ': 'Inicie um novo ',
    'pentest flow': 'fluxo de pentest',
    'Describe what you would like Suricatoos to test — autonomous agents handle recon, exploitation, and reporting.':
        'Descreva o que você quer que a Suricatoos teste — agentes autônomos cuidam de reconhecimento, exploração e relatórios.',
    'Describe what you would like Suricatoos to test': 'Descreva o que você quer que a Suricatoos teste',
    Automation: 'Automação',
    Assistant: 'Assistente',
    'Describe what you would like Suricatoos to test...': 'Descreva o que você quer que a Suricatoos teste...',
    'What would you like me to help you with?': 'Com o que você gostaria de ajuda?',
    'Creating a new flow...': 'Criando um novo fluxo...',
    'Select Provider': 'Selecionar provedor',
    'Web apps': 'Aplicações web',
    Networks: 'Redes',
    'APIs & auth': 'APIs e autenticação',
    Cloud: 'Nuvem',
    'Suricatoos is working... Click Stop to interrupt': 'A Suricatoos está trabalhando... Clique em Parar para interromper',

    // ── Common actions ───────────────────────────────────────────────────
    Save: 'Salvar',
    Cancel: 'Cancelar',
    Delete: 'Excluir',
    Edit: 'Editar',
    Create: 'Criar',
    Close: 'Fechar',
    Confirm: 'Confirmar',
    Search: 'Pesquisar',
    Upload: 'Enviar',
    Download: 'Baixar',
    Stop: 'Parar',
    Loading: 'Carregando',
    'Loading...': 'Carregando...',

    // ── Provider credentials ─────────────────────────────────────────────
    'API Key': 'Chave de API',
    'Base URL': 'URL base',
    'Enter API key': 'Digite a chave de API',
    'Use provider default': 'Usar padrão do provedor',
    'Stored encrypted. Falls back to the environment variable when left blank.':
        'Armazenada criptografada. Usa a variável de ambiente quando em branco.',
    'Stored encrypted. Leave blank to keep the current key.':
        'Armazenada criptografada. Deixe em branco para manter a chave atual.',
    '•••••••• (leave blank to keep)': '•••••••• (deixe em branco para manter)',
    'Optional. Override the default API endpoint (base URL).':
        'Opcional. Sobrescreve o endpoint padrão da API (URL base).',

    // ── Report export ────────────────────────────────────────────────────
    'Technical report': 'Relatório técnico',
    'Executive report': 'Relatório executivo',
    'Word (.docx)': 'Word (.docx)',
    'PowerPoint (.pptx)': 'PowerPoint (.pptx)',
    'Failed to generate report': 'Falha ao gerar o relatório',
};

export default pt;
