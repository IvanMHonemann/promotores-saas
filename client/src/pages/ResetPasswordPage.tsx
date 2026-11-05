import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Loader2, LockKeyhole, XCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { AuthShell } from "@/pages/AuthShell";

/** Tela aberta pelo link do e-mail: /redefinir-senha?token=... */
export default function ResetPasswordPage() {
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") || "", []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const reset = trpc.auth.resetPasswordWithToken.useMutation({
    onSuccess: () => { setDone(true); toast.success("Senha redefinida com sucesso."); },
    onError: (error) => setFailed(error.message || "Link inválido ou expirado. Peça um novo link."),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return toast.error("A nova senha deve ter pelo menos 8 caracteres.");
    if (password !== confirm) return toast.error("As senhas não conferem.");
    reset.mutate({ token, newPassword: password });
  };

  if (!token || failed) {
    return (
      <AuthShell title="Link inválido ou expirado" icon={<XCircle />} backTo="/login">
        <p className="text-sm leading-6 text-slate-300">{failed || "O link de redefinição está incompleto."} O link vale por 1 hora e só pode ser usado uma vez.</p>
        <a href="/esqueci-senha" className="mt-5 flex h-11 w-full items-center justify-center rounded-md bg-teal-400 font-bold text-slate-950 hover:bg-teal-300">Pedir um novo link</a>
      </AuthShell>
    );
  }
  if (done) {
    return (
      <AuthShell title="Senha redefinida" icon={<CheckCircle2 />} subtitle="Todas as sessões antigas foram encerradas. Entre com a nova senha.">
        <a href="/login" className="flex h-11 w-full items-center justify-center rounded-md bg-teal-400 font-bold text-slate-950 hover:bg-teal-300">Ir para o login</a>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Criar nova senha" icon={<LockKeyhole />} subtitle="Escolha uma senha com pelo menos 8 caracteres.">
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="new-pass" className="text-slate-300">Nova senha</Label>
          <PasswordInput id="new-pass" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="border-slate-700 bg-slate-950 text-white" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-pass2" className="text-slate-300">Repita a nova senha</Label>
          <PasswordInput id="new-pass2" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="border-slate-700 bg-slate-950 text-white" />
        </div>
        <Button type="submit" disabled={reset.isPending} className="h-12 w-full bg-teal-400 font-bold text-slate-950 hover:bg-teal-300">
          {reset.isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Salvando...</> : "Salvar nova senha"}
        </Button>
      </form>
    </AuthShell>
  );
}
