import type { ReactNode } from 'react';

import { createContext, use } from 'react';

import type { BrandingFragmentFragment } from '@/graphql/types';

import { useBrandingQuery } from '@/graphql/types';
import { useUser } from '@/providers/user-provider';

interface BrandingContextType {
    branding: BrandingFragmentFragment | null;
    isLoading: boolean;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: ReactNode }) {
    const { isAuthenticated } = useUser();

    const { data, loading } = useBrandingQuery({
        skip: !isAuthenticated(),
    });

    return (
        <BrandingContext
            value={{
                branding: data?.branding ?? null,
                isLoading: loading,
            }}
        >
            {children}
        </BrandingContext>
    );
}

export function useBranding() {
    const context = use(BrandingContext);

    if (context === undefined) {
        throw new Error('useBranding must be used within a BrandingProvider');
    }

    return context;
}
