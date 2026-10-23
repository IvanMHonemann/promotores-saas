import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "dark" | "light";
  className?: string;
  /** Altura máxima em px; a largura acompanha a proporção da imagem. */
  height?: number;
  iconOnly?: boolean;
  wordmarkOnly?: boolean;
};

/**
 * Logo GondUp (nome com contorno próprio, funciona em fundo claro e escuro).
 * Em alturas pequenas usa a versão leve da imagem; a proporção é sempre mantida.
 */
export function BrandLogo({ className, height = 56 }: BrandLogoProps) {
  return (
    <img
      src={height <= 36 ? "/gondup-logo-sm.png" : "/gondup-logo.png"}
      alt="GondUp"
      className={cn("block h-auto w-auto max-w-full object-contain", className)}
      style={{ maxHeight: height }}
      draggable={false}
      decoding="async"
    />
  );
}

export const BRAND_NAME = "GondUp";
export const BRAND_TAGLINE = "Da gôndola ao trade. Seu próximo upgrade.";
export const BRAND_FULL = `${BRAND_NAME} — ${BRAND_TAGLINE}`;
