import { useMemo } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  Loader2,
  MapPin,
  Phone,
  StickyNote,
} from "lucide-react";

function formatDate(value: unknown): string {
  if (!value) return "—";
  try {
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("pt-BR");
  } catch {
    return String(value);
  }
}

function statusFromExpiration(expirationDate: unknown) {
  if (!expirationDate) return { label: "Sem validade", tone: "slate" as const, days: null as number | null };
  const exp = new Date(String(expirationDate));
  if (Number.isNaN(exp.getTime())) return { label: "Data inválida", tone: "slate" as const, days: null };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  const days = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: `Vencido há ${Math.abs(days)} dia(s)`, tone: "red" as const, days };
  if (days <= 30) return { label: `Vence em ${days} dia(s)`, tone: "amber" as const, days };
  return { label: "Dentro da validade", tone: "emerald" as const, days };
}

/**
 * Página pública do QR da empresa.
 * Mostra dados operacionais úteis para a equipe (cliente, local, validade, inspeção) —
 * distinto da consulta oficial do selo Inmetro.
 */
export default function PublicExtinguisherPage() {
  const [, params] = useRoute("/e/:token");
  const token = params?.token || "";

  const query = trpc.publicExtinguisher.byToken.useQuery(
    { token },
    { enabled: Boolean(token), retry: false, staleTime: 30_000 },
  );

  const data = query.data as any;
  const status = useMemo(
    () => statusFromExpiration(data?.expirationDate),
    [data?.expirationDate],
  );

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center text-slate-600">
        Link inválido.
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-slate-600">
        <Loader2 className="h-8 w-8 animate-spin text-red-600" />
        <p className="text-sm">Carregando dados do extintor…</p>
      </div>
    );
  }

  if (query.isError || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md border-red-200">
          <CardHeader>
            <CardTitle className="text-lg text-red-700">Extintor não encontrado</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            Este QR Code não corresponde a um equipamento cadastrado ou o link expirou.
            Confira com a empresa responsável pela manutenção.
          </CardContent>
        </Card>
      </div>
    );
  }

  const badgeClass =
    status.tone === "red"
      ? "bg-red-100 text-red-800 border-red-200"
      : status.tone === "amber"
        ? "bg-amber-100 text-amber-900 border-amber-200"
        : status.tone === "emerald"
          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
          : "bg-slate-100 text-slate-700 border-slate-200";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-800 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-md space-y-4">
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-red-400">Ficha operacional</p>
          <h1 className="mt-1 text-2xl font-black text-white">Extintor da empresa</h1>
          <p className="mt-1 text-xs text-slate-400">
            Informações de gestão e manutenção — não substitui o selo Inmetro.
          </p>
        </div>

        <Card className="border-slate-700 bg-white text-slate-900 shadow-xl">
          <CardHeader className="space-y-3 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-red-600 p-2 text-white">
                  <Flame className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg leading-tight">
                    {data.typeModel || "Extintor"}
                    {data.capacity ? ` · ${data.capacity}` : ""}
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    {data.serialNumber ? `Selo / nº: ${data.serialNumber}` : `ID interno #${data.id}`}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={`shrink-0 text-[10px] ${badgeClass}`}>
                {status.tone === "red" ? (
                  <AlertTriangle className="mr-1 h-3 w-3" />
                ) : status.tone === "emerald" ? (
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                ) : (
                  <Clock className="mr-1 h-3 w-3" />
                )}
                {status.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-2 rounded-xl bg-slate-50 p-3">
              <div className="flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Cliente / unidade</p>
                  <p className="font-semibold text-slate-900">{data.clientName || "—"}</p>
                  {data.clientCity && <p className="text-xs text-slate-500">{data.clientCity}</p>}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Local no imóvel</p>
                  <p className="font-semibold text-slate-900">{data.locationInBuilding || "Não informado"}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-100 p-3">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  <Calendar className="h-3 w-3" /> Validade
                </p>
                <p className="mt-1 font-bold text-slate-900">{formatDate(data.expirationDate)}</p>
              </div>
              <div className="rounded-xl border border-slate-100 p-3">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  <Clock className="h-3 w-3" /> Última inspeção
                </p>
                <p className="mt-1 font-bold text-slate-900">{formatDate(data.lastInspectionDate)}</p>
              </div>
            </div>

            {(data.notes || data.companyName || data.companyPhone) && (
              <div className="space-y-2 rounded-xl border border-slate-100 p-3">
                {(data.companyName || data.companyPhone) && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Empresa responsável</p>
                    <p className="font-semibold text-slate-900">{data.companyName || "—"}</p>
                    {data.companyPhone && (
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-600">
                        <Phone className="h-3 w-3" />
                        <a className="underline" href={`tel:${data.companyPhone}`}>
                          {data.companyPhone}
                        </a>
                      </p>
                    )}
                  </div>
                )}
                {data.notes && (
                  <div>
                    <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                      <StickyNote className="h-3 w-3" /> Observações
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{data.notes}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-[11px] leading-relaxed text-slate-400">
          Esta ficha é gerada pelo sistema de gestão da empresa de manutenção.
          Para autenticidade do <strong className="text-slate-300">selo Inmetro</strong>, use o QR oficial impresso no
          equipamento.
        </p>
      </div>
    </div>
  );
}
