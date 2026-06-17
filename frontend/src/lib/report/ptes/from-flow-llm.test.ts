import { describe, expect, it } from 'vitest';

import type { FindingFragmentFragment } from '@/graphql/types';

import { stripControlChars, transformLlmFindingsToEngagement } from './from-flow-llm';

// Build control bytes at runtime so this source stays pure ASCII (no literal control chars).
const ESC = String.fromCharCode(27); // ANSI escape introducer
const NUL = String.fromCharCode(0);
const BEL = String.fromCharCode(7);

const mkBF = (o: Partial<FindingFragmentFragment>): FindingFragmentFragment => ({
    affected: [],
    attackPath: null,
    businessImpact: null,
    category: null,
    createdAt: '2026-01-01',
    cvssScore: null,
    cvssVector: null,
    cwe: null,
    description: 'd',
    evidence: null,
    flowId: '100',
    id: '1',
    impact: null,
    likelihood: null,
    references: null,
    remediation: null,
    reproSteps: null,
    retestStatus: 'open',
    severity: 'high',
    sourceTaskIds: [],
    title: 'T',
    updatedAt: '2026-01-01',
    ...o,
});

describe('stripControlChars', () => {
    it('strips ANSI escapes + control chars but keeps the content', () => {
        expect(stripControlChars(`${ESC}[92m200 OK${ESC}[0m`)).toBe('200 OK');
        expect(stripControlChars(`a${NUL}b${BEL}c`)).toBe('abc');
        expect(stripControlChars('')).toBe('');
        expect(stripControlChars('clean text')).toBe('clean text');
    });
});

describe('transformLlmFindingsToEngagement', () => {
    it('defaults invalid severity to info and derives CVSS from severity when no score', () => {
        const [f] = transformLlmFindingsToEngagement([mkBF({ cvssScore: null, severity: 'bogus' })]);
        expect(f!.severity).toBe('info');
        expect(f!.cvss).toBe(0); // CVSS_BY_SEVERITY.info
    });

    it('uses the provided cvssScore when present', () => {
        const [f] = transformLlmFindingsToEngagement([mkBF({ cvssScore: 8.8, severity: 'high' })]);
        expect(f!.cvss).toBe(8.8);
    });

    it('clamps likelihood/impact to [1,5] with a severity fallback', () => {
        const [f] = transformLlmFindingsToEngagement([mkBF({ impact: 4, likelihood: 99, severity: 'medium' })]);
        expect(f!.likelihood).toBe(3); // 99 out of range -> LIKELIHOOD_BY_SEVERITY.medium
        expect(f!.impact).toBe(4); // in range -> kept
    });

    it('marks cvss provenance estimated without a score, inferred with one', () => {
        expect(transformLlmFindingsToEngagement([mkBF({ cvssScore: null })])[0]!.provenance?.cvss).toBe('estimated');
        expect(transformLlmFindingsToEngagement([mkBF({ cvssScore: 7 })])[0]!.provenance?.cvss).toBe('inferred');
    });

    it('sets retestStatus only in retest mode (override > persisted > open)', () => {
        const rows = [mkBF({ id: '42', retestStatus: 'fixed' })];
        expect(transformLlmFindingsToEngagement(rows)[0]!.retestStatus).toBeUndefined(); // no map -> off
        expect(transformLlmFindingsToEngagement(rows, { '42': 'not_fixed' })[0]!.retestStatus).toBe('not_fixed'); // override
        expect(transformLlmFindingsToEngagement(rows, {})[0]!.retestStatus).toBe('fixed'); // persisted fallback
    });
});
