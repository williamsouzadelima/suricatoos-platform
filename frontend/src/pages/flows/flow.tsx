import type { ReactNode } from 'react';

import {
    ChevronDown,
    Copy,
    Download,
    Ellipsis,
    ExternalLink,
    GitFork,
    GripVertical,
    Loader2,
    NotepadText,
    Pause,
    PencilLine,
    Star,
    Trash,
} from 'lucide-react';
import { startTransition, useCallback, useEffect, useOptimistic, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { FlowStatusIcon } from '@/components/icons/flow-status-icon';
import { ProviderIcon } from '@/components/icons/provider-icon';
import ConfirmationDialog from '@/components/shared/confirmation-dialog';
import {
    DetailNavigationButtons,
    DetailNavigationSheet,
    DetailNavigationToolbar,
} from '@/components/shared/detail-navigation';
import { HeaderButton } from '@/components/shared/header-button';
import { InlineEditInput, useInlineEdit } from '@/components/shared/inline-edit';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import FlowCentralTabs from '@/features/flows/flow-central-tabs';
import FlowTabs from '@/features/flows/flow-tabs';
import { useFlowDetailNavigation } from '@/features/flows/use-flow-detail-navigation';
import { ResultType, StatusType, useRenameFlowMutation } from '@/graphql/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { useFlowTabDetection } from '@/hooks/use-flow-tab-detection';
import { t } from '@/i18n';
import { Log } from '@/lib/log';
import { copyToClipboard, downloadTextFile, generateFileName, generateReport } from '@/lib/report';
import { cn } from '@/lib/utils';
import { formatName } from '@/lib/utils/format';
import { useFavorites } from '@/providers/favorites-provider';
import { useFlow } from '@/providers/flow-provider';
import { type Flow as FlowItem, useFlows } from '@/providers/flows-provider';

const renderFlowItem = (item: FlowItem, isCurrent: boolean): ReactNode => (
    <>
        <FlowStatusIcon
            className="size-3 shrink-0"
            status={item.status}
        />
        <span className={cn('min-w-0 flex-1 truncate', isCurrent && 'font-medium')}>
            {item.title || `Flow #${item.id}`}
        </span>
        <Badge
            className="ml-auto shrink-0 font-mono text-[10px]"
            variant="outline"
        >
            #{item.id}
        </Badge>
    </>
);

function Flow() {
    const { isDesktop, isMobile } = useBreakpoint();
    const navigate = useNavigate();

    const { flowData, flowError, flowId, isLoading: isFlowLoading } = useFlow();
    const { deleteFlow, finishFlow } = useFlows();
    const { isFavoriteFlow, toggleFavoriteFlow } = useFavorites();

    const flow = flowData?.flow;
    const actualFlowTitle = flow?.title ?? '';
    // Surface an optimistic title while the rename mutation is in flight so the
    // breadcrumb, document title and edit affordance flip immediately on Save.
    // If the mutation rejects, React rolls back to `actualFlowTitle` on its own
    // and we surface the toast below — no manual reconciliation needed.
    const [flowTitle, setOptimisticFlowTitle] = useOptimistic(actualFlowTitle, (_current, next: string) => next);
    const isFlowRunning = flow ? ![StatusType.Failed, StatusType.Finished].includes(flow.status) : false;

    // Single controller drives the desktop toolbar AND the mobile dropdown
    // row + sheet — Prev/Next, sheet open state, and the position label all
    // live on one source of truth.
    const flowNav = useFlowDetailNavigation(flowId);

    const {
        handleDropdownCloseAutoFocus,
        inputRef: editingInputRef,
        isEditing: isEditingTitle,
        startEdit: handleFlowRenameStart,
        stopEdit: handleFlowRenameCancel,
    } = useInlineEdit({ resetKey: flowId });

    const [isFinishing, setIsFinishing] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [renameFlowMutation, { loading: isRenameLoading }] = useRenameFlowMutation();

    useEffect(() => {
        if (flowError || (!isFlowLoading && !flowData?.flow)) {
            navigate('/flows', { replace: true });
        }
    }, [flowError, flowData, isFlowLoading, navigate]);

    const handleFlowRenameSave = useCallback(async () => {
        const newTitle = editingInputRef.current?.value.trim();

        if (!flowId || !newTitle) {
            return;
        }

        // Drop the new title into the optimistic state immediately so the
        // breadcrumb and document title flip before the network round-trip. The
        // optimistic value lives only inside this transition — once the
        // mutation settles, useOptimistic falls back to the Apollo cache
        // (which the mutation response has already updated on success, or
        // left untouched on error).
        startTransition(async () => {
            setOptimisticFlowTitle(newTitle);

            try {
                const { data } = await renameFlowMutation({
                    variables: {
                        flowId,
                        title: newTitle,
                    },
                });

                if (data?.renameFlow === ResultType.Success) {
                    toast.success(t('Flow renamed successfully'));
                    handleFlowRenameCancel();
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : t('Failed to rename flow');
                toast.error(errorMessage);
            }
        });
    }, [editingInputRef, flowId, handleFlowRenameCancel, renameFlowMutation, setOptimisticFlowTitle]);

    const handleFlowFinish = useCallback(async () => {
        if (!flow) {
            return;
        }

        setIsFinishing(true);

        try {
            await finishFlow(flow);
        } finally {
            setIsFinishing(false);
        }
    }, [flow, finishFlow]);

    const handleFlowDelete = useCallback(async () => {
        if (!flow) {
            return;
        }

        setIsDeleting(true);

        try {
            const success = await deleteFlow(flow);

            if (success) {
                navigate('/flows', { replace: true });
            }
        } finally {
            setIsDeleting(false);
        }
    }, [flow, deleteFlow, navigate]);

    const [desktopTabsTab, setDesktopTabsTab] = useState<string>('terminal');

    const { handleTabChange: handleMobileTabChange, resolvedTab: mobileAutoTab } = useFlowTabDetection();

    const activeTabsTab = isDesktop ? desktopTabsTab : mobileAutoTab;
    const handleTabsTabChange = isDesktop ? setDesktopTabsTab : handleMobileTabChange;

    const tabsCard = (
        <div className="flex h-[calc(100dvh-3rem)] max-w-full flex-col rounded-none border-0">
            <div className="flex-1 overflow-auto py-4 pr-0 pl-4">
                <FlowTabs
                    activeTab={activeTabsTab}
                    onTabChange={handleTabsTabChange}
                />
            </div>
        </div>
    );

    return (
        <>
            <header className="bg-background sticky top-0 z-10 flex h-12 w-full shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
                <div className="flex w-full items-center justify-between gap-2 px-4">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <SidebarTrigger className="-ml-1 shrink-0" />
                        <Separator
                            className="mr-2 h-4 shrink-0"
                            orientation="vertical"
                        />
                        <Breadcrumb className="min-w-0 flex-1">
                            <BreadcrumbList className="min-w-0 flex-nowrap">
                                <BreadcrumbItem className="min-w-0 gap-2">
                                    {flow && (
                                        <>
                                            <FlowStatusIcon
                                                status={flow.status}
                                                tooltip={formatName(flow.status)}
                                            />

                                            <ProviderIcon
                                                provider={flow.provider}
                                                tooltip={formatName(flow.provider.name)}
                                            />
                                        </>
                                    )}
                                    {isEditingTitle && flow ? (
                                        <InlineEditInput
                                            busy={isRenameLoading}
                                            className="w-64 max-w-full min-w-0 flex-1"
                                            defaultValue={flowTitle}
                                            inputRef={editingInputRef}
                                            onCancel={handleFlowRenameCancel}
                                            onSave={handleFlowRenameSave}
                                            placeholder={t('Flow title')}
                                        />
                                    ) : flow ? (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <BreadcrumbPage
                                                    className="max-w-64 min-w-0 cursor-text truncate select-none"
                                                    onDoubleClick={handleFlowRenameStart}
                                                >
                                                    {flowTitle || t('Select a flow')}
                                                </BreadcrumbPage>
                                            </TooltipTrigger>
                                            <TooltipContent>{t('Double-click to rename')}</TooltipContent>
                                        </Tooltip>
                                    ) : (
                                        <BreadcrumbPage className="min-w-0 truncate">
                                            {flowTitle || 'Select a flow'}
                                        </BreadcrumbPage>
                                    )}
                                </BreadcrumbItem>
                            </BreadcrumbList>
                        </Breadcrumb>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        {flow && !isMobile && (
                            <DetailNavigationToolbar<FlowItem>
                                controller={flowNav}
                                renderItem={renderFlowItem}
                                sheetIcon={<GitFork className="size-4" />}
                                sheetTitle={t('Flows')}
                            />
                        )}
                        {flowId && !isMobile && (
                            <Button
                                aria-label={t('Toggle favorite')}
                                aria-pressed={isFavoriteFlow(flowId)}
                                className="shrink-0"
                                onClick={() => toggleFavoriteFlow(flowId)}
                                size="icon"
                                variant="ghost"
                            >
                                <Star className={isFavoriteFlow(flowId) ? 'fill-yellow-500 stroke-yellow-500' : ''} />
                            </Button>
                        )}
                        {!!(flowData?.tasks ?? [])?.length && <FlowReportDropdown />}
                        {flow && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        aria-label={t('Flow actions')}
                                        className="size-8 p-0"
                                        variant="ghost"
                                    >
                                        <Ellipsis />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="end"
                                    className="min-w-24"
                                    onCloseAutoFocus={handleDropdownCloseAutoFocus}
                                >
                                    {isMobile && flowNav.total > 0 && (
                                        <>
                                            {/* Single row that mirrors the desktop toolbar: label on
                                                the left, prev / position / next button group on the
                                                right. `onSelect={preventDefault}` stops the menu from
                                                closing on label clicks; `<DetailNavigationButtons>`
                                                owns its own click handlers and tooltips. */}
                                            <DropdownMenuItem
                                                className="cursor-default hover:bg-transparent focus:bg-transparent"
                                                onSelect={(event) => event.preventDefault()}
                                            >
                                                <GitFork className="size-4" />
                                                {t('Flows')}
                                                <div className="-my-1.5 -mr-2 ml-auto flex items-center">
                                                    <DetailNavigationButtons<FlowItem>
                                                        controller={flowNav}
                                                        sheetTitle={t('Flows')}
                                                        size="sm"
                                                    />
                                                </div>
                                            </DropdownMenuItem>
                                            {flowId && (
                                                <DropdownMenuItem onClick={() => toggleFavoriteFlow(flowId)}>
                                                    <Star
                                                        className={
                                                            isFavoriteFlow(flowId)
                                                                ? 'size-4 fill-yellow-500 stroke-yellow-500'
                                                                : 'size-4'
                                                        }
                                                    />
                                                    {isFavoriteFlow(flowId)
                                                        ? t('Remove from favorites')
                                                        : t('Add to favorites')}
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                        </>
                                    )}
                                    <DropdownMenuItem onClick={handleFlowRenameStart}>
                                        <PencilLine className="size-3" />
                                        {t('Rename')}
                                    </DropdownMenuItem>
                                    {isFlowRunning && (
                                        <DropdownMenuItem
                                            disabled={isFinishing}
                                            onClick={() => handleFlowFinish()}
                                        >
                                            {isFinishing ? (
                                                <>
                                                    <Loader2 className="animate-spin" />
                                                    {t('Finishing...')}
                                                </>
                                            ) : (
                                                <>
                                                    <Pause />
                                                    {t('Finish')}
                                                </>
                                            )}
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        disabled={isDeleting}
                                        onClick={() => setIsDeleteDialogOpen(true)}
                                    >
                                        {isDeleting ? (
                                            <>
                                                <Loader2 className="size-4 animate-spin" />
                                                {t('Deleting...')}
                                            </>
                                        ) : (
                                            <>
                                                <Trash className="size-4" />
                                                {t('Delete')}
                                            </>
                                        )}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </div>
            </header>
            {isMobile && flow && (
                <DetailNavigationSheet<FlowItem>
                    controller={flowNav}
                    renderItem={renderFlowItem}
                    sheetIcon={<GitFork className="size-4" />}
                    sheetTitle={t('Flows')}
                />
            )}
            <div className="relative flex h-[calc(100dvh-3rem)] w-full max-w-full flex-1">
                {isFlowLoading && (
                    <div className="bg-background/50 absolute inset-0 z-50 flex items-center justify-center">
                        <Loader2 className="size-16 animate-spin" />
                    </div>
                )}
                {isDesktop ? (
                    <ResizablePanelGroup
                        className="w-full"
                        direction="horizontal"
                    >
                        <ResizablePanel
                            defaultSize={50}
                            minSize={30}
                        >
                            <div className="flex h-[calc(100dvh-3rem)] max-w-full flex-col rounded-none border-0">
                                <div className="flex-1 overflow-auto py-4 pr-0 pl-4">
                                    <FlowCentralTabs />
                                </div>
                            </div>
                        </ResizablePanel>
                        <ResizableHandle withHandle>
                            <GripVertical className="size-4" />
                        </ResizableHandle>
                        <ResizablePanel
                            defaultSize={50}
                            minSize={30}
                        >
                            {tabsCard}
                        </ResizablePanel>
                    </ResizablePanelGroup>
                ) : (
                    tabsCard
                )}
            </div>
            <ConfirmationDialog
                cancelText={t('Cancel')}
                confirmText={t('Delete')}
                handleConfirm={handleFlowDelete}
                handleOpenChange={setIsDeleteDialogOpen}
                isOpen={isDeleteDialogOpen}
                itemName={flow?.title}
                itemType="flow"
            />
        </>
    );
}

function FlowReportDropdown() {
    const { flowData, flowId } = useFlow();
    const flow = flowData?.flow;
    const tasks = flowData?.tasks ?? [];

    const isReportDisabled = !flow || !flowId;

    const handleCopyToClipboard = async () => {
        if (isReportDisabled) {
            return;
        }

        const reportContent = generateReport(tasks, flow);
        const success = await copyToClipboard(reportContent);

        if (success) {
            toast.success(t('Report copied to clipboard'));
        } else {
            Log.error('Failed to copy report to clipboard');
            toast.error(t('Failed to copy report to clipboard'));
        }
    };

    const handleDownloadMD = () => {
        if (isReportDisabled || !flow) {
            return;
        }

        try {
            const reportContent = generateReport(tasks, flow);

            const baseFileName = generateFileName(flow);
            const fileName = `${baseFileName}.md`;

            downloadTextFile(reportContent, fileName, 'text/markdown; charset=UTF-8');
        } catch (error) {
            Log.error('Failed to download markdown report:', error);
        }
    };

    // Report-route URLs as real links. Safari's popup blocker SILENTLY drops a programmatic
    // window.open() fired from a menu item (it isn't a user-activated window), so the export opened
    // nothing at all. A genuine <a target="_blank"> click counts as user navigation and is NOT
    // popup-blocked — the items below render as anchors via DropdownMenuItem `asChild`.
    const reportHref = (type: 'executive' | 'ptes' | 'technical', format: 'docx' | 'pdf' | 'pptx'): string =>
        flowId ? `/flows/${flowId}/report?download=true&silent=true&type=${type}&format=${format}` : '#';
    const webViewHref = flowId ? `/flows/${flowId}/report` : '#';
    // Retest opens the interactive editor (set each finding's status, then export) — no silent download.
    const retestHref = flowId ? `/flows/${flowId}/report?type=ptes&retest=true` : '#';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <HeaderButton
                    className="shrink-0"
                    disabled={isReportDisabled}
                    endIcon={<ChevronDown className="opacity-50" />}
                    icon={<NotepadText />}
                    label={t('Report')}
                    variant="ghost"
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild className="flex items-center gap-2" disabled={isReportDisabled}>
                    <a href={webViewHref} rel="noopener noreferrer" target="_blank">
                        <ExternalLink className="size-4" />
                        {t('Open web view')}
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="flex items-center gap-2"
                    disabled={isReportDisabled}
                    onClick={handleCopyToClipboard}
                >
                    <Copy className="size-4" />
                    {t('Copy to clipboard')}
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="flex items-center gap-2"
                    disabled={isReportDisabled}
                    onClick={handleDownloadMD}
                >
                    <Download className="size-4" />
                    {t('Download MD')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t('PTES report (premium)')}</DropdownMenuLabel>
                <DropdownMenuItem asChild className="flex items-center gap-2" disabled={isReportDisabled}>
                    <a href={reportHref('ptes', 'pdf')} rel="noopener noreferrer" target="_blank">
                        <Download className="size-4" />
                        PDF
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="flex items-center gap-2" disabled={isReportDisabled}>
                    <a href={reportHref('ptes', 'docx')} rel="noopener noreferrer" target="_blank">
                        <Download className="size-4" />
                        {t('Word (.docx)')}
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="flex items-center gap-2" disabled={isReportDisabled}>
                    <a href={reportHref('ptes', 'pptx')} rel="noopener noreferrer" target="_blank">
                        <Download className="size-4" />
                        {t('PowerPoint (.pptx)')}
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="flex items-center gap-2" disabled={isReportDisabled}>
                    <a href={retestHref} rel="noopener noreferrer" target="_blank">
                        <ExternalLink className="size-4" />
                        {`${t('Retest')}…`}
                    </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t('Technical report')}</DropdownMenuLabel>
                <DropdownMenuItem asChild className="flex items-center gap-2" disabled={isReportDisabled}>
                    <a href={reportHref('technical', 'pdf')} rel="noopener noreferrer" target="_blank">
                        <Download className="size-4" />
                        PDF
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="flex items-center gap-2" disabled={isReportDisabled}>
                    <a href={reportHref('technical', 'docx')} rel="noopener noreferrer" target="_blank">
                        <Download className="size-4" />
                        {t('Word (.docx)')}
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="flex items-center gap-2" disabled={isReportDisabled}>
                    <a href={reportHref('technical', 'pptx')} rel="noopener noreferrer" target="_blank">
                        <Download className="size-4" />
                        {t('PowerPoint (.pptx)')}
                    </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t('Executive report')}</DropdownMenuLabel>
                <DropdownMenuItem asChild className="flex items-center gap-2" disabled={isReportDisabled}>
                    <a href={reportHref('executive', 'pdf')} rel="noopener noreferrer" target="_blank">
                        <Download className="size-4" />
                        PDF
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="flex items-center gap-2" disabled={isReportDisabled}>
                    <a href={reportHref('executive', 'pptx')} rel="noopener noreferrer" target="_blank">
                        <Download className="size-4" />
                        {t('PowerPoint (.pptx)')}
                    </a>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default Flow;
