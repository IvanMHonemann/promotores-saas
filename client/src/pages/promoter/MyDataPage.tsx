import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { downloadBase64, fmtDateTimeSP } from "@/lib/downloadBase64";
import { PRIVACY_NOTICE_SECTIONS, PRIVACY_NOTICE_TITLE, PRIVACY_NOTICE_VERSION } from "@shared/privacyNotice";

const KIND: Record<string, string> = { export: "Quero uma cópia dos meus dados", correction: "Quero corrigir um dado errado", anonymize: "Quero que apaguem/anonimizem meus dados", info: "Tenho uma dúvida sobre meus dados" };
const STATUS: Record<string, string> = { open: "Aberto", done: "Atendido", rejected: "Recusado" };

/** Direitos do titular (LGPD art. 18) para o promotor. */
export default function MyDataPage() {
  const notice = trpc.lgpd.noticeStatus.useQuery();
  const mine = trpc.lgpd.myRequests.useQuery();
  const exp = trpc.lgpd.exportMine.useMutation();
  const create = trpc.lgpd.createRequest.useMutation();
  const [kind, setKind] = useState<"export" | "correction" | "anonymize" | "info">("correction");
  const [message, setMessage] = useState("");

  const baixar = async () => {
    try { const r = await exp.mutateAsync(); downloadBase64(r.base64, r.fileName, "application/zip"); toast.success("Pacote baixado (ZIP com resumo em PDF e dados completos)."); }
    catch (e: any) { toast.error(e?.message || "Não foi possível gerar a cópia."); }
  };
  const enviar = async () => {
    try { await create.mutateAsync({ kind, message: message.trim() || undefined }); setMessage(""); toast.success("Pedido enviado ao administrador da sua empresa."); await mine.refetch(); }
    catch (e: any) { toast.error(e?.message || "Não foi possível enviar."); }
  };

  return (
    <DashboardLayout title="Meus dados (LGPD)" description="Veja como seus dados são usados e exerça seus direitos.">
      <div className="space-y-4 text-white">
        <Card className="border-white/10 bg-slate-900/70">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Download className="h-4 w-4 text-teal-300" />Cópia dos meus dados</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-300">
            <p>Baixe agora um pacote com tudo o que o sistema guarda sobre você: um resumo em PDF e um arquivo com os dados completos.</p>
            <Button onClick={() => void baixar()} disabled={exp.isPending}>{exp.isPending ? "Gerando..." : "Baixar meus dados"}</Button>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-900/70">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Send className="h-4 w-4 text-teal-300" />Fazer um pedido</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <select value={kind} onChange={(e) => setKind(e.target.value as any)} className="w-full rounded-md border border-white/20 bg-slate-800 px-2 py-2">
              {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {kind === "anonymize" && <p className="rounded-lg border border-amber-300/30 bg-amber-400/10 p-2 text-xs text-amber-100">Atenção: suas marcações de ponto e dados do contrato precisam ser guardados por lei (pelo menos 5 anos após o fim do contrato) e não serão apagados. O restante (contato, fotos, localização de visitas) pode ser eliminado.</p>}
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} placeholder="Explique o que você precisa (opcional)" className="h-24 w-full rounded-md border border-white/20 bg-slate-800 p-2" />
            <Button onClick={() => void enviar()} disabled={create.isPending}>Enviar pedido</Button>
            {(mine.data || []).map((r: any) => (
              <div key={r.id} className="rounded-lg border border-white/10 p-2 text-xs">
                <p className="font-semibold">{KIND[r.kind] || r.kind} · {STATUS[r.status] || r.status}</p>
                <p className="text-slate-400">Enviado em {fmtDateTimeSP(r.createdAt)}{r.resolvedAt ? ` · respondido em ${fmtDateTimeSP(r.resolvedAt)}` : ""}</p>
                {r.resolution && <p className="text-slate-300">Resposta: {r.resolution}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-900/70">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-teal-300" />{PRIVACY_NOTICE_TITLE}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            <p className="text-xs text-slate-400">Versão {PRIVACY_NOTICE_VERSION}{notice.data?.acknowledgedAt ? ` · você registrou ciência em ${fmtDateTimeSP(notice.data.acknowledgedAt)}` : ""}</p>
            {PRIVACY_NOTICE_SECTIONS.map((s) => <section key={s.title}><h3 className="font-bold text-white">{s.title}</h3><p>{s.body}</p></section>)}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
