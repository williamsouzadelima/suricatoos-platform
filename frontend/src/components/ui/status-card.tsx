import { type ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatusCardProps {
    action?: ReactNode;
    className?: string;
    description?: ReactNode;
    icon?: ReactNode;
    title: ReactNode;
}

export function StatusCard({ action, className, description, icon, title }: StatusCardProps) {
    return (
        <Card className={cn('', className)}>
            <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
                {icon && (
                    <div className="from-primary/12 to-brand/10 ring-border/60 shadow-soft mb-5 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br ring-1 [&_svg]:size-7 [&_svg]:text-primary">
                        {icon}
                    </div>
                )}
                <h3 className="text-foreground text-lg font-semibold tracking-tight">{title}</h3>
                {description && (
                    <div className="text-muted-foreground mt-2 max-w-sm text-sm text-balance">{description}</div>
                )}
                {action && <div className="mt-5">{action}</div>}
            </CardContent>
        </Card>
    );
}
