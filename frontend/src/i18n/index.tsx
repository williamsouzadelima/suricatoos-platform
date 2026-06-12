import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import es from './dictionaries/es';
import esAuto from './dictionaries/es.auto';
import pt from './dictionaries/pt';
import ptAuto from './dictionaries/pt.auto';
import { DEFAULT_LOCALE, isLocaleCode, LOCALE_STORAGE_KEY, localeLang, type LocaleCode } from './locales';

// English source strings are the keys. A missing translation falls back to the
// English source, so the UI is never broken by incomplete coverage.
// Auto-generated translations form the base; hand-crafted entries override them.
const DICTIONARIES: Partial<Record<LocaleCode, Record<string, string>>> = {
    es: { ...esAuto, ...es },
    pt: { ...ptAuto, ...pt },
};

// Module-level active locale so a plain `t()` (no hook) can be used anywhere,
// including outside React. `LocaleProvider` keeps this in sync and remounts the
// tree on change so every `t()` call re-evaluates.
let activeLocale: LocaleCode = DEFAULT_LOCALE;

export function setActiveLocale(code: LocaleCode): void {
    activeLocale = code;
}

/**
 * Translate an English source string into the active locale.
 * Falls back to the source string when no translation exists.
 */
export function t(source: string): string {
    if (activeLocale === 'en') {
        return source;
    }

    return DICTIONARIES[activeLocale]?.[source] ?? source;
}

/** Translate with `{placeholder}` interpolation. */
export function tf(source: string, vars: Record<string, number | string>): string {
    return Object.entries(vars).reduce(
        (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
        t(source),
    );
}

function readStoredLocale(): LocaleCode {
    try {
        const stored = localStorage.getItem(LOCALE_STORAGE_KEY);

        if (isLocaleCode(stored)) {
            return stored;
        }
    } catch {
        // Ignore storage access errors (private mode, etc.).
    }

    return DEFAULT_LOCALE;
}

interface LocaleContextValue {
    locale: LocaleCode;
    setLocale: (code: LocaleCode) => void;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function LocaleProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<LocaleCode>(readStoredLocale);

    // Keep the module-level locale correct synchronously, before children render.
    setActiveLocale(locale);

    useEffect(() => {
        document.documentElement.lang = localeLang(locale);
    }, [locale]);

    const setLocale = useCallback((code: LocaleCode) => {
        try {
            localStorage.setItem(LOCALE_STORAGE_KEY, code);
        } catch {
            // Ignore storage access errors.
        }

        setActiveLocale(code);
        setLocaleState(code);
    }, []);

    const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

    // Remount the subtree when the locale changes so every `t()` re-evaluates.
    // Placed below ApolloProvider, so the GraphQL cache survives the remount.
    return (
        <LocaleContext.Provider value={value}>
            <Fragment key={locale}>{children}</Fragment>
        </LocaleContext.Provider>
    );
}

export function useLocale(): LocaleContextValue {
    const context = useContext(LocaleContext);

    if (!context) {
        throw new Error('useLocale must be used within a LocaleProvider');
    }

    return context;
}
