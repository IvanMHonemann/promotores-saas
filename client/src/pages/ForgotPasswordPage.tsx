import { FormEvent, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, MailQuestion } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { AuthShell } from "@/pages/AuthShell";

type Mode = "link" | "code";

/**
 * "Esqueci minha senha".
 * - Modo "link": pede um link por e-mail (a resposta é sempre a mesma, para não revelar quem tem conta).
 * - Modo "código": usa o código de recuperação que a conta recebeu (funciona mesmo sem e-mail configurado).
 */
export default function ForgotPasswordPage() {
  const [mode, setMode] = useState<Mode>("link");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);

  const request = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: (result) => setSentMessage(result.message),
    onError: () => toast.error("Não foi possível enviar o pedido agora. Tente novamente em instantes."),
  });
  const recover = trpc.auth.recoverPassword.useMutation({
    onSuccess: (result) => { setNewRecoveryCode(result.recoveryCode); toast.success("Senha redefinida com sucesso."); },
    onError: (error) => toast.error(error.message || "E-mail ou código de recuperação inválido."),
  });

  const submitLink = (event: FormEvent) => { event.preventDefault(); request.mutate({ email: email.trim() }); };
  const submitCode = (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return toast.error("A nova senha deve ter pelo menos 8 caracteres.");
    if (password !== confirm) return toast.error("As senhas não conferem.");
    recover.mutate({ email: email.trim(), recoveryCode: code.trim(), newPassword: password });
  };

  if (newRecoveryCode) {
    return (
      <AuthShell title="Senha redefinida" icon={<CheckCircle2 />} subtitle="Já pode entrar com a nova senha.">
        <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
          <p className="font-semibold">Guarde seu novo código de recuperação:</p>
          <p className="mt-2 break-all rounded-lg bg-slate-950 p-3 font-mono text-base text-white select-all">{newRecoveryCode}</p>
          <p className="mt-2 text-xs">O código anterior deixou de valer. Ele só aparece esta vez.</p>
        </div>
        <a href="/login" className="mt-5 flex h-11 w-full items-center justify-center rounded-md bg-teal-400 font-bold text-slate-950 hover:bg-teal-300">Ir para o login</a>
      </AuthShell>
    );
  }

  if (sentMessage) {
    return (
      <AuthShell title="Verifique seu e-mail" icon={<MailQuestion />}>
        <p role="status" className="rounded-2xl border border-teal-300/20 bg-teal-300/10 p-4 text-sm leading-6 text-teal-50">{sentMessage}</p>
        <p className="mt-4 text-xs text-slate-400">O link vale por 1 hora e só pode ser usado uma vez. Olhe também a caixa de spam.</p>
        <div className="mt-5 flex flex-col gap-2">
          <Button type="button" variant="outline" className="border-white/20 text-white" onClick={() => { setSentMessage(null); setMode("code"); }}>Tenho um código de recuperação</Button>
          <Button type="button" variant="ghost" className="text-slate-300" onClick={() => setSentMessage(null)}>Usar outro e-mail</Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Esqueci minha senha" icon={mode === "link" ? <MailQuestion /> : <KeyRound />} subtitle={mode === "link" ? "Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha." : "Use o código de recuperação que você recebeu ao criar a conta."}>
      {mode === "link" ? (
        <form className="space-y-5" onSubmit={submitLink}>
          <div className="space-y-2">
            <Label htmlFor="forgot-email" className="text-slate-300">E-mail</Label>
            <Input id="forgot-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="border-slate-700 bg-slate-950 text-white" placeholder="voce@empresa.com" />
          </div>
          <Button type="submit" disabled={request.isPending || !email.trim()} className="h-12 w-full bg-teal-400 font-bold text-slate-950 hover:bg-teal-300">
            {request.isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Enviando...</> : "Enviar link de redefinição"}
          </Button>
          <button type="button" className="w-full text-center text-sm text-teal-300 hover:underline" onClick={() => setMode("code")}>Tenho um código de recuperação</button>
          <p className="text-center text-xs text-slate-500">Sem acesso ao e-mail ou sem código? Fale com o administrador da sua empresa ou com o suporte.</p>
        </form>
      ) : (
        <form className="space-y-4" onSubmit={submitCode}>
          <div className="space-y-2">
            <Label htmlFor="rec-email" className="text-slate-300">E-mail</Label>
            <Input id="rec-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="border-slate-700 bg-slate-950 text-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rec-code" className="text-slate-300">Código de recuperação</Label>
            <Input id="rec-code" required value={code} onChange={(e) => setCode(e.target.value)} className="border-slate-700 bg-slate-950 font-mono text-white" autoComplete="off" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rec-pass" className="text-slate-300">Nova senha (mínimo 8 caracteres)</Label>
            <PasswordInput id="rec-pass" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="border-slate-700 bg-slate-950 text-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rec-pass2" className="text-slate-300">Repita a nova senha</Label>
            <PasswordInput id="rec-pass2" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="border-slate-700 bg-slate-950 text-white" />
          </div>
          <Button type="submit" disabled={recover.isPending} className="h-12 w-full bg-teal-400 font-bold text-slate-950 hover:bg-teal-300">
            {recover.isPending ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Redefinindo...</> : "Redefinir senha"}
          </Button>
          <button type="button" className="w-full text-center text-sm text-teal-300 hover:underline" onClick={() => setMode("link")}>Prefiro receber um link por e-mail</button>
        </form>
      )}
    </AuthShell>
  );
}
