import { Check, Loader2 } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';

import Logo from '@/components/icons/logo';
import { LanguageDropdown } from '@/components/shared/language-selector';
import LoginForm from '@/features/authentication/login-form';
import { t } from '@/i18n';
import { getSafeReturnUrl } from '@/lib/utils/auth';
import { useUser } from '@/providers/user-provider';

const HIGHLIGHTS = [
    'Multi-agent recon, exploitation & reporting',
    'Tools executed in isolated Docker sandboxes',
    'Persistent vector memory across engagements',
];

function Login() {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const { authInfo, isLoading } = useUser();
    const authProviders = authInfo?.providers || [];

    const returnUrl = getSafeReturnUrl((location.state?.from as string) || searchParams.get('returnUrl'), '/flows/new');

    return (
        <div className="relative flex h-dvh w-full overflow-hidden">
            <div className="absolute top-4 right-4 z-20">
                <LanguageDropdown />
            </div>
            <div className="flex w-full items-center justify-center px-4 py-12 lg:w-1/2">
                {!isLoading ? (
                    <LoginForm
                        providers={authProviders}
                        returnUrl={returnUrl}
                    />
                ) : (
                    <Loader2 className="text-primary size-12 animate-spin" />
                )}
            </div>

            <div className="from-primary/[0.07] via-background to-brand/[0.06] relative hidden overflow-hidden bg-linear-to-br lg:flex lg:w-1/2 lg:flex-col lg:items-center lg:justify-center">
                <div
                    aria-hidden
                    className="bg-primary/20 pointer-events-none absolute -top-28 right-[-8%] size-[40rem] rounded-full blur-3xl"
                />
                <div
                    aria-hidden
                    className="bg-brand/15 pointer-events-none absolute bottom-[-12rem] left-[-8%] size-[34rem] rounded-full blur-3xl"
                />
                <div
                    aria-hidden
                    className="absolute inset-0 opacity-[0.4] [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:42px_42px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
                />

                <div className="relative z-10 flex max-w-md flex-col items-center px-10 text-center">
                    <div className="border-gradient shadow-soft mb-8 flex size-28 items-center justify-center rounded-[1.75rem]">
                        <Logo className="animate-logo-pulse text-foreground size-16" />
                    </div>
                    <h2 className="text-3xl font-semibold tracking-tight text-balance">
                        {t('Autonomous ')}
                        <span className="text-gradient">{t('penetration testing')}</span>
                    </h2>
                    <p className="text-muted-foreground mt-4 text-[0.95rem] text-balance">
                        {t(
                            'Orchestrated by AI agents — describe the target, and Suricatoos plans and executes the engagement end to end.',
                        )}
                    </p>
                    <ul className="mt-8 grid w-full gap-3 text-left">
                        {HIGHLIGHTS.map((item) => (
                            <li
                                className="text-foreground/90 flex items-center gap-3 text-sm"
                                key={item}
                            >
                                <span className="bg-primary/10 text-primary flex size-5 shrink-0 items-center justify-center rounded-full">
                                    <Check className="size-3" />
                                </span>
                                {t(item)}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default Login;
