import { Component, type ErrorInfo, type ReactNode } from 'react';

import { t } from '@/i18n';
import { Log } from '@/lib/log';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
}

// Catches render-phase errors in its subtree and shows a fallback instead of a blank white screen.
// Use around heavy/derived UI (e.g. the report page) where a transform/render bug should degrade
// gracefully rather than crash the whole route.
export class ErrorBoundary extends Component<Props, State> {
    override state: State = { hasError: false };

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    override componentDidCatch(error: Error, info: ErrorInfo): void {
        Log.error(`Render error caught by ErrorBoundary (${info.componentStack ?? 'no component stack'}):`, error);
    }

    override render(): ReactNode {
        if (!this.state.hasError) {
            return this.props.children;
        }
        if (this.props.fallback !== undefined) {
            return this.props.fallback;
        }
        return (
            <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
                <h1 className="text-xl font-semibold text-red-600 dark:text-red-400">{t('Something went wrong')}</h1>
                <p className="max-w-md text-gray-600 dark:text-gray-400">
                    {t('An unexpected error occurred while rendering this page. Please reload and try again.')}
                </p>
                <button
                    className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
                    onClick={() => window.location.reload()}
                    type="button"
                >
                    {t('Reload')}
                </button>
            </div>
        );
    }
}
