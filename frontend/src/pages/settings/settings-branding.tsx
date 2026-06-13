import { ImageIcon, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useBrandingQuery, useUpdateBrandingMutation } from '@/graphql/types';
import { t } from '@/i18n';

// Accepted logo formats and a soft size budget. Logos are stored as data URIs
// inside the branding row, so we keep them small to avoid bloating payloads.
const ACCEPTED_LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const MAX_LOGO_BYTES = 1_500_000; // ~1.5 MB raw file
const WARN_LOGO_BYTES = 512_000; // 512 KB — still fine, just heavier

interface BrandingForm {
    accentColor: string;
    appLogo: null | string;
    appLogoOnDark: null | string;
    appName: string;
    clientLogo: null | string;
    clientName: string;
    primaryColor: string;
}

const DEFAULT_FORM: BrandingForm = {
    accentColor: '#FF7678',
    appLogo: null,
    appLogoOnDark: null,
    appName: 'Suricatoos',
    clientLogo: null,
    clientName: '',
    primaryColor: '#194FE3',
};

const normalizeHex = (value: string): string => {
    const v = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
        return v.toUpperCase();
    }
    if (/^[0-9a-fA-F]{6}$/.test(v)) {
        return `#${v.toUpperCase()}`;
    }
    return value;
};

function readFileAsDataUri(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('read error'));
        reader.readAsDataURL(file);
    });
}

interface LogoFieldProps {
    description: string;
    label: string;
    onChange: (dataUri: null | string) => void;
    /** Render the preview on a dark surface (for the dark-background variant). */
    onDark?: boolean;
    value: null | string;
}

function LogoField({ description, label, onChange, onDark = false, value }: LogoFieldProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File | undefined) => {
        if (!file) {
            return;
        }
        if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
            toast.error(t('Unsupported image format. Use PNG, JPG, SVG or WebP.'));
            return;
        }
        if (file.size > MAX_LOGO_BYTES) {
            toast.error(t('Image is too large (max 1.5 MB).'));
            return;
        }
        if (file.size > WARN_LOGO_BYTES) {
            toast.warning(t('Large image — consider a smaller logo for lighter reports.'));
        }
        try {
            const dataUri = await readFileAsDataUri(file);
            onChange(dataUri);
        } catch {
            toast.error(t('Could not read the image file.'));
        }
    };

    return (
        <div className="flex flex-col gap-2">
            <Label>{label}</Label>
            <div className="flex items-center gap-4">
                <div
                    className={`flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border ${
                        onDark ? 'bg-slate-900' : 'bg-muted/40'
                    }`}
                >
                    {value ? (
                        <img
                            alt={label}
                            className="size-full object-contain p-1.5"
                            src={value}
                        />
                    ) : (
                        <ImageIcon className="text-muted-foreground size-7" />
                    )}
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <Button
                            onClick={() => inputRef.current?.click()}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            <Upload className="size-3.5" />
                            {value ? t('Replace') : t('Upload')}
                        </Button>
                        {value && (
                            <Button
                                onClick={() => onChange(null)}
                                size="sm"
                                type="button"
                                variant="ghost"
                            >
                                <Trash2 className="size-3.5" />
                                {t('Remove')}
                            </Button>
                        )}
                    </div>
                    <span className="text-muted-foreground text-xs">{description}</span>
                </div>
                <input
                    accept={ACCEPTED_LOGO_TYPES.join(',')}
                    className="hidden"
                    onChange={(e) => {
                        void handleFile(e.target.files?.[0]);
                        e.target.value = '';
                    }}
                    ref={inputRef}
                    type="file"
                />
            </div>
        </div>
    );
}

interface ColorFieldProps {
    label: string;
    onChange: (hex: string) => void;
    value: string;
}

function ColorField({ label, onChange, value }: ColorFieldProps) {
    return (
        <div className="flex flex-col gap-2">
            <Label>{label}</Label>
            <div className="flex items-center gap-2">
                <input
                    aria-label={label}
                    className="size-9 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
                    onChange={(e) => onChange(e.target.value.toUpperCase())}
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
                />
                <Input
                    className="w-32 font-mono uppercase"
                    onBlur={(e) => onChange(normalizeHex(e.target.value))}
                    onChange={(e) => onChange(e.target.value)}
                    value={value}
                />
            </div>
        </div>
    );
}

