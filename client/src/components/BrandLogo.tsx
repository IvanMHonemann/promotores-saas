import { cn } from "@/lib/utils";

const ASSET_V = "8";

type BrandLogoProps = {
  /** dark = fundo escuro (logo clara); light = fundo claro (logo escura) */
  variant?: "dark" | "light";
  className?: string;
  iconOnly?: boolean;
  wordmarkOnly?: boolean;
  height?: number;
};

/**
 * Marca Extinfy refeita (SVG + PNG), fundo transparente, sem marca d'água.
 */
export function BrandLogo({
  variant = "dark",
  className = "",
  iconOnly = false,
  wordmarkOnly = false,
  height = 48,
}: BrandLogoProps) {
  if (iconOnly) {
    return (
      <img
        src={`/icon-192.png?v=${ASSET_V}`}
        alt="Extinfy"
        className={cn("block bg-transparent object-contain", className)}
        style={{ height, width: height }}
        width={height}
        height={height}
        draggable={false}
      />
    );
  }

  // Prefer SVG (nítido em qualquer tamanho); PNG como fallback via mesmo nome só em wordmark raster
  const src = wordmarkOnly
    ? variant === "dark"
      ? `/logo-extinfy-word-dark.png?v=${ASSET_V}`
      : `/logo-extinfy-word-light.png?v=${ASSET_V}`
    : variant === "dark"
      ? `/logo-extinfy-dark.png?v=${ASSET_V}`
      : `/logo-extinfy-light.png?v=${ASSET_V}`;

  return (
    <img
      src={src}
      alt="Extinfy — Gestão de Extintores"
      className={cn("block bg-transparent object-contain", className)}
      style={{ height, width: "auto", maxWidth: "100%" }}
      height={height}
      draggable={false}
    />
  );
}

export const BRAND_NAME = "Extinfy";
export const BRAND_TAGLINE = "Gestão de Extintores";
export const BRAND_FULL = "Extinfy Gestão de Extintores";
