import type { BrandingFragmentFragment } from '@/graphql/types';

import type { Branding } from './ptes/engagement';

const stripHash = (color?: null | string): string | undefined => {
    if (!color) {
        return undefined;
    }
    const trimmed = color.trim().replace(/^#/, '');
    return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * Map the installation's persisted whitelabel branding (GraphQL) into the shape
 * the PTES report engine consumes. The engine expects brand colors as hex
 * WITHOUT a leading '#', while the settings UI / database store them WITH '#'.
 */
export function toEngagementBranding(
    branding: BrandingFragmentFragment | null | undefined,
    overrides?: Partial<Branding>,
): Branding {
    const base: Branding = {
        accent: stripHash(branding?.accentColor),
        appLogo: branding?.appLogo ?? undefined,
        appLogoOnDark: branding?.appLogoOnDark ?? undefined,
        appName: branding?.appName || 'Suricatoos',
        clientLogo: branding?.clientLogo ?? undefined,
        clientName: branding?.clientName ?? '',
        primary: stripHash(branding?.primaryColor),
    };

    return overrides ? { ...base, ...overrides } : base;
}