function CoverPreview({ form }: { form: BrandingForm }) {
    const darkLogo = form.appLogoOnDark ?? form.appLogo;
    const initials = (form.clientName || 'Cliente')
        .split(/\s+/)
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <div className="overflow-hidden rounded-lg border shadow-sm">
            {/* Dark cover header — mirrors the report cover */}
            <div
                className="relative flex flex-col gap-6 p-5 text-white"
                style={{ background: `linear-gradient(135deg, #0F172A 0%, ${form.primaryColor} 140%)` }}
            >
                <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center overflow-hidden rounded-md bg-white/95">
                        {darkLogo ? (
                            <img
                                alt="app"
                                className="size-full object-contain p-1"
                                src={darkLogo}
                            />
                        ) : (
                            <ImageIcon className="size-5 text-slate-400" />
                        )}
                    </div>
                    <span className="text-sm font-semibold tracking-wide">{form.appName || 'Suricatoos'}</span>
                </div>

                <div className="flex flex-col gap-1">
                    <span
                        className="inline-flex w-fit rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                        style={{ backgroundColor: form.accentColor }}
                    >
                        {t('Confidential')}
                    </span>
                    <h3 className="mt-1 text-lg leading-tight font-bold">{t('Penetration Test Report')}</h3>
                    <span className="text-xs text-white/70">PTES · v1.0</span>
                </div>

                <div className="flex items-center gap-2 border-t border-white/15 pt-3">
                    <div
                        className="flex size-8 items-center justify-center overflow-hidden rounded bg-white/95 text-[10px] font-bold"
                        style={{ color: form.primaryColor }}
                    >
                        {form.clientLogo ? (
                            <img
                                alt="client"
                                className="size-full object-contain p-0.5"
                                src={form.clientLogo}
                            />
                        ) : (
                            initials
                        )}
                    </div>
                    <span className="text-xs text-white/80">{form.clientName || t('Client name')}</span>
                </div>
            </div>

            {/* Light body with palette chips */}
            <div className="bg-card flex items-center gap-2 p-3">
                <span className="text-muted-foreground text-[11px]">{t('Palette')}:</span>
                <span
                    className="h-4 w-8 rounded"
                    style={{ backgroundColor: form.primaryColor }}
                />
                <span
                    className="h-4 w-8 rounded"
                    style={{ backgroundColor: form.accentColor }}
                />
                <span className="h-4 w-8 rounded bg-[#0F172A]" />
            </div>
        </div>
    );
}

