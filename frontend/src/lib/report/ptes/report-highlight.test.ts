import { describe, expect, it } from 'vitest';

import { hasVulnProof, highlightSegments } from './report-highlight';

const joined = (code: string): string => highlightSegments(code).map((s) => s.text).join('');
const hotTexts = (code: string): string[] => highlightSegments(code).filter((s) => s.hot).map((s) => s.text);

describe('highlightSegments', () => {
    it('always reassembles to the original input', () => {
        for (const code of ['', 'plain text', "x ' OR 1=1 -- y", '<script>alert(1)</script>', 'a\nb\nc']) {
            expect(joined(code)).toBe(code);
        }
    });

    it('returns a single non-hot segment when there is no payload', () => {
        const segs = highlightSegments('HTTP/1.1 200 OK\nContent-Type: application/json');
        expect(segs).toHaveLength(1);
        expect(segs[0]!.hot).toBe(false);
    });

    it('returns one non-hot segment for empty input', () => {
        expect(highlightSegments('')).toEqual([{ hot: false, text: '' }]);
    });

    it.each([
        ['XSS script', '<script>alert(document.domain)</script>'],
        ['img onerror', '<img src=x onerror=alert(1)>'],
        ['SQLi OR 1=1', "admin' OR 1=1 --"],
        ['SQLi UNION SELECT', 'q=1 UNION SELECT password FROM users'],
        ['path traversal', '/download?file=../../../../etc/passwd'],
        ['SSTI', '{{7*7}}'],
        ['JWT', 'Authorization: Bearer eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiJ9.'],
        ['cmd injection', 'ping 127.0.0.1; id'],
    ])('marks the %s payload as hot', (_label, code) => {
        expect(hotTexts(code).length).toBeGreaterThan(0);
        expect(hasVulnProof(code)).toBe(true);
    });

    it('splits surrounding context out of the hot span', () => {
        const segs = highlightSegments('before <script>x</script> after');
        expect(segs.map((s) => s.hot)).toEqual([false, true, false]);
        expect(segs[1]!.text).toBe('<script>x</script>');
        expect(segs[0]!.text).toBe('before ');
        expect(segs[2]!.text).toBe(' after');
    });
});

describe('hasVulnProof', () => {
    it('is false for benign output (status codes / prose are not payloads)', () => {
        expect(hasVulnProof('HTTP/1.1 200 OK')).toBe(false);
        expect(hasVulnProof('the server returned a normal response')).toBe(false);
        expect(hasVulnProof('')).toBe(false);
    });

    it('is true when a payload is present', () => {
        expect(hasVulnProof("name=' OR '1'='1")).toBe(true);
    });
});
