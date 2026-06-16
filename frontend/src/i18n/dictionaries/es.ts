// English source string -> Spanish (es).
// Missing keys fall back to the English source automatically.
const es: Record<string, string> = {
    // ── Navigation / sidebar ─────────────────────────────────────────────
    'New Flow': 'Nuevo Flujo',
    Dashboard: 'Panel',
    Flows: 'Flujos',
    Templates: 'Plantillas',
    Resources: 'Recursos',
    Knowledges: 'Conocimiento',
    Settings: 'Configuración',
    'Recent Flows': 'Flujos recientes',
    'Favorite Flows': 'Flujos favoritos',
    'AI Pentest': 'Pentest con IA',
    'Toggle Sidebar': 'Alternar barra lateral',
    'Toggle favorite': 'Alternar favorito',
    'Upload file': 'Subir archivo',

    // ── User menu ────────────────────────────────────────────────────────
    Theme: 'Tema',
    Language: 'Idioma',
    'Change Password': 'Cambiar contraseña',
    'Log out': 'Cerrar sesión',
    'System theme': 'Tema del sistema',
    'Light theme': 'Tema claro',
    'Dark theme': 'Tema oscuro',

    // ── Login ────────────────────────────────────────────────────────────
    Login: 'Usuario',
    Password: 'Contraseña',
    'Sign in': 'Iniciar sesión',
    'Update Password': 'Actualizar contraseña',
    or: 'o',
    'Enter your email': 'Ingrese su correo',
    'Enter your password': 'Ingrese su contraseña',
    'You need to change your password before continuing.':
        'Debes cambiar tu contraseña antes de continuar.',
    'Autonomous ': 'Pruebas de penetración ',
    'penetration testing': 'autónomas',
    'Orchestrated by AI agents — describe the target, and Suricatoos plans and executes the engagement end to end.':
        'Orquestado por agentes de IA — describe el objetivo, y Suricatoos planifica y ejecuta el trabajo de principio a fin.',
    'Multi-agent recon, exploitation & reporting':
        'Reconocimiento, explotación e informes multiagente',
    'Tools executed in isolated Docker sandboxes':
        'Herramientas ejecutadas en entornos Docker aislados',
    'Persistent vector memory across engagements':
        'Memoria vectorial persistente entre trabajos',

    // ── New flow ─────────────────────────────────────────────────────────
    'New flow': 'Nuevo flujo',
    'Start a new ': 'Inicia un nuevo ',
    'pentest flow': 'flujo de pentest',
    'Describe what you would like Suricatoos to test — autonomous agents handle recon, exploitation, and reporting.':
        'Describe lo que quieres que Suricatoos pruebe — agentes autónomos se encargan del reconocimiento, la explotación y los informes.',
    'Describe what you would like Suricatoos to test': 'Describe lo que quieres que Suricatoos pruebe',
    Automation: 'Automatización',
    Assistant: 'Asistente',
    'Describe what you would like Suricatoos to test...': 'Describe lo que quieres que Suricatoos pruebe...',
    'What would you like me to help you with?': '¿En qué te gustaría que te ayude?',
    'Creating a new flow...': 'Creando un nuevo flujo...',
    'Select Provider': 'Seleccionar proveedor',
    'Web apps': 'Aplicaciones web',
    Networks: 'Redes',
    'APIs & auth': 'APIs y autenticación',
    Cloud: 'Nube',
    'Suricatoos is working... Click Stop to interrupt': 'Suricatoos está trabajando... Haz clic en Detener para interrumpir',

    // ── Common actions ───────────────────────────────────────────────────
    Save: 'Guardar',
    Cancel: 'Cancelar',
    Delete: 'Eliminar',
    Edit: 'Editar',
    Create: 'Crear',
    Close: 'Cerrar',
    Confirm: 'Confirmar',
    Search: 'Buscar',
    Upload: 'Subir',
    Download: 'Descargar',
    Stop: 'Detener',
    Loading: 'Cargando',
    'Loading...': 'Cargando...',

    // ── Provider credentials ─────────────────────────────────────────────
    'API Key': 'Clave de API',
    'Base URL': 'URL base',
    'Enter API key': 'Ingrese la clave de API',
    'Use provider default': 'Usar valor por defecto del proveedor',
    'Stored encrypted. Falls back to the environment variable when left blank.':
        'Se almacena cifrada. Usa la variable de entorno cuando se deja en blanco.',
    'Stored encrypted. Leave blank to keep the current key.':
        'Se almacena cifrada. Deje en blanco para mantener la clave actual.',
    '•••••••• (leave blank to keep)': '•••••••• (deje en blanco para mantener)',
    'Optional. Override the default API endpoint (base URL).':
        'Opcional. Sobrescribe el endpoint por defecto de la API (URL base).',

    // ── Report export ────────────────────────────────────────────────────
    'Technical report': 'Informe técnico',
    'Executive report': 'Informe ejecutivo',
    'Word (.docx)': 'Word (.docx)',
    'PowerPoint (.pptx)': 'PowerPoint (.pptx)',
    'Failed to generate report': 'Error al generar el informe',

    // ── Report: Strati-parity tables / front matter / retest ─────────────
    'Top vulnerabilities': 'Vulnerabilidades principales',
    'Affected hosts and URLs': 'Hosts y URLs afectados',
    Recommendation: 'Recomendación',
    Vulnerability: 'Vulnerabilidad',
    Criticality: 'Criticidad',
    Contacts: 'Contactos',
    Name: 'Nombre',
    Role: 'Cargo',
    'Contact information': 'Información de contacto',
    Pentester: 'Pentester',
    Reviewer: 'Revisor',
    'Confidentiality notice': 'Aviso de confidencialidad',
    'This document contains proprietary and confidential information. All data discovered during testing and presented here was handled to preserve its privacy and secrecy. Duplication, redistribution or use, in whole or in part, by any means, requires prior consent.':
        'Este documento contiene información propietaria y confidencial. Todos los datos descubiertos durante las pruebas y presentados aquí fueron tratados para preservar su privacidad y secreto. La duplicación, redistribución o uso, total o parcial, por cualquier medio, requiere consentimiento previo.',
    'Trace cleanup': 'Limpieza de rastros',
    'After collecting the information and evidence shown above, the systems were restored exactly as found: any accounts created for the proof of concept were removed, and the exploits used during testing were properly deleted.':
        'Tras recopilar la información y las evidencias mostradas arriba, los sistemas se restauraron exactamente como se encontraron: se eliminaron las cuentas creadas para la prueba de concepto y los exploits utilizados durante las pruebas fueron debidamente borrados.',
    Retest: 'Reverificación',
    'Retest status': 'Estado de reverificación',
    Open: 'Abierto',
    Fixed: 'Corregida',
    'Not fixed': 'No corregida',
    'Accepted risk': 'Riesgo aceptado',
    'Retest of the engagement; each finding shows its current remediation status.':
        'Reverificación del trabajo; cada hallazgo muestra su estado actual de remediación.',
    'Set the remediation status of each finding, then generate the retest report.':
        'Defina el estado de remediación de cada hallazgo y luego genere el informe de reverificación.',
    'Loading findings…': 'Cargando hallazgos…',
    'No findings were derived for this flow yet.': 'Aún no se derivaron hallazgos para este flujo.',
    'Generate retest report': 'Generar informe de reverificación',
    'Generating…': 'Generando…',
    '+{count} more': '+{count} más',
};

export default es;
