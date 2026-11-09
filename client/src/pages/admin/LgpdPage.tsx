import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Inbox, ShieldCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { downloadBase64, fmtDateTimeSP } from "@/lib/downloadBase64";
import { PRIVACY_NOTICE_VERSION } from "@shared/privacyNotice";

const KIND: Record<string, string> = { export: "Cópia dos dados", correction: "Correção", anonymize: "Eliminação/anonimização", info: "Dúvida" };

/** LGPD para o administrador: pedidos dos titulares, ciência do aviso, exportação e anonimização. */
export default function LgpdPage() {
  const [showAll, setShowAll] = useState(false);
  const requests = trpc.lgpd.requests.useQuery({ status: showAll ? "all" : "open" });
  const people = trpc.lgpd.acknowledgements.useQuery();
  const plan = trpc.lgpd.plan.useQuery();
  const exp = trpc.lgpd.exportMember.useMutation();
  const anon = trpc.lgpd.anonymizeMember.useMutation();
  const resolve = trpc.lgpd.resolveRequest.useMutation();
  const [target, setTarget] = useState<{ id: number; name: string; requestId?: number } | null>(null);
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");

  const exportar = async (memberId: number) => {
    try { const r = await exp.mutateAsync({ memberId }); downloadBase64(r.base64, r.fileName, "application/zip"); toast.success("Pacote gerado: entregue ao titular por um canal seguro."); }
    catch (e: any) { toast.error(e?.message || "Falha ao exportar."); }
  };
  const anonimizar = async () => {
    if (!target) return;
    try {
      const r = await anon.mutateAsync({ memberId: target.id, confirm: "ANONIMIZAR", reason, requestId: target.requestId });
      toast.success(`Dados anonimizados. O titular agora aparece como “${r.pseudonym}”.`);
      setTarget(null); setConfirm(""); setReason("");
      await Promise.all([requests.refetch(), people.refetch()]);
    } catch (e: any) { toast.error(e?.message || "Falha ao anonimizar."); }
  };
  const responder = async (id: number, status: "done" | "rejected") => {
    const resolution = window.prompt(status === "done" ? "Como o pedido foi atendido? (o titular verá esta resposta)" : "Por que o pedido foi recusado? (o titular verá esta resposta)");
    if (!resolution || resolution.trim().length < 3) return;
    try { await resolve.mutateAsync({ id, status, resolution }); await requests.refetch(); toast.success("Resposta registrada."); } catch (e: any) { toast.error(e?.message); }
  };

  return (
    <DashboardLayout title="LGPD e privacidade" description="Pedidos dos funcionários, ciência do aviso de privacidade, exportação e anonimização de dados.">
      <div className="space-y-4 text-white">
        <Card className="border-white/10 bg-slate-900/70">
          <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2 text-base"><Inbox className="h-4 w-4 text-teal-300" />Pedidos dos titulares</CardTitle>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />Mostrar respondidos</label></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-xs text-slate-400">Sua empresa é a controladora e deve responder ao funcionário. Prazo de referência: 15 dias para a cópia completa (LGPD art. 19, II).</p>
            {(requests.data || []).map((r: any) => (
              <div key={r.id} className="rounded-lg border border-white/10 p-3">
                <p className="font-semibold">{r.name} · {KIND[r.kind] || r.kind} <span className="text-xs text-slate-400">({fmtDateTimeSP(r.createdAt)})</span></p>
                {r.message && <p className="text-slate-300">“{r.message}”</p>}
                {r.status !== "open" ? <p className="text-xs text-slate-400">{r.status === "done" ? "Atendido" : "Recusado"} por {r.resolvedBy || "—"} em {fmtDateTimeSP(r.resolvedAt)}: {r.resolution}</p> : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => void exportar(r.memberAccountId)}><Download className="mr-1 h-4 w-4" />Exportar dados</Button>
                    {r.kind === "anonymize" && <Button size="sm" variant="destructive" onClick={() => setTarget({ id: r.memberAccountId, name: r.name, requestId: r.id })}><UserX className="mr-1 h-4 w-4" />Anonimizar</Button>}
                    <Button size="sm" variant="outline" onClick={() => void responder(r.id, "done")}>Marcar como atendido</Button>
                    <Button size="sm" variant="outline" onClick={() => void responder(r.id, "rejected")}>Recusar</Button>
                  </div>
                )}
              </div>
            ))}
            {requests.data && !requests.data.length && <p className="text-slate-400">Nenhum pedido {showAll ? "" : "em aberto"}.</p>}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-900/70">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-teal-300" />Funcionários: ciência do aviso (versão {PRIVACY_NOTICE_VERSION})</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-xs text-slate-400">O aviso aparece no primeiro acesso de cada promotor e de novo quando o texto muda. Ciência não é consentimento: o ponto segue a obrigação legal.</p>
            {(people.data || []).map((p: any) => (
              <div key={p.memberId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-2">
                <span>{p.name}{!Number(p.active) ? " (inativo)" : ""} · <span className={p.acknowledgedAt ? "text-emerald-300" : "text-amber-300"}>{p.acknowledgedAt ? `ciente em ${fmtDateTimeSP(p.acknowledgedAt)}` : "ainda não viu o aviso atual"}</span></span>
                <span className="flex gap-2">
                  <Button size="sm" variant="secondary" disabled={exp.isPending} onClick={() => void exportar(p.memberId)}><Download className="mr-1 h-4 w-4" />Exportar</Button>
                  {!String(p.name).startsWith("Titular anonimizado") && <Button size="sm" variant="outline" onClick={() => setTarget({ id: p.memberId, name: p.name })}><UserX className="mr-1 h-4 w-4" />Anonimizar</Button>}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        {target && (
          <Card className="border-rose-300/40 bg-rose-950/40">
            <CardHeader><CardTitle className="text-base">Anonimizar {target.name}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-rose-100">Esta ação não pode ser desfeita. Baixe a exportação antes, se precisar entregar uma cópia.</p>
              {plan.data && <div className="grid gap-3 md:grid-cols-2">
                <div><p className="font-bold">Será apagado</p><ul className="list-disc pl-5 text-xs">{plan.data.apaga.map((t) => <li key={t}>{t}</li>)}</ul></div>
                <div><p className="font-bold">Será mantido (obrigação legal)</p><ul className="list-disc pl-5 text-xs">{plan.data.mantem.map((t) => <li key={t}>{t}</li>)}</ul></div>
              </div>}
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (ex.: pedido do titular de 05/11/2026, contrato encerrado)" className="w-full rounded-md border border-white/20 bg-slate-800 p-2" />
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Digite ANONIMIZAR para confirmar" className="w-full rounded-md border border-white/20 bg-slate-800 p-2" />
              <div className="flex gap-2">
                <Button variant="destructive" disabled={confirm !== "ANONIMIZAR" || reason.trim().length < 5 || anon.isPending} onClick={() => void anonimizar()}>Anonimizar agora</Button>
                <Button variant="outline" onClick={() => setTarget(null)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
