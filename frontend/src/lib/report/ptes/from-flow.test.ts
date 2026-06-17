import { describe, expect, it } from 'vitest';

import { evidenceWindow, guessSeverity, parseFacts, scoreEvidence } from './from-flow';

describe('parseFacts — deterministic extraction over raw tool output', () => {
    it('extracts CVEs, uppercased and deduplicated in first-seen order', () => {
        const facts = parseFacts(['found cve-2021-44228 (log4shell)', 'also CVE-2021-44228 and CVE-2014-6271']);
        expect(facts.cves).toEqual(['CVE-2021-44228', 'CVE-2014-6271']);
    });

    it('extracts URLs, strips trailing punctuation, stops at closing parens, caps at 12', () => {
        const facts = parseFacts(['see https://example.com/login. and (http://10.0.0.5:8080/x)']);
        expect(facts.urls).toContain('https://example.com/login');
        expect(facts.urls).toContain('http://10.0.0.5:8080/x');
    });

    it('caps URLs at 12', () => {
        const many = Array.from({ length: 20 }, (_, i) => `http://h${i}.test/`).join(' ');
        expect(parseFacts([many]).urls).toHaveLength(12);
    });

    it('parses nmap open-port lines', () => {
        const facts = parseFacts(['443/tcp  open  https   nginx 1.18', '22/tcp open ssh OpenSSH 8.2']);
        expect(facts.ports).toEqual([
            { port: 443, service: 'https' },
            { port: 22, service: 'ssh' },
        ]);
    });

    it('parses nuclei lines and maps severity words (informational -> info, unknown -> info)', () => {
        const facts = parseFacts([
            '[apache-detect] [http] [info] http://10.0.0.5',
            '[CVE-2021-1234] [http] [critical] https://victim.test/path',
            '[tls-version] [ssl] [informational] 10.0.0.5:443',
        ]);
        expect(facts.nuclei).toEqual([
            { matched: 'http://10.0.0.5', severity: 'info', templateId: 'apache-detect' },
            { matched: 'https://victim.test/path', severity: 'critical', templateId: 'CVE-2021-1234' },
            { matched: '10.0.0.5:443', severity: 'info', templateId: 'tls-version' },
        ]);
    });

    it('collects IPv4 hosts and host names from URLs, filtering loopback noise', () => {
        const facts = parseFacts(['Host 192.168.1.10 up', 'localhost 127.0.0.1 0.0.0.0', 'http://target.example/']);
        expect(facts.hosts.has('192.168.1.10')).toBe(true);
        expect(facts.hosts.has('target.example')).toBe(true);
        expect(facts.hosts.has('127.0.0.1')).toBe(false);
        expect(facts.hosts.has('0.0.0.0')).toBe(false);
    });
});

describe('guessSeverity — keyword heuristics (pt + en), first-match-wins ordering', () => {
    it('maps RCE / SQLi to critical', () => {
        expect(guessSeverity('Remote Code Execution on the host')).toBe('critical');
        expect(guessSeverity('SQL Injection in the login form')).toBe('critical');
        expect(guessSeverity('comprometimento total do domínio')).toBe('critical');
    });

    it('maps XSS / SSRF / exposed secret to high', () => {
        expect(guessSeverity('Stored XSS in the comment field')).toBe('high');
        expect(guessSeverity('SSRF against the metadata endpoint')).toBe('high');
        expect(guessSeverity('exposed credential in the response')).toBe('high');
    });

    it('maps disclosure / banner / missing header to low', () => {
        expect(guessSeverity('Verbose error message information disclosure')).toBe('low');
        expect(guessSeverity('Missing header: X-Frame-Options')).toBe('low');
    });

    it('maps recon / informational to info', () => {
        expect(guessSeverity('Informational: service enumeration')).toBe('info');
    });

    it('falls back to medium when no hint matches', () => {
        expect(guessSeverity('an undescribed observation')).toBe('medium');
    });
});

describe('scoreEvidence — favour exploit signals over minified noise', () => {
    const proof = 'GET /admin HTTP/1.1\nAuthorization: Bearer eyJabcdefgh12345\n200 OK\nUNION SELECT password FROM users';
    const noise = 'var a=function(){return 1};webpackChunk.push(function(){});__webpack_require__()';

    it('returns 0 for empty / whitespace-only input', () => {
        expect(scoreEvidence('')).toBe(0);
        expect(scoreEvidence('   \n  ')).toBe(0);
        expect(scoreEvidence(null)).toBe(0);
    });

    it('scores exploit-bearing HTTP traffic positively', () => {
        expect(scoreEvidence(proof)).toBeGreaterThan(0);
    });

    it('ranks real proof above minified bundle noise', () => {
        expect(scoreEvidence(proof)).toBeGreaterThan(scoreEvidence(noise));
    });

    it('penalises long base64 blobs', () => {
        const b64 = 'A'.repeat(500);
        expect(scoreEvidence(b64)).toBeLessThan(0);
    });
});

describe('evidenceWindow — surface the relevant excerpt of a long log', () => {
    it('returns the whole (trimmed) text when it fits within max', () => {
        expect(evidenceWindow('  short proof  ', 80)).toBe('short proof');
        expect(evidenceWindow(null, 80)).toBe('');
    });

    it('windows around the first exploit signal with ellipsis markers', () => {
        const pad = 'x'.repeat(500);
        const text = `${pad}\nUNION SELECT password FROM users\n${pad}`;
        const out = evidenceWindow(text, 90);
        expect(out).toContain('UNION SELECT password FROM users');
        expect(out.startsWith('…')).toBe(true);
        expect(out.endsWith('…')).toBe(true);
        expect(out.length).toBeLessThanOrEqual(92); // 90 + the two ellipsis chars
    });
});
