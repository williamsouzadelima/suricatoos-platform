import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import Logo from '@/components/icons/logo';
import Markdown from '@/components/shared/markdown';
import { t, tf, useLocale } from '@/i18n';
import type { LocaleCode } from '@/i18n/locales';
import { useDeriveFindingsMutation, useFlowQuery, type FindingFragmentFragment } from '@/graphql/types';
import { Log } from '@/lib/log';
import type { RetestStatus } from '@/lib/report/ptes/engagement';
import {
    downloadBlob,
    generateDOCXFromMarkdown,
    generateExecutivePPTX,
    generateExecutiveReport,
    generateFileName,
    generatePDFFromMarkdown,
    generateReport,
    generateTechnicalPPTX,
} from '@/lib/report';
import { toEngagementBranding } from '@/lib/report/branding';
import { generatePtesReportFromFlow } from '@/lib/report/ptes/export-ptes';
import { useBranding } from '@/providers/branding-provider';

type ReportFormat = 'docx' | 'pdf' | 'pptx';
type ReportType = 'executive' | 'ptes' | 'technical';

// Map the app's active locale to a clear language NAME the LLM understands, so the
// derived findings are written in the report's language rather than the flow's stored one.
const LOCALE_LANGUAGE_NAME: Record<LocaleCode, string> = {
    en: 'English',
    es: 'Spanish',
    pt: 'Portuguese (Brazil)',
};

type PdfPhase = 'done' | 'error' | 'idle';
type ReportState = 'content' | 'error' | 'generating' | 'loading';

const RETEST_OPTIONS: { key: string; value: RetestStatus }[] = [
    { key: 'Open', value: 'open' },
    { key: 'Fixed', value: 'fixed' },
    { key: 'Not fixed', value: 'not_fixed' },
    { key: 'Accepted risk', value: 'accepted' },
];

