import { cn } from "@/lib/utils";

type BrandLogoProps = { variant?: "dark" | "light"; className?: string; iconOnly?: boolean; wordmarkOnly?: boolean; height?: number };

export function BrandLogo({ variant = "dark", className = "", iconOnly = false, height = 42 }: BrandLogoProps) {
  const ink = variant === "dark" ? "#5eead4" : "#0f766e";
  if (iconOnly) return <span aria-label="Promotores SaaS" className={cn("grid place-items-center rounded-xl bg-teal-400 font-black text-slate-950", className)} style={{ height, width: height }}>P</span>;
  return <span className={cn("inline-flex items-center gap-2 font-black tracking-tight", className)} style={{ fontSize: Math.max(18, height * .48) }}><span className="grid place-items-center rounded-xl bg-teal-400 font-black text-slate-950" style={{ height: height * .82, width: height * .82 }}>P</span><span style={{ color: variant === "dark" ? "white" : "#0f172a" }}>Promotores <strong style={{ color: ink }}>SaaS</strong></span></span>;
}

export const BRAND_NAME = "Promotores SaaS";
export const BRAND_TAGLINE = "Gestão de equipes de campo";
export const BRAND_FULL = "Promotores SaaS — Gestão de equipes de campo";
