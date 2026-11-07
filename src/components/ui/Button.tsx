import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const variantStyles = {
    primary: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 border border-emerald-500/30',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/80',
    outline: 'bg-transparent hover:bg-slate-800/80 text-slate-300 border border-slate-700 hover:text-white',
    ghost: 'bg-transparent hover:bg-slate-800/50 text-slate-300 hover:text-white border-transparent',
    danger: 'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-600/40'
  };

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 rounded-lg font-medium gap-1.5',
    md: 'text-sm px-4 py-2.5 rounded-xl font-medium gap-2',
    lg: 'text-base px-6 py-3.5 rounded-xl font-semibold gap-2.5'
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
