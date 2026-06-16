// English source string -> Brazilian Portuguese (pt-BR).
// Missing keys fall back to the English source automatically.
const pt: Record<string, string> = {
    // ── Reports ──────────────────────────────────────────────────────────
    'PTES report (premium)': 'Relatório PTES (premium)',

    // ── Branding (whitelabel) ────────────────────────────────────────────
    Branding: 'Identidade Visual',
    'Customize the brand identity used across the app and your generated reports (whitelabel).':
        'Personalize a identidade visual usada no aplicativo e nos relatórios gerados (whitelabel).',
    'Brand identity': 'Identidade da marca',
    'The application name and colors applied to report covers, charts and headers.':
        'O nome do aplicativo e as cores aplicadas às capas, gráficos e cabeçalhos dos relatórios.',
    'Application name': 'Nome do aplicativo',
    'Application name is required.': 'O nome do aplicativo é obrigatório.',
    'Primary color': 'Cor primária',
    'Accent color': 'Cor de destaque',
    'Application logos': 'Logotipos do aplicativo',
    'Used on the app UI and as the publisher logo on every report. The dark variant is used on the report cover.':
        'Usados na interface do app e como logotipo do emissor em todos os relatórios. A variante escura é usada na capa.',
    'Logo (light background)': 'Logotipo (fundo claro)',
    'Logo (dark background)': 'Logotipo (fundo escuro)',
    'Shown on light backgrounds. PNG or SVG recommended.': 'Exibido em fundos claros. PNG ou SVG recomendados.',
    'Optional. Shown on dark backgrounds such as the report cover.':
        'Opcional. Exibido em fundos escuros, como a capa do relatório.',
    'Default client (co-branding)': 'Cliente padrão (co-branding)',
    'Optional default client used to personalize reports. Can be overridden per report.':
        'Cliente padrão opcional para personalizar os relatórios. Pode ser substituído em cada relatório.',
    'Client name': 'Nome do cliente',
    'e.g. ACME Corporation': 'ex.: ACME Corporação',
    'Client logo': 'Logotipo do cliente',
    'The client logo for co-branded, personalized reports.':
        'O logotipo do cliente para relatórios co-marcados e personalizados.',
    Replace: 'Substituir',
    Remove: 'Remover',
    Reset: 'Restaurar',
    'Save changes': 'Salvar alterações',
    'Saving…': 'Salvando…',
    'Branding saved.': 'Identidade visual salva.',
    'Failed to save branding.': 'Falha ao salvar a identidade visual.',
    'Live preview': 'Pré-visualização',
    Palette: 'Paleta',
    Confidential: 'Confidencial',
    'Penetration Test Report': 'Relatório de Teste de Intrusão',
    'Unsupported image format. Use PNG, JPG, SVG or WebP.':
        'Formato de imagem não suportado. Use PNG, JPG, SVG ou WebP.',
    'Image is too large (max 1.5 MB).': 'Imagem muito grande (máx. 1,5 MB).',
    'Large image — consider a smaller logo for lighter reports.':
        'Imagem grande — considere um logotipo menor para relatórios mais leves.',
    'Could not read the image file.': 'Não foi possível ler o arquivo de imagem.',

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

    // ── Report: Strati-parity tables / front matter / retest ─────────────
    'Top vulnerabilities': 'Principais vulnerabilidades',
    'Affected hosts and URLs': 'Hosts e URLs afetados',
    Recommendation: 'Recomendação',
    Vulnerability: 'Vulnerabilidade',
    Criticality: 'Criticidade',
    Contacts: 'Contatos',
    Name: 'Nome',
    Role: 'Cargo',
    'Contact information': 'Informações de contato',
    Pentester: 'Pentester',
    Reviewer: 'Revisor',
    'Confidentiality notice': 'Aviso de confidencialidade',
    'This document contains proprietary and confidential information. All data discovered during testing and presented here was handled to preserve its privacy and secrecy. Duplication, redistribution or use, in whole or in part, by any means, requires prior consent.':
        'Este documento contém informações proprietárias e confidenciais. Todos os dados encontrados durante os testes e aqui apresentados foram tratados de forma a garantir sua privacidade e sigilo. A duplicação, redistribuição ou uso, no todo ou em parte, por qualquer meio, requer consentimento prévio.',
    'Trace cleanup': 'Limpeza de rastros',
    'After collecting the information and evidence shown above, the systems were restored exactly as found: any accounts created for the proof of concept were removed, and the exploits used during testing were properly deleted.':
        'Após a coleta das informações e evidências demonstradas acima, os sistemas foram restaurados exatamente conforme encontrados: os usuários criados para a prova de conceito foram removidos, assim como os exploits utilizados durante o teste foram devidamente excluídos.',
    Retest: 'Reteste',
    'Retest status': 'Status do reteste',
    Open: 'Em aberto',
    Fixed: 'Corrigida',
    'Not fixed': 'Não corrigida',
    'Accepted risk': 'Risco aceito',
    'Retest of the engagement; each finding shows its current remediation status.':
        'Reteste do engajamento; cada achado mostra seu status atual de remediação.',
    'Set the remediation status of each finding, then generate the retest report.':
        'Defina o status de remediação de cada achado e então gere o relatório de reteste.',
    'Loading findings…': 'Carregando achados…',
    'No findings were derived for this flow yet.': 'Nenhum achado foi derivado para este fluxo ainda.',
    'Generate retest report': 'Gerar relatório de reteste',
    'Generating…': 'Gerando…',
    '+{count} more': '+{count} mais',
    'Tool output (proof)': 'Saída da ferramenta (prova)',
};

export default pt;
