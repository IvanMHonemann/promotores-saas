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
      <span
        aria-label="GONDUP"
        className={cn("grid place-items-center rounded-lg bg-[#102019] font-black tracking-tight text-[#52e777]", className)}
        style={{ height, width: height, fontSize: height * 0.5 }}
      >
        G.
      </span>
    );
  }

  return (
    <img
      src={variant === "light" ? "/gondup-logo-light.svg" : "/gondup-logo.svg"}
      alt="GONDUP — da gôndola ao trade. Seu próximo upgrade."
      className={cn("block h-auto w-full object-contain object-left", className)}
      style={{ maxHeight: height }}
      draggable={false}
    />
  );
}

export const BRAND_NAME = "GONDUP";
export const BRAND_TAGLINE = "Da gôndola ao trade. Seu próximo upgrade.";
export const BRAND_FULL = `${BRAND_NAME} — ${BRAND_TAGLINE}`;
