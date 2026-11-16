import { useMemo, useState } from "react";
import { Check, Loader2, Megaphone, Pause, Pencil, Plus, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { AnnouncementMessage } from "@/components/AnnouncementMessage";
import { DateInput } from "@/components/PtBrDateFields";
import { confirmAction } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ANNOUNCEMENT_ROLE_LABELS,
  ANNOUNCEMENT_STATUS_LABELS,
  ANNOUNCEMENT_TONE_LABELS,
  ANNOUNCEMENT_TONES,
  COMPANY_ANNOUNCEMENT_ROLES,
  announcementAdminStatus,
  todayIsoSP,
  type AnnouncementTone,
  type CompanyAnnouncementRole,
} from "@shared/platformAnnouncements";

type FormState = {
  id?: number;
  title: string;
  body: string;
  tone: AnnouncementTone;
  buttonLabel: string;
  buttonUrl: string;
  targetMode: "roles" | "members";
  roles: CompanyAnnouncementRole[];
  memberIds: number[];
  startsAt: string;
  endsAt: string;
  dismissable: boolean;
  active: boolean;
};

const emptyForm = (): FormState => ({
  title: "",
  body: "",
  tone: "info",
  buttonLabel: "",
  buttonUrl: "",
  targetMode: "roles",
  roles: [...COMPANY_ANNOUNCEMENT_ROLES],
  memberIds: [],
  startsAt: "",
  endsAt: "",
  dismissable: true,
  active: true,
});

const inp = "mt-1 border-white/15 bg-slate-950/60 text-white";

function statusBadgeClass(status: string) {
  if (status === "active") return "bg-emerald-500/20 text-emerald-100";
  if (status === "scheduled") return "bg-sky-500/20 text-sky-100";
  if (status === "paused") return "bg-slate-500/30 text-slate-200";
  return "bg-rose-500/20 text-rose-100";
}

function audienceLabel(item: any) {
  if (item.targetMode === "members") {
    const names = (item.memberNames as string[] | undefined)?.filter(Boolean);
    if (names?.length) return names.join(", ");
    const count = Array.isArray(item.memberIds) ? item.memberIds.length : 0;
    return count === 1 ? "1 pessoa escolhida" : `${count} pessoas escolhidas`;
  }
  const labels = (item.roles || [])
    .map((role: string) => (role === "promoter" ? "promotores" : role === "supervisor" ? "supervisores" : ""))
    .filter(Boolean);
  if (!labels.length) return "Funções selecionadas";
  if (labels.length === 1) return `Todos os ${labels[0]}`;
  return `Todos os ${labels.join(" e ")}`;
}

