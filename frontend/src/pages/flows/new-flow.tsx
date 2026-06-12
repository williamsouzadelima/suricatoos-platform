import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Cloud, Globe, Lock, Network } from 'lucide-react';

import Logo from '@/components/icons/logo';
import { t } from '@/i18n';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FlowForm, type FlowFormValues } from '@/features/flows/flow-form';
import { useFlows } from '@/providers/flows-provider';
import { useProviders } from '@/providers/providers-provider';
import { useSystemSettings } from '@/providers/system-settings-provider';

function NewFlow() {
    const navigate = useNavigate();

    const { selectedProvider } = useProviders();
    const { createFlow, createFlowWithAssistant } = useFlows();
    const { settings } = useSystemSettings();

    const [isLoading, setIsLoading] = useState(false);
    const [flowType, setFlowType] = useState<'assistant' | 'automation'>('automation');

    const shouldUseAgents = useMemo(() => {
        return settings?.assistantUseAgents ?? false;
    }, [settings?.assistantUseAgents]);

    const handleSubmit = async (values: FlowFormValues) => {
        if (isLoading) {
            return;
        }

        setIsLoading(true);

        try {
            const flowId = flowType === 'automation' ? await createFlow(values) : await createFlowWithAssistant(values);

            if (flowId) {
                navigate(`/flows/${flowId}?tab=${flowType}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <header className="bg-background sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b px-4">
                <SidebarTrigger className="-ml-1 shrink-0" />
                <Separator
                    className="mr-2 h-4 shrink-0"
                    orientation="vertical"
                />
                <Breadcrumb className="min-w-0 flex-1">
                    <BreadcrumbList className="min-w-0 flex-nowrap">
                        <BreadcrumbItem className="min-w-0">
                            <BreadcrumbPage className="min-w-0 truncate">{t('New flow')}</BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
            </header>
            <div className="relative flex min-h-[calc(100dvh-3rem)] flex-col items-center justify-center overflow-hidden p-4">
                <div
                    aria-hidden
                    className="bg-primary/12 pointer-events-none absolute -top-40 right-[-10%] size-[34rem] rounded-full blur-3xl"
                />
                <div
                    aria-hidden
                    className="bg-brand/10 pointer-events-none absolute -bottom-48 left-[-12%] size-[30rem] rounded-full blur-3xl"
                />

                <div className="relative z-10 w-full max-w-2xl">
                    <div className="mb-7 flex flex-col items-center text-center">
                        <div className="border-gradient shadow-soft mb-5 flex size-14 items-center justify-center rounded-2xl">
                            <Logo className="text-foreground size-8" />
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-[2.5rem] sm:leading-[1.1]">
                            {t('Start a new ')}
                            <span className="text-gradient">{t('pentest flow')}</span>
                        </h1>
                        <p className="text-muted-foreground mt-3 max-w-md text-[0.95rem] text-balance">
                            {t(
                                'Describe what you would like Suricatoos to test — autonomous agents handle recon, exploitation, and reporting.',
                            )}
                        </p>
                    </div>

                    <Card className="border-border/60 shadow-soft overflow-hidden ring-1 ring-black/[0.02] dark:ring-white/[0.04]">
                        <CardContent className="flex flex-col gap-4 p-5">
                            <Tabs
                                onValueChange={(value) => setFlowType(value as 'assistant' | 'automation')}
                                value={flowType}
                            >
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger
                                        disabled={isLoading}
                                        value="automation"
                                    >
                                        {t('Automation')}
                                    </TabsTrigger>
                                    <TabsTrigger
                                        disabled={isLoading}
                                        value="assistant"
                                    >
                                        {t('Assistant')}
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                            <FlowForm
                                defaultValues={{
                                    providerName: selectedProvider?.name ?? '',
                                    useAgents: shouldUseAgents,
                                }}
                                isSubmitting={isLoading}
                                onSubmit={handleSubmit}
                                placeholder={
                                    !isLoading
                                        ? flowType === 'automation'
                                            ? t('Describe what you would like Suricatoos to test...')
                                            : t('What would you like me to help you with?')
                                        : t('Creating a new flow...')
                                }
                                type={flowType}
                            />
                        </CardContent>
                    </Card>

                    <div className="text-muted-foreground mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
                        <span className="inline-flex items-center gap-1.5">
                            <Globe className="size-3.5" /> {t('Web apps')}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <Network className="size-3.5" /> {t('Networks')}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <Lock className="size-3.5" /> {t('APIs & auth')}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <Cloud className="size-3.5" /> {t('Cloud')}
                        </span>
                    </div>
                </div>
            </div>
        </>
    );
}

export default NewFlow;
