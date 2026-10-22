import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "dark" | "light";
  className?: string;
  /** Altura máxima em px. */
  height?: number;
  /** Só o ícone quadrado (G + UP). */
  iconOnly?: boolean;
  /** Força uma versão; por padrão escolhe pelo tamanho. */
  kind?: "full" | "wordmark" | "mark";
};

/**
 * Logo GondUp adaptativa: com slogan quando há espaço, só o nome em alturas pequenas
 * (menus, barras) e o ícone quadrado quando pedido. As imagens têm contorno próprio,
 * então funcionam em fundo claro e escuro.
 */
export function BrandLogo({ className, height = 56, iconOnly = false, kind }: BrandLogoProps) {
  const chosen = kind ?? (iconOnly ? "mark" : height <= 48 ? "wordmark" : "full");
  const src = chosen === "mark" ? "/icon-192.png" : chosen === "wordmark" ? "/gondup-wordmark.png" : "/gondup-logo.png";
  const alt = chosen === "full" ? "GondUp — da gôndola ao trade. Seu próximo upgrade." : "GondUp";
  return (
    <img
      src={src}
      alt={alt}
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
