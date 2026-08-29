import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  material?: 'ultrathin' | 'thin' | 'regular' | 'thick' | 'ultrathick';
  glow?: 'none' | 'cyan' | 'crimson' | 'gold' | 'yellow' | 'orange' | 'green';
  concentricRadius?: 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'none';
  children?: React.ReactNode;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  material = 'regular',
  glow = 'none',
  concentricRadius = 'lg',
  className,
  children,
  ...props
}) => {
  const materialClass = {
    ultrathin: 'liquid-glass--ultrathin',
    thin: 'liquid-glass--thin',
    regular: 'liquid-glass',
    thick: 'liquid-glass--thick',
    ultrathick: 'liquid-glass--ultrathick',
  }[material];

  const glowClass = {
    none: '',
    cyan: 'glow-cyan border-cyan-400/30',
    crimson: 'glow-crimson border-crimson/40',
    gold: 'glow-gold border-yellow-400/40',
    yellow: 'glow-yellow border-yellow-400/30',
    orange: 'glow-orange border-orange-400/30',
    green: 'glow-green border-emerald-400/30',
  }[glow];

  const radiusClass = {
    none: 'rounded-none',
    sm: 'rounded-[10px]',
    md: 'rounded-[16px]',
    lg: 'rounded-[24px]',
    xl: 'rounded-[32px]',
    full: 'rounded-full',
  }[concentricRadius];

  return (
    <div
      className={twMerge(
        clsx(
          materialClass,
          glowClass,
          radiusClass,
          'transition-all duration-300'
        ),
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
