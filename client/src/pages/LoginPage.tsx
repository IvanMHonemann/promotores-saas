import { FormEvent, useState } from "react";
import { ArrowLeft, Loader2, LockKeyhole, LogIn } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { BrandLogo } from "@/components/BrandLogo";
import { toast } from "sonner";

export default function LoginPage() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      const user = await utils.auth.me.fetch();
      if (!user) {
        toast.error("A sessão não foi reconhecida. Recarregue a página e tente novamente.");
        return;
      }
      toast.success("Login realizado");
      window.location.href = "/";
    },
    onError: (error) => toast.error(error.message || "Não foi possível entrar"),
  });
  const submit = (event: FormEvent) => { event.preventDefault(); login.mutate({ email: email.trim(), password }); };
  return <main className="flex min-h-screen items-center justify-center bg-[#07111f] px-4 py-10 text-white"><div className="grid w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900 shadow-2xl lg:grid-cols-[.9fr_1.1fr]"><section className="hidden bg-gradient-to-br from-teal-400/20 via-slate-900 to-blue-900/20 p-10 lg:block"><BrandLogo variant="dark" height={46} /><div className="mt-24"><p className="text-sm font-bold uppercase tracking-[.2em] text-teal-300">Acesso seguro</p><h1 className="mt-4 text-4xl font-black leading-tight">Volte para a operação que move sua equipe.</h1><p className="mt-5 leading-7 text-slate-400">Acompanhe visitas, jornadas e resultados de campo em um só lugar.</p></div></section><section className="p-6 sm:p-10"><button onClick={() => navigate("/")} className="mb-10 flex items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar</button><BrandLogo variant="dark" height={42} className="lg:hidden" /><div className="mt-8"><div className="mb-7"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-300/10 text-teal-300"><LockKeyhole /></div><h2 className="text-3xl font-black">Entrar</h2><p className="mt-2 text-slate-400">Use o e-mail e a senha da sua conta.</p></div><form className="space-y-5" onSubmit={submit}><div className="space-y-2"><Label htmlFor="login-email" className="text-slate-300">E-mail</Label><Input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="border-slate-700 bg-slate-950 text-white" placeholder="voce@empresa.com" /></div><div className="space-y-2"><Label htmlFor="login-password" className="text-slate-300">Senha</Label><PasswordInput id="login-password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required className="border-slate-700 bg-slate-950 text-white" /></div><Button type="submit" disabled={login.isPending} className="h-12 w-full bg-teal-400 font-bold text-slate-950 hover:bg-teal-300">{login.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><LogIn className="mr-2 h-5 w-5" /> Entrar no painel</>}</Button></form><p className="mt-8 text-center text-sm text-slate-500">Ainda não tem conta? <button className="font-semibold text-teal-300 hover:text-teal-200" onClick={() => navigate("/planos")}>Conheça os planos</button></p></div></section></div></main>;
}
