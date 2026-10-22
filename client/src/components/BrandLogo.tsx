import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "dark" | "light";
  className?: string;
  height?: number;
  iconOnly?: boolean;
  wordmarkOnly?: boolean;
};

/** Identidade visual GONDUP, usando a arte oficial fornecida pelo proprietário. */
export function BrandLogo({ variant = "dark", className, height = 48, iconOnly = false }: BrandLogoProps) {
  if (iconOnly) {
    return (
      <img
        src="/gondup-logo.png"
        alt="GONDUP"
        className={cn("block object-contain", className)}
        style={{ height, width: height }}
        draggable={false}
      />
    );
  }

  return (
    <img
      src="/gondup-logo.png"
      alt="GONDUP — da gôndola ao trade. Seu próximo upgrade."
      className={cn("block h-auto w-auto object-contain object-left", className)}
      style={{ maxHeight: height }}
      draggable={false}
    />
  );
}

export const BRAND_NAME = "GONDUP";
export const BRAND_TAGLINE = "Da gôndola ao trade. Seu próximo upgrade.";
export const BRAND_FULL = `${BRAND_NAME} — ${BRAND_TAGLINE}`;
