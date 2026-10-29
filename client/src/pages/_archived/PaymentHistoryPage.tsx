import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function PaymentHistoryPage() {
  const [, navigate] = useLocation();
  const payments = trpc.billing.payments.useQuery();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/minha-assinatura")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-2xl font-semibold">Histórico de pagamentos</h1>
        </div>
        {payments.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-red-500" /></div>
        ) : (payments.data || []).length === 0 ? (
          <p className="text-slate-400">Nenhum pagamento registrado.</p>
        ) : (
          <div className="space-y-3">
            {(payments.data || []).map((p) => (
              <Card key={p.id} className="bg-slate-900 border-slate-700">
                <CardHeader className="py-3">
                  <CardTitle className="text-base flex justify-between">
                    <span>#{p.id} — {p.status}</span>
                    <span>R$ {Number(p.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-400 pb-3">
                  Tipo: {p.billingType} · Vencimento: {p.dueDate ? String(p.dueDate).slice(0, 10) : "—"} · Pagamento: {p.paymentDate ? String(p.paymentDate).slice(0, 10) : "—"}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
