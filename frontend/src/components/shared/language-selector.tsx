import { Check, Globe } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocale } from '@/i18n';
import { LOCALES, type LocaleCode } from '@/i18n/locales';

/** Compact flag tabs — matches the inline theme switcher used in menus. */
export function LanguageTabs({ className }: { className?: string }) {
    const { locale, setLocale } = useLocale();

    return (
        <Tabs
            className={className}
            onValueChange={(value) => setLocale(value as LocaleCode)}
            value={locale}
        >
            <TabsList className="h-7 p-0.5">
                {LOCALES.map((item) => (
                    <TabsTrigger
                        aria-label={item.nativeLabel}
                        className="h-6 px-1.5 text-sm"
                        key={item.code}
                        value={item.code}
                    >
                        {item.flag}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
}

/** Standalone dropdown — flag + native name; used on the login screen. */
export function LanguageDropdown({ className }: { className?: string }) {
    const { locale, setLocale } = useLocale();
    const active = LOCALES.find((item) => item.code === locale) ?? LOCALES[0];

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    className={className}
                    size="sm"
                    variant="ghost"
                >
                    <Globe className="size-4" />
                    <span>{active.nativeLabel}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="min-w-40"
            >
                {LOCALES.map((item) => (
                    <DropdownMenuItem
                        key={item.code}
                        onClick={() => setLocale(item.code)}
                    >
                        <span className="mr-1 text-base leading-none">{item.flag}</span>
                        {item.nativeLabel}
                        {item.code === locale && <Check className="ml-auto size-4" />}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
