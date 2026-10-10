import { useLiveQuery } from "dexie-react-hooks";
import { ChangeEvent, useRef, useState } from "react";
import { ArrowLeft, Download, FileText, HardDrive, Upload } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { exportOfflineBackup, formatOfflineBackupAsText, importOfflineBackup, offlineDb } from "@/offline/localDb";
import { useAuth } from "@/_core/hooks/useAuth";

export default function BackupPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const tenantKey = user && user.id < 0 ? String(Math.abs(user.id)) : null;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else navigate("/");
  };
  const lastBackup = useLiveQuery(() => tenantKey ? offlineDb.meta.get(`${tenantKey}:lastBackupExport`) : Promise.resolve(undefined), [tenantKey], undefined);
  const lastImport = useLiveQuery(() => tenantKey ? offlineDb.meta.get(`${tenantKey}:lastBackupImport`) : Promise.resolve(undefined), [tenantKey], undefined);

  const formatDate = (value?: string) => value ? new Date(value).toLocaleString("pt-BR") : "Ainda não realizado";

  const handleExport = async () => {
    if (!tenantKey) { toast.error("Não há uma empresa comercial associada a esta sessão."); return; }
    setBusy(true);
    try {
      const backup = await exportOfflineBackup(tenantKey);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-extintores-${tenantKey}-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      await offlineDb.meta.put({ key: `${tenantKey}:lastBackupExport`, tenantKey, value: new Date().toISOString() });
      toast.success("Backup exportado para esta empresa. Guarde o arquivo em local seguro.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível exportar o backup."); }
    finally { setBusy(false); }
  };

  const handleTextExport = async () => {
    if (!tenantKey) { toast.error("Não há uma empresa comercial associada a esta sessão."); return; }
    setBusy(true);
    try {
      const backup = await exportOfflineBackup(tenantKey);
      const blob = new Blob(["\ufeff", formatOfflineBackupAsText(backup)], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `relatorio-dados-extintores-${tenantKey}-${new Date().toISOString().slice(0, 10)}.txt`;
      link.click();
      URL.revokeObjectURL(url);
      await offlineDb.meta.put({ key: `${tenantKey}:lastBackupExport`, tenantKey, value: new Date().toISOString() });
      toast.success("Arquivo TXT formatado exportado. Guarde também o backup JSON para restauração automática.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível exportar o arquivo TXT."); }
    finally { setBusy(false); }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!tenantKey) { toast.error("Não há uma empresa comercial associada a esta sessão."); return; }
    if (!window.confirm("A restauração substituirá os dados locais desta empresa. O backup será validado antes da operação. Deseja continuar?")) return;
    setBusy(true);
    try {
      const payload = JSON.parse(await file.text());
      await importOfflineBackup(payload, tenantKey, { replaceExisting: true });
      toast.success("Backup da empresa restaurado com sucesso. Recarregue o painel para atualizar os dados.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Arquivo de backup inválido."); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button variant="ghost" className="gap-2" onClick={goBack}><ArrowLeft className="h-4 w-4" /> Voltar</Button>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="bg-slate-900 text-white"><CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5 text-red-400" /> Backup e Restauração</CardTitle><CardDescription className="text-slate-300">Proteja somente os dados locais da empresa atual antes de limpar o navegador ou trocar de aparelho.</CardDescription></CardHeader>
          <CardContent className="space-y-6 p-5 sm:p-8">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900"><strong>Atenção:</strong> o backup contém dados pessoais e comerciais da empresa identificada no arquivo. O sistema bloqueará a restauração em outra empresa.</div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4"><Download className="mb-3 h-5 w-5 text-red-600" /><h2 className="font-bold">Exportar backup</h2><p className="mt-1 text-sm text-slate-500">Salva clientes, extintores, ordens, alertas, configurações e fila pendente desta empresa.</p><Button className="mt-4 w-full bg-red-600 hover:bg-red-700" disabled={busy || !tenantKey} onClick={() => void handleExport()}>Baixar backup JSON</Button><Button variant="outline" className="mt-2 w-full gap-2" disabled={busy || !tenantKey} onClick={() => void handleTextExport()}><FileText className="h-4 w-4" /> Exportar relatório TXT</Button><p className="mt-3 text-xs text-slate-500">JSON restaura os dados; TXT facilita leitura e conferência. Último backup: {formatDate((lastBackup as any)?.value)}</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4"><Upload className="mb-3 h-5 w-5 text-blue-600" /><h2 className="font-bold">Restaurar backup</h2><p className="mt-1 text-sm text-slate-500">Valida tenant, versão e estrutura antes de substituir os dados locais desta empresa.</p><input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} /><Button variant="outline" className="mt-4 w-full" disabled={busy || !tenantKey} onClick={() => fileRef.current?.click()}>Selecionar arquivo</Button><p className="mt-3 text-xs text-slate-500">Última restauração: {formatDate((lastImport as any)?.value)}</p></div>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">A sincronização com o servidor online continuará disponível quando houver internet. Operações pendentes de outra empresa não são carregadas nem sincronizadas neste contexto.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
