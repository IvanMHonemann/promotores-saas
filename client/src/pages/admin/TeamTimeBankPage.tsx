import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { ArrowLeft, ChevronRight, Download, Search, TrendingDown, TrendingUp, Minus, Clock3 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { todayInZone } from "@shared/expiry";
import { filterAndSortTeamBank, formatSignedMinutes, teamBankCsv } from "@shared/timeBank";

const selectCls = "h-11 rounded-md border border-white/15 bg-slate-950/60 px-3 text-base text-white sm:h-10 sm:text-sm";
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const hm = (m: number | null | undefined) => (m == null ? "—" : formatSignedMinutes(m).replace("+", ""));
const tone = (m: number) => (m > 0 ? "text-emerald-300" : m < 0 ? "text-rose-300" : "text-slate-200");
const fmtDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "sem marcação");
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

function monthOptions(current: string) {
  const [y, m] = current.split("-").map(Number);
  return Array.from({ length: 13 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 15));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
    return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
  });
}

function useMonth() {
  const current = todayInZone().slice(0, 7);
  const fromUrl = new URLSearchParams(window.location.search).get("mes");
  const [month, setMonthState] = useState(fromUrl && /^\d{4}-\d{2}$/.test(fromUrl) ? fromUrl : current);
  const setMonth = (m: string) => {
    setMonthState(m);
    const url = new URL(window.location.href);
    url.searchParams.set("mes", m);
    window.history.replaceState(null, "", url.toString());
  };
  return { month, setMonth, current };
}

function BalanceBadge({ minutes, configured }: { minutes: number; configured: boolean }) {
  if (!configured) return <span className="text-xs font-semibold text-amber-200">Jornada não configurada</span>;
  const Icon = minutes > 0 ? TrendingUp : minutes < 0 ? TrendingDown : Minus;
  return <span className={`inline-flex items-center gap-1 text-lg font-black tabular-nums ${tone(minutes)}`}><Icon className="h-4 w-4" />{formatSignedMinutes(minutes)}</span>;
}

export default function TeamTimeBankPage() {
  const params = useParams<{ memberId?: string }>();
  const memberId = params.memberId ? Number(params.memberId) : null;
  return memberId ? <MemberDetail memberId={memberId} /> : <TeamList />;
}

