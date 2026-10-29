import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

const money = (v: unknown) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const day = (v: unknown) => (v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—");

export default function PlatformPaymentsPage() {
  const list = trpc.platformPayments.list.useQuery(undefined, { staleTime: 15000 });
  const [q, setQ] = useState("");
  const rows = useMemo(() => (list.data || []).filter((p: any) => String(p.companyName).toLowerCase().includes(q.trim().toLowerCase())), [list.data, q]);
  const total = rows.reduce((a: number, p: any) => a + (["RECEIVED", "CONFIRMED", "MOCK_APPROVED"].includes(p.status) ? Number(p.amount) : 0), 0);
  return <DashboardLayout title="Pagamentos" description="Todos os pagamentos das empresas. Registre novos pagamentos na tela Empresas." refreshing={list.isFetching} onRefresh={() => void list.refetch()}>
    <Card className="border-white/10 bg-slate-900/70 text-white"><CardContent className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><Input aria-label="Buscar empresa" placeholder="Buscar empresa" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs border-white/15 bg-slate-950/60 text-white" /><p className="text-sm text-slate-300">Recebido na lista: <b className="text-white">{money(total)}</b></p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="text-left text-xs text-slate-400"><tr><th className="p-2">Empresa</th><th className="p-2">Valor</th><th className="p-2">Pago em</th><th className="p-2">Período a partir de</th><th className="p-2">Forma</th><th className="p-2">Situação</th></tr></thead><tbody>
        {rows.map((p: any) => <tr key={p.id} className="border-t border-white/5"><td className="p-2 font-semibold">{p.companyName}</td><td className="p-2">{money(p.amount)}</td><td className="p-2">{day(p.paymentDate)}</td><td className="p-2">{day(p.dueDate)}</td><td className="p-2">{p.billingType}</td><td className="p-2">{p.status}</td></tr>)}
      </tbody></table>{!rows.length && !list.isLoading && <p className="p-4 text-center text-sm text-slate-400">Nenhum pagamento encontrado.</p>}</div>
    </CardContent></Card>
  </DashboardLayout>;
}
