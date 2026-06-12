export type LocaleCode = 'en' | 'es' | 'pt';

export interface LocaleMeta {
    code: LocaleCode;
    /** Native name shown in the language selector. */
    nativeLabel: string;
    /** `<html lang>` value. */
    lang: string;
    /** Emoji flag for compact display. */
    flag: string;
}

/** Order here is the order shown in the selector. Portuguese (Brazil) is the primary language. */
export const LOCALES: LocaleMeta[] = [
    { code: 'pt', nativeLabel: 'Português', lang: 'pt-BR', flag: '🇧🇷' },
    { code: 'en', nativeLabel: 'English', lang: 'en', flag: '🇺🇸' },
    { code: 'es', nativeLabel: 'Español', lang: 'es', flag: '🇪🇸' },
];

export const DEFAULT_LOCALE: LocaleCode = 'pt';

export const LOCALE_STORAGE_KEY = 'locale';

export function isLocaleCode(value: unknown): value is LocaleCode {
    return typeof value === 'string' && LOCALES.some((locale) => locale.code === value);
}

export function localeLang(code: LocaleCode): string {
    return LOCALES.find((locale) => locale.code === code)?.lang ?? 'pt-BR';
}
