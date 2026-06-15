// Splits a code/evidence excerpt into segments, marking the part that actually DEMONSTRATES the
// vulnerability (the injected payload / proof) so the renderers can highlight it in yellow.
// Shared by the PDF, DOCX and PPTX renderers so the three formats highlight identically.

export interface CodeSeg {
    text: string;
    hot: boolean;
}

// Yellow highlighter for the vuln-proving span (on a dark code block, hot spans use dark text).
export const HOT_BG = '#FDE047';
export const HOT_BG_HEX = 'FDE047'; // docx/pptx (no '#')
export const HOT_FG = '#0F172A';
export const HOT_FG_HEX = '0F172A';

// The actual exploit payloads / proof tokens — XSS, SQLi, traversal, SSTI, JWT, command injection.
// Status codes and prose are intentionally NOT matched: we highlight the *attack*, not the noise.
const HOT_PATTERNS = [
    '<script\\b[^>]*>[\\s\\S]*?<\\/script>',
    '<img\\b[^>]*\\bon\\w+\\s*=[^>]*>',
    '<svg\\b[^>]*>',
    '\\bon(?:error|load|mouseover)\\s*=\\s*[^\\s>]+',
    'javascript:[^\\s"\'<>]+',
    'alert\\s*\\([^)]*\\)',
    "'?\\s*OR\\s+'?1'?\\s*=\\s*'?1",
    '\\bUNION\\s+(?:ALL\\s+)?SELECT\\b',
    '\\bSLEEP\\s*\\(\\s*\\d+\\s*\\)',
    '\\bSELECT\\b[^;]*\\bFROM\\b[^;]*',
    '(?:\\.\\.\\/){2,}[\\w./-]*',
    '(?:%2e%2e(?:%2f|\\/)){1,}[\\w%./-]*',
    '\\{\\{[^}]{1,80}\\}\\}',
    '\\$\\{[^}]{1,80}\\}',
    'eyJ[A-Za-z0-9_-]{6,}\\.[A-Za-z0-9_-]{4,}(?:\\.[A-Za-z0-9_-]*)?',
    '"alg"\\s*:\\s*"none"',
    '[;|&]\\s*(?:id|whoami|cat\\s+\\/[\\w./]+|uname\\b)',
    '\\$\\([^)]{1,80}\\)',
];
const HOT_RE = new RegExp(`(?:${HOT_PATTERNS.join('|')})`, 'gi');

// Returns the excerpt split into normal/hot segments. Always returns at least one segment.
export function highlightSegments(code: string): CodeSeg[] {
    const out: CodeSeg[] = [];
    const re = new RegExp(HOT_RE.source, 'gi');
    let last = 0;
    let m: null | RegExpExecArray;
    while ((m = re.exec(code)) !== null) {
        if (m[0].length === 0) {
            re.lastIndex++;
            continue;
        }
        if (m.index > last) out.push({ hot: false, text: code.slice(last, m.index) });
        out.push({ hot: true, text: m[0] });
        last = m.index + m[0].length;
    }
    if (last < code.length) out.push({ hot: false, text: code.slice(last) });
    return out.length ? out : [{ hot: false, text: code }];
}

// True when the excerpt contains a highlight-worthy payload (lets a renderer flag "vuln shown here").
export function hasVulnProof(code: string): boolean {
    return new RegExp(HOT_RE.source, 'i').test(code);
}