function TeamList() {
  const { month, setMonth, current } = useMonth();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"balance_desc" | "balance_asc" | "name">("balance_desc");
  const query = trpc.timesheetMirror.teamTimeBank.useQuery({ month }, { staleTime: 30000 });
  const rows = useMemo(() => filterAndSortTeamBank(query.data?.rows || [], search, sort), [query.data, search, sort]);
  const totals = useMemo(() => rows.reduce((a, r) => ({ credit: a.credit + r.overtimeMinutes, debit: a.debit + r.deficitMinutes, balance: a.balance + r.balanceMinutes }), { credit: 0, debit: 0, balance: 0 }), [rows]);

  const exportCsv = () => {
    const blob = new Blob([teamBankCsv(rows, month)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `banco-de-horas-${month}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <DashboardLayout title="Banco de horas" description="Saldo de horas de cada funcionário no mês (dias fechados)." onRefresh={() => void query.refetch()}>
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input aria-label="Buscar funcionário" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar funcionário" className="h-11 border-white/15 bg-slate-950/70 pl-10 text-white placeholder:text-slate-500" />
          </div>
          <select aria-label="Mês" value={month} onChange={(e) => setMonth(e.target.value)} className={selectCls}>
            {monthOptions(current).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value as any)} className={selectCls}>
            <option value="balance_desc">Maior saldo primeiro</option>
            <option value="balance_asc">Menor saldo primeiro</option>
            <option value="name">Nome (A–Z)</option>
          </select>
          <Button type="button" variant="outline" className="h-11 border-white/20 text-white sm:h-10" onClick={exportCsv} disabled={!rows.length}><Download className="mr-1 h-4 w-4" />CSV</Button>
        </div>

        {query.data && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3"><p className="text-[11px] font-bold uppercase text-slate-400">Créditos</p><p className="text-base font-black tabular-nums text-emerald-300">{hm(totals.credit)}</p></div>
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3"><p className="text-[11px] font-bold uppercase text-slate-400">Débitos</p><p className="text-base font-black tabular-nums text-rose-300">{hm(totals.debit)}</p></div>
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3"><p className="text-[11px] font-bold uppercase text-slate-400">Saldo</p><p className={`text-base font-black tabular-nums ${tone(totals.balance)}`}>{formatSignedMinutes(totals.balance)}</p></div>
          </div>
        )}

        {query.isLoading && <p className="text-sm text-slate-300">Calculando banco de horas…</p>}
        {query.isError && <p className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">Não foi possível carregar o banco de horas. {query.error?.message}</p>}
        {query.isSuccess && !rows.length && <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-slate-300">{search ? "Nenhum funcionário com esse nome." : "Nenhum funcionário com ponto nesta empresa."}</p>}

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
          {rows.map((r) => (
            <Link key={r.id} href={`/banco-de-horas/${r.id}?mes=${month}`} className="flex items-center gap-3 border-b border-white/5 px-3 py-3 transition last:border-b-0 hover:bg-white/5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">{r.name}{!r.active && <span className="ml-2 text-xs font-normal text-slate-400">(inativo)</span>}</span>
                <span className="block text-xs text-slate-400">
                  {r.configured ? <>+{hm(r.overtimeMinutes)} créditos · -{hm(r.deficitMinutes)} débitos · </> : null}
                  {r.daysTracked} dia(s) · última marcação {fmtDateTime(r.lastEventAt)}{r.openShift ? " · jornada em andamento" : ""}
                </span>
              </span>
              <BalanceBadge minutes={r.balanceMinutes} configured={r.configured} />
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
            </Link>
          ))}
        </div>
        <p className="text-xs text-slate-400">Mesma regra do espelho de ponto e da tela do promotor: só dias fechados (a jornada aberta de hoje não entra). Sem jornada contratada configurada no espelho, não há previsto, crédito nem débito.</p>
      </div>
    </DashboardLayout>
  );
}

function MemberDetail({ memberId }: { memberId: number }) {
  const { month, setMonth, current } = useMonth();
  const [, navigate] = useLocation();
  const query = trpc.timesheetMirror.memberTimeBank.useQuery({ memberId, month }, { staleTime: 30000 });
  const data = query.data;
  const b = data?.balance;
  const days = (data?.days || []).filter((d) => d.marks.length || d.expectedMinutes || d.issues.length).filter((d) => d.date <= todayInZone());

  return (
    <DashboardLayout title={data?.member.name || "Banco de horas"} description="Previsto x trabalhado em cada dia do mês." onRefresh={() => void query.refetch()}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="h-11 border-white/20 text-white sm:h-10" onClick={() => navigate(`/banco-de-horas?mes=${month}`)}><ArrowLeft className="mr-1 h-4 w-4" />Equipe</Button>
          <select aria-label="Mês" value={month} onChange={(e) => setMonth(e.target.value)} className={selectCls}>
            {monthOptions(current).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        {query.isLoading && <p className="text-sm text-slate-300">Calculando…</p>}
        {query.isError && <p className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">{query.error?.message || "Não foi possível carregar."}</p>}
        {b && (
          <Card className="border-white/10 bg-slate-900/70">
            <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
              <div><p className="text-[11px] font-bold uppercase text-slate-400">Saldo</p><BalanceBadge minutes={b.balanceMinutes} configured={b.configured} /></div>
              <div><p className="text-[11px] font-bold uppercase text-slate-400">Créditos</p><p className="text-lg font-black tabular-nums text-emerald-300">{hm(b.overtimeMinutes)}</p></div>
              <div><p className="text-[11px] font-bold uppercase text-slate-400">Débitos</p><p className="text-lg font-black tabular-nums text-rose-300">{hm(b.deficitMinutes)}</p></div>
              <div><p className="text-[11px] font-bold uppercase text-slate-400">Trabalhadas</p><p className="text-lg font-black tabular-nums text-white">{hm(b.workedMinutes)}</p></div>
              <div><p className="text-[11px] font-bold uppercase text-slate-400">Previstas</p><p className="text-lg font-black tabular-nums text-white">{hm(b.expectedMinutes)}</p></div>
              <p className="col-span-2 text-xs text-slate-400 sm:col-span-5"><Clock3 className="mr-1 inline h-3.5 w-3.5" />Última marcação: {fmtDateTime(data?.lastEventAt ?? null)}{b.openShift ? " · jornada de hoje em andamento (não entra no saldo)" : ""}</p>
            </CardContent>
          </Card>
        )}
        {data && !days.length && <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-slate-300">Sem marcações neste mês.</p>}
        <div className="space-y-2">
          {days.map((d) => (
            <div key={d.date} className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-white">{d.date.slice(8, 10)}/{d.date.slice(5, 7)} <span className="font-normal text-slate-400">{WEEKDAYS[d.weekday]}</span></p>
                {d.diffMinutes != null ? <span className={`text-sm font-black tabular-nums ${tone(d.diffMinutes)}`}>{formatSignedMinutes(d.diffMinutes)}</span> : <span className="text-xs text-slate-500">—</span>}
              </div>
              <p className="mt-1 text-xs text-slate-300">Trabalhado <strong className="text-white">{hm(d.workedMinutes)}</strong> · Previsto <strong className="text-white">{hm(d.expectedMinutes)}</strong>{d.holiday ? ` · ${d.holiday}` : ""}{d.excuse ? ` · ${d.excuse}` : ""}{d.vacation ? " · Férias" : ""}</p>
              {d.marks.length > 0 && <p className="mt-1 text-xs text-slate-400">{d.marks.map((m) => `${m.label} ${fmtTime(m.time)}`).join(" · ")}</p>}
              {d.issues.length > 0 && <p className="mt-1 text-xs text-amber-200">{d.issues.join(" · ")}</p>}
            </div>
          ))}
        </div>
        <Link href="/espelho-ponto" className="inline-block text-sm font-bold text-teal-300 underline">Abrir o espelho de ponto completo</Link>
      </div>
    </DashboardLayout>
  );
}