// Retest editor: set each finding's remediation status, then generate a retest-flavored report.
// Statuses are kept client-side (localStorage per flow) — server-side persistence is a follow-up.
function RetestPanel({
    deriving,
    findings,
    flowId,
    generating,
    onGenerate,
}: {
    deriving: boolean;
    findings: FindingFragmentFragment[];
    flowId: string;
    generating: boolean;
    onGenerate: (statuses: Record<string, RetestStatus>, format: ReportFormat) => void;
}) {
    const storageKey = `suricatoos:retest:${flowId}`;
    const [statuses, setStatuses] = useState<Record<string, RetestStatus>>(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            return raw ? (JSON.parse(raw) as Record<string, RetestStatus>) : {};
        } catch {
            return {};
        }
    });
    const [format, setFormat] = useState<ReportFormat>('pdf');

    const setStatus = (id: string, value: RetestStatus): void => {
        setStatuses((prev) => {
            const next = { ...prev, [id]: value };
            try {
                localStorage.setItem(storageKey, JSON.stringify(next));
            } catch {
                // ignore storage errors (private mode, etc.)
            }
            return next;
        });
    };

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900">
            <div className="mx-auto max-w-3xl p-8">
                <h1 className="mb-1 text-2xl font-semibold text-gray-900 dark:text-white">{t('Retest')}</h1>
                <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
                    {t('Set the remediation status of each finding, then generate the retest report.')}
                </p>
                {deriving ? (
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                        <div className="size-5 animate-spin rounded-full border-primary border-b-2" />
                        {t('Loading findings…')}
                    </div>
                ) : findings.length === 0 ? (
                    <p className="text-gray-600 dark:text-gray-400">{t('No findings were derived for this flow yet.')}</p>
                ) : (
                    <>
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                            {findings.map((f) => (
                                <div key={f.id} className="flex items-center justify-between gap-4 py-3">
                                    <span className="text-sm text-gray-800 dark:text-gray-200">{f.title}</span>
                                    <select
                                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                                        onChange={(ev) => setStatus(f.id, ev.target.value as RetestStatus)}
                                        value={statuses[f.id] ?? 'open'}
                                    >
                                        {RETEST_OPTIONS.map((o) => (
                                            <option key={o.value} value={o.value}>
                                                {t(o.key)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 flex items-center gap-3">
                            <select
                                className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                                onChange={(ev) => setFormat(ev.target.value as ReportFormat)}
                                value={format}
                            >
                                <option value="pdf">PDF</option>
                                <option value="docx">{t('Word (.docx)')}</option>
                                <option value="pptx">{t('PowerPoint (.pptx)')}</option>
                            </select>
                            <button
                                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
                                disabled={generating}
                                onClick={() => onGenerate(statuses, format)}
                                type="button"
                            >
                                {generating ? t('Generating…') : t('Generate retest report')}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function FlowReport() {
    const { flowId } = useParams<{ flowId: string }>();
    const [searchParams] = useSearchParams();
    const download = searchParams.has('download');
    const silent = searchParams.has('silent');
    const retest = searchParams.has('retest');
    const typeParam = searchParams.get('type');
    const reportType: ReportType = typeParam === 'executive' ? 'executive' : typeParam === 'ptes' ? 'ptes' : 'technical';
    const reportFormat: ReportFormat = ['docx', 'pptx'].includes(searchParams.get('format') ?? '')
        ? (searchParams.get('format') as ReportFormat)
        : 'pdf';

    const { branding } = useBranding();
    const { locale } = useLocale();
    const reportLanguage = LOCALE_LANGUAGE_NAME[locale];

    const [pdfPhase, setPdfPhase] = useState<PdfPhase>('idle');
    const [pdfError, setPdfError] = useState<null | string>(null);
    const pdfTriggered = useRef(false);

    // Retest mode: derive findings once so the editor can list them, then let the user disposition each.
    const [retestDeriving, setRetestDeriving] = useState(false);
    const [retestGenerating, setRetestGenerating] = useState(false);
    const retestDerived = useRef(false);

    const [prevFlowId, setPrevFlowId] = useState(flowId);

    if (flowId !== prevFlowId) {
        setPrevFlowId(flowId);
        setPdfPhase('idle');
        setPdfError(null);
    }

    const {
        data,
        error: queryError,
        loading,
        refetch,
    } = useFlowQuery({
        errorPolicy: 'all',
        skip: !flowId,
        variables: { id: flowId! },
    });

    // Backend LLM findings deriver — triggered once per PTES report; idempotent + cached server-side.
    const [deriveFindings] = useDeriveFindingsMutation();

    const dataReady = !loading && !queryError && !!data?.flow;

    const reportContent = useMemo(
        () =>
            dataReady
                ? reportType === 'executive'
                    ? generateExecutiveReport(data.tasks || [], data.flow!)
                    : generateReport(data.tasks || [], data.flow!)
                : '',
        [dataReady, data, reportType],
    );

    useEffect(() => {
        pdfTriggered.current = false;
    }, [flowId]);

    useEffect(() => {
        if (!dataReady || !download || pdfTriggered.current || !data?.flow) {
            return;
        }

        pdfTriggered.current = true;

        const typeSlug = reportType === 'executive' ? 'executivo' : reportType === 'ptes' ? 'ptes' : 'tecnico';
        const base = `${generateFileName(data.flow)}_${typeSlug}`;
        const docTitle = `${data.flow.id}. ${data.flow.title}`;
        const subtitle = reportType === 'executive' ? 'Relatório Executivo' : 'Relatório Técnico';
        const tasks = data.tasks || [];
        const flow = data.flow;

        const run = async (): Promise<void> => {
            if (reportType === 'ptes') {
                // Derive findings via the backend LLM first (idempotent + cached); then refetch so the
                // report renders the AI findings. On failure the regex-derived fallback is used.
                let reportData = data;
                try {
                    await deriveFindings({ variables: { flowId: flowId!, language: reportLanguage } });
                    const refreshed = await refetch();
                    if (refreshed.data?.flow) {
                        reportData = refreshed.data;
                    }
                } catch (err) {
                    Log.error('Findings derivation failed; using fallback:', err);
                }
                const blob = await generatePtesReportFromFlow(reportData, toEngagementBranding(branding), reportFormat);
                downloadBlob(blob, `${base}.${reportFormat}`);
                return;
            }
            if (reportFormat === 'docx') {
                await generateDOCXFromMarkdown(reportContent, base, { subtitle, title: docTitle });
            } else if (reportFormat === 'pptx') {
                if (reportType === 'executive') {
                    await generateExecutivePPTX(tasks, flow, base);
                } else {
                    await generateTechnicalPPTX(reportContent, base, { title: docTitle });
                }
            } else {
                await generatePDFFromMarkdown(reportContent, `${base}.pdf`);
            }
        };

        run()
            .then(() => {
                // Mark done either way: a tab opened from a real <a target="_blank"> link (the export
                // menu) usually CANNOT window.close() itself, so instead of leaving a stuck spinner we
                // render the report. Closing is best-effort — and delayed so Safari commits the blob
                // download before the tab goes away (it aborts in-flight downloads on early close).
                setPdfPhase('done');
                if (silent) {
                    setTimeout(() => window.close(), 3000);
                }
            })
            .catch((err) => {
                Log.error('Report generation failed:', err);
                setPdfError(t('Failed to generate report'));
                setPdfPhase('error');
            });
        // deriveFindings/refetch are stable Apollo refs and flowId is fixed per mount; the
        // pdfTriggered guard makes the effect idempotent, so they are intentionally omitted.
    }, [dataReady, download, silent, reportContent, reportType, reportFormat, data, branding]);

    // Retest mode: derive findings once (idempotent + cached server-side) so the editor can list them.
    useEffect(() => {
        if (!retest || !dataReady || retestDerived.current || !flowId) {
            return;
        }
        retestDerived.current = true;
        setRetestDeriving(true);
        (async () => {
            try {
                await deriveFindings({ variables: { flowId, language: reportLanguage } });
                await refetch();
            } catch (err) {
                Log.error('Retest findings derivation failed:', err);
            } finally {
                setRetestDeriving(false);
            }
        })();
        // deriveFindings/refetch are stable Apollo refs; the ref guard makes this run once.
    }, [retest, dataReady, flowId]);

    const handleRetestGenerate = async (statuses: Record<string, RetestStatus>, format: ReportFormat): Promise<void> => {
        if (!data?.flow) {
            return;
        }
        setRetestGenerating(true);
        try {
            const blob = await generatePtesReportFromFlow(data, toEngagementBranding(branding), format, {
                retest: true,
                retestStatuses: statuses,
            });
            downloadBlob(blob, `${generateFileName(data.flow)}_ptes_reteste.${format}`);
        } catch (err) {
            Log.error('Retest report generation failed:', err);
        } finally {
            setRetestGenerating(false);
        }
    };

    let state: ReportState;
    let errorMessage: null | string = null;

    if (loading) {
        state = 'loading';
    } else if (queryError || !data?.flow) {
        state = 'error';
        errorMessage = t('Failed to load flow data');
    } else if (pdfPhase === 'error') {
        state = 'error';
        errorMessage = pdfError;
    } else if (download && pdfPhase !== 'done') {
        state = 'generating';
    } else {
        state = 'content';
    }

    if (state === 'loading' || state === 'generating') {
        // Format-aware copy so a .docx/.pptx export doesn't say "Generating PDF".
        const formatNoun = reportFormat === 'docx' ? 'Word (.docx)' : reportFormat === 'pptx' ? 'PowerPoint (.pptx)' : 'PDF';
        return (
            <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
                <div className="flex min-h-screen flex-col items-center justify-center p-8">
                    <Logo className="animate-logo-pulse mb-8 size-16 text-white" />
                    <div className="flex flex-col gap-4 text-center">
                        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                            {state === 'loading' ? t('Loading Report...') : tf('Generating {format}…', { format: formatNoun })}
                        </h1>
                        <div className="mx-auto size-8 animate-spin rounded-full border-primary border-b-2" />
                        <p className="max-w-md text-gray-600 dark:text-gray-400">
                            {state === 'loading'
                                ? t('Please wait while we prepare your penetration testing report.')
                                : tf('Creating your {format} file. This may take a few moments.', { format: formatNoun })}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (state === 'error') {
        return (
            <div className="min-h-screen bg-linear-to-br from-red-50 via-white to-orange-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
                <div className="flex min-h-screen flex-col items-center justify-center p-8">
                    <Logo className="mb-8 size-16" />
                    <div className="flex flex-col gap-4 text-center">
                        <h1 className="text-2xl font-semibold text-red-600 dark:text-red-400">{t('Error Loading Report')}</h1>
                        <p className="max-w-md text-gray-600 dark:text-gray-400">
                            {errorMessage || t('An unexpected error occurred while loading the report.')}
                        </p>
                        <button
                            className="mt-4 rounded-md bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
                            onClick={() => window.close()}
                        >
                            {t('Close')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (retest) {
        return (
            <RetestPanel
                deriving={retestDeriving}
                findings={data?.findings ?? []}
                flowId={flowId!}
                generating={retestGenerating}
                onGenerate={handleRetestGenerate}
            />
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900">
            <div className="h-screen w-full overflow-auto p-8">
                <div className="mx-auto max-w-4xl">
                    <div className="prose prose-slate dark:prose-invert max-w-none">
                        <Markdown>{reportContent}</Markdown>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default FlowReport;
