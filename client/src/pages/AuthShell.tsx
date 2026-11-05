import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { BrandLogo } from "@/components/BrandLogo";

/** Moldura simples das telas públicas de autenticação (esqueci/redefinir senha). */
export function AuthShell({ title, subtitle, icon, children, backTo = "/login", backLabel = "Voltar ao login" }: { title: string; subtitle?: string; icon: ReactNode; children: ReactNode; backTo?: string; backLabel?: string }) {
  const [, navigate] = useLocation();
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07111f] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-900 p-6 shadow-2xl sm:p-10">
        <button type="button" onClick={() => navigate(backTo)} className="mb-8 flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> {backLabel}</button>
        <BrandLogo variant="dark" height={38} />
        <div className="mt-8 mb-6">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-300/10 text-teal-300">{icon}</div>
          <h1 className="text-2xl font-black">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-slate-400">{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