export default function CompanyAnnouncementsPage() {
  const utils = trpc.useUtils();
  const list = trpc.announcements.company.list.useQuery(undefined, { staleTime: 10_000 });
  const recipients = trpc.announcements.company.recipients.useQuery(undefined, { staleTime: 30_000 });
  const [form, setForm] = useState<FormState | null>(null);
  const [personQuery, setPersonQuery] = useState("");
  const today = todayIsoSP();

  const create = trpc.announcements.company.create.useMutation({
    onSuccess: () => { toast.success("Aviso criado."); setForm(null); void utils.announcements.company.list.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const update = trpc.announcements.company.update.useMutation({
    onSuccess: () => { toast.success("Aviso atualizado."); setForm(null); void utils.announcements.company.list.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const setActive = trpc.announcements.company.setActive.useMutation({
    onSuccess: (_r, vars) => { toast.success(vars.active ? "Aviso ativado." : "Aviso pausado."); void utils.announcements.company.list.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const remove = trpc.announcements.company.delete.useMutation({
    onSuccess: () => { toast.success("Aviso excluído."); void utils.announcements.company.list.invalidate(); },
    onError: (error) => toast.error(error.message),
  });

  const people = recipients.data ?? [];
  const filteredPeople = useMemo(() => {
    const term = personQuery.trim().toLowerCase();
    if (!term) return people;
    return people.filter((person) => person.userName.toLowerCase().includes(term) || ANNOUNCEMENT_ROLE_LABELS[person.role as CompanyAnnouncementRole]?.toLowerCase().includes(term));
  }, [people, personQuery]);

  const payload = (state: FormState) => ({
    title: state.title,
    body: state.body,
    tone: state.tone,
    buttonLabel: state.buttonLabel.trim() || null,
    buttonUrl: state.buttonUrl.trim() || null,
    targetMode: state.targetMode,
    roles: state.targetMode === "roles" ? state.roles : [],
    memberIds: state.targetMode === "members" ? state.memberIds : [],
    startsAt: state.startsAt || null,
    endsAt: state.endsAt || null,
    dismissable: state.dismissable,
    active: state.active,
  });

  const save = () => {
    if (!form) return;
    if (form.id) update.mutate({ id: form.id, ...payload(form) });
    else create.mutate(payload(form));
  };

  const edit = (item: any) => {
    setPersonQuery("");
    setForm({
      id: item.id,
      title: item.title,
      body: item.body,
      tone: item.tone,
      buttonLabel: item.buttonLabel ?? "",
      buttonUrl: item.buttonUrl ?? "",
      targetMode: item.targetMode === "members" ? "members" : "roles",
      roles: (item.roles ?? []).filter((role: string) => (COMPANY_ANNOUNCEMENT_ROLES as readonly string[]).includes(role)),
      memberIds: item.memberIds ?? [],
      startsAt: item.startsAt ?? "",
      endsAt: item.endsAt ?? "",
      dismissable: Boolean(item.dismissable),
      active: Boolean(item.active),
    });
  };

  const busy = create.isPending || update.isPending;

  return (
    <DashboardLayout
      title="Avisos"
      description="Envie recados só para os promotores e supervisores desta empresa. Dá para avisar toda uma função ou escolher pessoas."
      refreshing={list.isFetching}
      onRefresh={() => void list.refetch()}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card className="border-white/10 bg-slate-900/70 text-white">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-teal-300" />Avisos ({list.data?.length ?? 0})</CardTitle>
            <Button size="sm" className="bg-teal-300 text-slate-950 hover:bg-teal-200" onClick={() => { setPersonQuery(""); setForm(emptyForm()); }}>
              <Plus className="h-4 w-4" /> Novo aviso
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {list.isLoading && <p className="flex items-center gap-2 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin" />Carregando...</p>}
            {list.isError && <p role="alert" className="text-sm text-rose-200">{list.error.message}</p>}
            {!list.isLoading && !list.data?.length && <p className="text-sm text-slate-400">Nenhum aviso cadastrado ainda.</p>}
            {(list.data || []).map((item) => {
              const status = announcementAdminStatus(item as any, today);
              const canManage = Boolean((item as any).canManage);
              return (
                <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/40 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{item.title}</p>
                    <Badge className={statusBadgeClass(status)}>{ANNOUNCEMENT_STATUS_LABELS[status]}</Badge>
                    <Badge className="bg-white/10 text-slate-200">{ANNOUNCEMENT_TONE_LABELS[item.tone]}</Badge>
                  </div>
                  <p className="text-xs text-slate-400">
                    {audienceLabel(item)}
                    {(item as any).authorName ? ` · criado por ${(item as any).authorName}` : ""}
                    {item.startsAt || item.endsAt ? ` · ${item.startsAt ?? "sem início"} a ${item.endsAt ?? "sem fim"}` : " · sem período limitado"}
                    {item.dismissable ? " · pode dispensar" : " · não pode dispensar"}
                  </p>
                  {canManage ? (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="border-white/20 text-white" onClick={() => edit(item)}>
                        <Pencil className="mr-1.5 h-4 w-4" />Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-white/20 text-white"
                        disabled={setActive.isPending}
                        onClick={() => setActive.mutate({ id: item.id, active: !item.active })}
                      >
                        {item.active ? <Pause className="mr-1.5 h-4 w-4" /> : <Check className="mr-1.5 h-4 w-4" />}
                        {item.active ? "Pausar" : "Ativar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-rose-300/40 text-rose-200"
                        disabled={remove.isPending}
                        onClick={() => {
                          void confirmAction({ title: `Excluir o aviso "${item.title}"?`, description: "Ele some para as pessoas desta empresa. Essa ação não tem volta.", confirmLabel: "Excluir", danger: true }).then((ok) => ok && remove.mutate({ id: item.id }));
                        }}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" />Excluir
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Somente o autor ou o administrador da empresa podem editar este aviso.</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {form ? (
          <Card className="border-white/10 bg-slate-900/70 text-white">
            <CardHeader>
              <CardTitle>{form.id ? "Editar aviso" : "Novo aviso"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="aviso-empresa-titulo">Título</Label>
                <Input id="aviso-empresa-titulo" maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inp} />
              </div>
              <div>
                <Label htmlFor="aviso-empresa-mensagem">Mensagem</Label>
                <Textarea id="aviso-empresa-mensagem" rows={6} maxLength={8000} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className={inp} placeholder="Quebras de linha e links https://... ficam clicáveis." />
              </div>
              <div>
                <Label htmlFor="aviso-empresa-tipo">Tipo</Label>
                <select id="aviso-empresa-tipo" value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value as AnnouncementTone })} className="mt-1 h-10 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm text-white">
                  {ANNOUNCEMENT_TONES.map((tone) => <option key={tone} value={tone}>{ANNOUNCEMENT_TONE_LABELS[tone]}</option>)}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="aviso-empresa-botao">Botão (opcional)</Label>
                  <Input id="aviso-empresa-botao" maxLength={80} value={form.buttonLabel} onChange={(e) => setForm({ ...form, buttonLabel: e.target.value })} className={inp} placeholder="Ex.: Ver o roteiro" />
                </div>
                <div>
                  <Label htmlFor="aviso-empresa-link">Link do botão</Label>
                  <Input id="aviso-empresa-link" value={form.buttonUrl} onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })} className={inp} placeholder="https://" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Quem vai ver</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setForm({ ...form, targetMode: "roles", memberIds: [] })} className={`rounded-full border px-3 py-1 text-sm ${form.targetMode === "roles" ? "border-teal-300 bg-teal-300 text-slate-950" : "border-white/20 text-slate-200"}`}>Por função</button>
                  <button type="button" onClick={() => setForm({ ...form, targetMode: "members" })} className={`rounded-full border px-3 py-1 text-sm ${form.targetMode === "members" ? "border-teal-300 bg-teal-300 text-slate-950" : "border-white/20 text-slate-200"}`}>Pessoas específicas</button>
                </div>
                {form.targetMode === "roles" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {COMPANY_ANNOUNCEMENT_ROLES.map((role) => {
                      const on = form.roles.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setForm({ ...form, roles: on ? form.roles.filter((item) => item !== role) : [...form.roles, role] })}
                          className={`rounded-full border px-3 py-1 text-sm ${on ? "border-teal-300 bg-teal-300 text-slate-950" : "border-white/20 text-slate-200"}`}
                        >
                          {ANNOUNCEMENT_ROLE_LABELS[role]}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <Input aria-label="Buscar pessoa" placeholder="Buscar pessoa" value={personQuery} onChange={(e) => setPersonQuery(e.target.value)} className={inp} />
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-slate-950/50 p-2">
                      {filteredPeople.map((person) => {
                        const on = form.memberIds.includes(person.id);
                        return (
                          <label key={person.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => setForm({
                                ...form,
                                memberIds: on ? form.memberIds.filter((id) => id !== person.id) : [...form.memberIds, person.id],
                              })}
                            />
                            <span className="min-w-0 flex-1 truncate">{person.userName}</span>
                            <span className="shrink-0 text-xs text-slate-400">{ANNOUNCEMENT_ROLE_LABELS[person.role as CompanyAnnouncementRole]}</span>
                          </label>
                        );
                      })}
                      {!filteredPeople.length && <p className="px-2 py-1 text-xs text-slate-400">Nenhuma pessoa encontrada.</p>}
                    </div>
                    <p className="text-xs text-slate-400">{form.memberIds.length} pessoa(s) selecionada(s).</p>
                  </div>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Início da exibição (opcional)</Label>
                  <div className="mt-1"><DateInput aria-label="Início da exibição" value={form.startsAt} onChange={(value) => setForm({ ...form, startsAt: value })} /></div>
                </div>
                <div>
                  <Label>Fim da exibição (opcional)</Label>
                  <div className="mt-1"><DateInput aria-label="Fim da exibição" value={form.endsAt} onChange={(value) => setForm({ ...form, endsAt: value })} /></div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.dismissable} onChange={(e) => setForm({ ...form, dismissable: e.target.checked })} />
                A pessoa pode dispensar este aviso
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Aviso ativo
              </label>
              {form.body ? (
                <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Prévia</p>
                  <p className="mt-1 font-semibold">{form.title || "Título"}</p>
                  <AnnouncementMessage text={form.body} className="mt-1 text-sm text-slate-200" />
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy} onClick={save} className="bg-teal-300 text-slate-950 hover:bg-teal-200">
                  {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  {form.id ? "Salvar alterações" : "Criar aviso"}
                </Button>
                <Button type="button" variant="outline" className="border-white/20 text-white" onClick={() => setForm(null)}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-white/10 bg-slate-900/70 text-white">
            <CardContent className="p-6 text-sm text-slate-300">
              Escolha um aviso para editar ou clique em “Novo aviso”. O administrador vê e edita todos os avisos da empresa; o supervisor edita só os que ele criou. O administrador da empresa não recebe esses avisos.
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