function SettingsBranding() {
    const { data, loading } = useBrandingQuery();
    const [updateBranding, { loading: saving }] = useUpdateBrandingMutation();

    const [form, setForm] = useState<BrandingForm>(DEFAULT_FORM);
    const [baseline, setBaseline] = useState<BrandingForm>(DEFAULT_FORM);
    const seededVersion = useRef<unknown>(null);

    // Seed the form from the server whenever the persisted version changes
    // (initial load and after a successful save). This also clears the dirty state.
    useEffect(() => {
        const b = data?.branding;
        if (!b) {
            return;
        }
        if (seededVersion.current === b.updatedAt) {
            return;
        }
        seededVersion.current = b.updatedAt;
        const seeded: BrandingForm = {
            accentColor: b.accentColor || DEFAULT_FORM.accentColor,
            appLogo: b.appLogo ?? null,
            appLogoOnDark: b.appLogoOnDark ?? null,
            appName: b.appName || DEFAULT_FORM.appName,
            clientLogo: b.clientLogo ?? null,
            clientName: b.clientName ?? '',
            primaryColor: b.primaryColor || DEFAULT_FORM.primaryColor,
        };
        setForm(seeded);
        setBaseline(seeded);
    }, [data?.branding]);

    const set = <K extends keyof BrandingForm>(key: K, value: BrandingForm[K]) =>
        setForm((prev) => ({ ...prev, [key]: value }));

    const isDirty = JSON.stringify(form) !== JSON.stringify(baseline);

    const handleSave = async () => {
        if (!form.appName.trim()) {
            toast.error(t('Application name is required.'));
            return;
        }
        try {
            await updateBranding({
                awaitRefetchQueries: true,
                refetchQueries: ['branding'],
                variables: {
                    input: {
                        accentColor: normalizeHex(form.accentColor),
                        appLogo: form.appLogo,
                        appLogoOnDark: form.appLogoOnDark,
                        appName: form.appName.trim(),
                        clientLogo: form.clientLogo,
                        clientName: form.clientName.trim() || null,
                        primaryColor: normalizeHex(form.primaryColor),
                    },
                },
            });
            toast.success(t('Branding saved.'));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('Failed to save branding.'));
        }
    };

    return (
        <div className="mx-auto max-w-5xl">
            <div className="mb-6">
                <h2 className="text-xl font-semibold">{t('Branding')}</h2>
                <p className="text-muted-foreground text-sm">
                    {t('Customize the brand identity used across the app and your generated reports (whitelabel).')}
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
                <div className="flex flex-col gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('Brand identity')}</CardTitle>
                            <CardDescription>
                                {t('The application name and colors applied to report covers, charts and headers.')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="appName">{t('Application name')}</Label>
                                <Input
                                    id="appName"
                                    onChange={(e) => set('appName', e.target.value)}
                                    placeholder="Suricatoos"
                                    value={form.appName}
                                />
                            </div>
                            <div className="flex flex-wrap gap-6">
                                <ColorField
                                    label={t('Primary color')}
                                    onChange={(v) => set('primaryColor', v)}
                                    value={form.primaryColor}
                                />
                                <ColorField
                                    label={t('Accent color')}
                                    onChange={(v) => set('accentColor', v)}
                                    value={form.accentColor}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('Application logos')}</CardTitle>
                            <CardDescription>
                                {t('Used on the app UI and as the publisher logo on every report. The dark variant is used on the report cover.')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-5">
                            <LogoField
                                description={t('Shown on light backgrounds. PNG or SVG recommended.')}
                                label={t('Logo (light background)')}
                                onChange={(v) => set('appLogo', v)}
                                value={form.appLogo}
                            />
                            <Separator />
                            <LogoField
                                description={t('Optional. Shown on dark backgrounds such as the report cover.')}
                                label={t('Logo (dark background)')}
                                onChange={(v) => set('appLogoOnDark', v)}
                                onDark
                                value={form.appLogoOnDark}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>{t('Default client (co-branding)')}</CardTitle>
                            <CardDescription>
                                {t('Optional default client used to personalize reports. Can be overridden per report.')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="clientName">{t('Client name')}</Label>
                                <Input
                                    id="clientName"
                                    onChange={(e) => set('clientName', e.target.value)}
                                    placeholder={t('e.g. ACME Corporation')}
                                    value={form.clientName}
                                />
                            </div>
                            <LogoField
                                description={t('The client logo for co-branded, personalized reports.')}
                                label={t('Client logo')}
                                onChange={(v) => set('clientLogo', v)}
                                value={form.clientLogo}
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* Live preview */}
                <div className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
                    <span className="text-muted-foreground text-xs font-medium uppercase">{t('Live preview')}</span>
                    <CoverPreview form={form} />
                </div>
            </div>

            <div className="bg-background sticky bottom-0 mt-6 flex items-center justify-end gap-2 border-t py-4">
                <Button
                    disabled={!isDirty || saving}
                    onClick={() => setForm(baseline)}
                    type="button"
                    variant="outline"
                >
                    <RotateCcw className="size-4" />
                    {t('Reset')}
                </Button>
                <Button
                    disabled={!isDirty || saving || loading}
                    onClick={() => void handleSave()}
                    type="button"
                >
                    <Save className="size-4" />
                    {saving ? t('Saving…') : t('Save changes')}
                </Button>
            </div>
        </div>
    );
}

export default SettingsBranding;
