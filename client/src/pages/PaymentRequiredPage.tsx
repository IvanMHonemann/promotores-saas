import { AlertTriangle, Loader2, LogOut } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { PaymentReminderPanel } from "@/components/PaymentReminderBanner";
import { BrandLogo } from "@/components/BrandLogo";

/** Tela exclusiva após o fim da tolerância: só pagamento (Pix / WhatsApp). */
export default function PaymentRequiredPage() {
  const { user, logout } = useAuth();
  const reminder = trpc.billing.paymentReminder.useQuery(undefined, {
    enabled: Boolean(user && user.role !== "platform_admin"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const access = trpc.billing.access.useQuery(undefined, {
    enabled: Boolean(user && user.role !== "platform_admin"),
    staleTime: 30_000,
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07111f] p-4 text-white">
      <section className="w-full max-w-xl rounded-3xl border border-rose-400/40 bg-slate-950/90 p-6 shadow-2xl shadow-rose-950/40">
        <div className="mb-4 flex items-center justify-between gap-3">
          <BrandLogo />
          <Button variant="ghost" className="text-slate-300" onClick={() => void logout()}>
            <LogOut className="mr-2 h-4 w-4" />Sair
          </Button>
        </div>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-rose-300" />
          <div>
            <h1 className="text-xl font-black tracking-tight">Acesso bloqueado por falta de pagamento</h1>
            <p className="mt-2 text-sm text-slate-300">
              {reminder.data?.message
                || access.data?.reason
                || "A tolerância após o vencimento acabou. Regularize o pagamento para liberar o GondUp novamente."}
            </p>
          </div>
        </div>
        {reminder.isLoading && (
          <p className="mt-6 flex items-center gap-2 text-sm text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" />Carregando dados do Pix…
          </p>
        )}
        {reminder.data && <PaymentReminderPanel reminder={reminder.data as any} />}
        {user?.role !== "company_admin" && (
          <p className="mt-4 rounded-xl bg-white/5 p-3 text-sm text-slate-300">
            Peça ao administrador da empresa ({user?.companyId ? "conta admin" : "responsável"}) para pagar o Pix e enviar o comprovante.
          </p>
        )}
      </section>
    </main>
  );
}
