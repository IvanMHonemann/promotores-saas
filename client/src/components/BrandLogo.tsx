import { cn } from "@/lib/utils";

type BrandLogoProps = {
  variant?: "dark" | "light";
  className?: string;
  height?: number;
  iconOnly?: boolean;
  wordmarkOnly?: boolean;
};

export function BrandLogo({ className, height = 56, iconOnly = false }: BrandLogoProps) {
  return (
    <img
      src="/gondup-logo.png"
      alt="GONDUP — da gôndola ao trade. Seu próximo upgrade."
      className={cn("block h-auto w-auto object-contain", className)}
      style={{ height: iconOnly ? height : undefined, maxHeight: iconOnly ? undefined : height }}
      draggable={false}
    />
  );
}

export const BRAND_NAME = "GONDUP";
export const BRAND_TAGLINE = "Da gôndola ao trade. Seu próximo upgrade.";
export const BRAND_FULL = `${BRAND_NAME} — ${BRAND_TAGLINE}`;
