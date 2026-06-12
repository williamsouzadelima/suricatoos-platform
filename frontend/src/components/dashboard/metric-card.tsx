import type { ReactNode } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export function MetricCard({
    className,
    description,
    icon,
    loading,
    title,
    value,
}: {
    className?: string;
    description?: ReactNode;
    icon?: ReactNode;
    loading?: boolean;
    title: ReactNode;
    value: ReactNode;
}) {
    return (
        <Card className={cn('transition-shadow duration-200 hover:shadow-md', className)}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-muted-foreground text-sm font-medium">
                    {loading ? <Skeleton className="h-5 w-24" /> : title}
                </CardTitle>
                {loading ? (
                    <Skeleton className="size-8 shrink-0 rounded-lg" />
                ) : (
                    icon && (
                        <div className="bg-primary/10 flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4 [&_svg]:text-primary">
                            {icon}
                        </div>
                    )
                )}
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
                {loading ? (
                    <Skeleton className="h-8 w-24" />
                ) : (
                    <div className="text-2xl font-bold tracking-tight tabular-nums">{value}</div>
                )}
                {description &&
                    (loading ? (
                        <Skeleton className="mt-1 h-3 w-32" />
                    ) : (
                        <p className="text-muted-foreground text-xs">{description}</p>
                    ))}
            </CardContent>
        </Card>
    );
}
