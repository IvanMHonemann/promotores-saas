import { recordPlatformJobRun } from "./liveErrorStore";

type BackupLike = {
  day?: string;
  complete?: boolean;
  skipped?: boolean;
  tables?: number;
  tablesDone?: number;
} | null | undefined;

function dayLabel(day?: string): string {
  const parts = String(day || "").split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : (day || "dia desconhecido");
}

export function formatBackupJobSummary(backup: BackupLike): string {
  if (!backup) return "Backup sem detalhes.";
  const day = dayLabel(backup.day);
  if (backup.complete && backup.skipped) return `Backup de ${day} já estava concluído.`;
  if (backup.complete) return `Backup de ${day} concluído.`;
  return `Backup de ${day} em andamento (${backup.tablesDone || 0} de ${backup.tables || 0} tabelas).`;
}

export function formatMaintenanceSummary(result: { backup?: BackupLike } | null | undefined): string {
  return `Manutenção concluída. ${formatBackupJobSummary(result?.backup)}`;
}

export function formatArchiveSummary(archive: { processed?: number } | null | undefined): string {
  const processed = Number(archive?.processed ?? 0);
  return processed === 1 ? "1 espelho processado." : `${processed} espelhos processados.`;
}

export async function recordScheduledJob(job: string, startedAt: Date, ok: boolean, summary: string): Promise<void> {
  await recordPlatformJobRun({ job, ok, summary, startedAt, finishedAt: new Date() });
}
