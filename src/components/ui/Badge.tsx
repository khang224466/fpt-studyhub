import React from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'emerald' | 'cyan' | 'indigo' | 'amber' | 'rose' | 'slate';
  size?: 'sm' | 'md';
}

export function Badge({
  className,
  variant = 'emerald',
  size = 'sm',
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    emerald: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
    cyan: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60',
    indigo: 'bg-indigo-950/60 text-indigo-300 border-indigo-800/60',
    amber: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
    rose: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
    slate: 'bg-slate-800/60 text-slate-300 border-slate-700/60'
  };

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-0.5 rounded-full border font-medium',
    md: 'text-sm px-3 py-1 rounded-full border font-semibold'
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 transition-colors',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
