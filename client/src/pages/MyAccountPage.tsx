import { FormEvent, useState } from "react";
import { KeyRound, UserRound } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SidebarNav } from "@/components/SidebarNav";

const roleLabels: Record<string, string> = { platform_admin: "Administrador geral", company_admin: "Administrador da empresa", supervisor: "Supervisor", promoter: "Promotor" };

export default function MyAccountPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const changePassword = trpc.auth.changePassword.useMutation({ onSuccess: () => { toast.success("Senha alterada com sucesso."); setCurrentPassword(""); setNewPassword(""); }, onError: (error) => toast.error(error.message || "Não foi possível alterar a senha.") });
  const submit = (event: FormEvent) => { event.preventDefault(); changePassword.mutate({ currentPassword, newPassword }); };
  return <><SidebarNav /><main className="saas-page min-h-screen p-4 pt-20 sm:p-6 sm:pt-20 lg:pl-80"><div className="mx-auto max-w-4xl space-y-6"><header><p className="text-sm font-semibold uppercase tracking-[.2em] text-teal-300">Promotores SaaS</p><h1 className="mt-1 text-3xl font-black text-white">Minha conta</h1><p className="mt-1 text-slate-300">Confira seus dados e mantenha seu acesso seguro.</p></header><div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-white"><UserRound className="h-5 w-5 text-teal-300" />Dados do usuário</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label className="text-slate-300">Nome</Label><p className="mt-1 rounded-lg border border-white/10 bg-white/[.04] p-3 text-white">{user?.name || "Não informado"}</p></div><div><Label className="text-slate-300">E-mail</Label><p className="mt-1 rounded-lg border border-white/10 bg-white/[.04] p-3 text-white">{user?.email || "Não informado"}</p></div><div><Label className="text-slate-300">Perfil de acesso</Label><p className="mt-1 rounded-lg border border-white/10 bg-white/[.04] p-3 text-white">{roleLabels[user?.role || ""] || user?.role}</p></div>{user?.companyId && <div><Label className="text-slate-300">Empresa</Label><p className="mt-1 rounded-lg border border-white/10 bg-white/[.04] p-3 text-white">Empresa #{user.companyId}</p></div>}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-white"><KeyRound className="h-5 w-5 text-teal-300" />Alterar senha</CardTitle></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><div><Label htmlFor="current-password" className="text-slate-300">Senha atual</Label><Input id="current-password" type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1" /></div><div><Label htmlFor="new-password" className="text-slate-300">Nova senha</Label><Input id="new-password" type="password" minLength={8} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" className="mt-1" /></div><Button type="submit" disabled={changePassword.isPending} className="w-full bg-teal-300 font-bold text-slate-950 hover:bg-teal-200">{changePassword.isPending ? "Salvando..." : "Salvar nova senha"}</Button></form></CardContent></Card></div></div></main></>;
}
