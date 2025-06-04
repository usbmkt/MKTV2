// client/src/components/flow/utils.ts
import React from 'react';
import { LucideProps } from 'lucide-react';
import { cn } from "@/lib/utils";

// Constantes de Cor Neon (adaptadas de flow.tsx)
export const NEON_COLOR = 'hsl(207, 90%, 54%)';
export const NEON_GREEN = 'hsl(145, 100%, 45%)';
export const NEON_RED = 'hsl(0, 100%, 55%)';

// Estilos Base (adaptados de flow.tsx)
export const baseCardStyle = cn(
  "bg-card border border-[rgba(100,100,200,0.15)] shadow-[0_2px_8px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.07)] rounded-lg"
);
export const baseInputInsetStyle = cn(
  "bg-background/30 border border-border/50 shadow-inner rounded-md focus:border-primary focus:ring-1 focus:ring-primary"
);
export const baseButtonSelectStyle = cn(
  "bg-card hover:bg-muted/80 border border-border/70 shadow-sm focus:ring-1 focus:ring-primary focus:border-primary text-foreground"
);
export const popoverContentStyle = cn(
  baseCardStyle,
  "p-1 border-[rgba(100,100,200,0.25)] shadow-2xl"
);

export const customScrollbarStyle = cn(
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5",
  "[&::-webkit-scrollbar-track]:bg-transparent",
  "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb]:rounded-full",
  "[&::-webkit-scrollbar-thumb:hover]:bg-muted-foreground/50"
);

// Interface para as props do IconWithGlow
interface IconWithGlowProps extends Omit<LucideProps, 'icon'> { // Omit 'icon' se LucideProps tiver, para evitar conflito
  icon: React.ElementType; // O componente do ícone em si
  color?: string;
  glowOpacity?: number;
  // className é herdado de LucideProps
}

export const IconWithGlow: React.FC<IconWithGlowProps> = ({
  icon: IconElement, // Renomeado para clareza
  className,
  color,
  glowOpacity = 0.5,
  ...rest // Captura outras LucideProps como size, strokeWidth, etc.
}) => {
  const iconColor = color || NEON_COLOR;

  if (!IconElement || (typeof IconElement === 'string' && !/^[a-zA-Z]/.test(IconElement))) {
     console.error("IconWithGlow: 'icon' prop não é um componente React válido ou é uma string inválida para tag HTML.");
     return null;
  }

  // Forçando o tipo para 'any' como uma tentativa de workaround para o parser do ESBuild.
  // Isso pode mascarar problemas de tipo, mas pode ajudar a identificar se o erro é de parsing devido à inferência de tipo.
  const DynamicIconComponent: any = IconElement;

  return (
    <DynamicIconComponent
      className={cn("icon-with-glow", className)} // Esta é a linha que estava causando erro (linha 51 nos logs)
      style={{
        filter: `drop-shadow(0 0 4px hsla(${iconColor.replace('hsl(','').replace(')','').split(', ').map((v,i) => i === 2 ? v : v.replace('%','')).join(',')}, ${glowOpacity})) drop-shadow(0 0 8px hsla(${iconColor.replace('hsl(','').replace(')','').split(', ').map((v,i) => i === 2 ? v : v.replace('%','')).join(',')}, ${glowOpacity * 0.5}))`,
        color: iconColor,
      }}
      {...rest}
    />
  );
};
