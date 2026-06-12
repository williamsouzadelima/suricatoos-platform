import * as React from 'react';

import { cn } from '@/lib/utils';

export type InputProps = React.ComponentProps<'input'>;

function Input({ className, type, ...props }: InputProps) {
    return (
        <input
            className={cn(
                'border-input dark:bg-input/30 file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 hover:border-ring/40 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow,border-color] file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-[3px] focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
                type === 'number' &&
                    '[appearance:textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none',
                className,
            )}
            type={type}
            {...props}
        />
    );
}

export { Input };
