import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Palmtree } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { todayInZone } from "@shared/expiry";

function isoDate(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

const statusLabel = (s: string, start: string, end: string) => {
  if (s === "cancelled") return "Cancelada";
  const today = todayInZone();
  if (today < start) return "Futura";
  if (today > end) return "Concluída";
  return "Em andamento";
};

export default function MyVacationsPage() {
  const mine = trpc.vacations.mine.useQuery();
  return (
    <DashboardLayout title="Minhas férias" description="Consulte suas programações de férias.">
      <Card className="border-white/10 bg-slate-900/70 text-white">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Palmtree className="h-4 w-4 text-teal-300" />Suas férias</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(mine.data || []).map((row: any) => (
            <div key={row.id} className="rounded-lg border border-white/10 p-3">
              <p className="font-semibold">{isoDate(row.startDate)} a {isoDate(row.endDate)}</p>
              <p className="text-slate-300">{row.days} dias · {statusLabel(row.status, isoDate(row.startDate), isoDate(row.endDate))}</p>
              {row.notes && <p className="text-xs text-slate-400">{row.notes}</p>}
            </div>
          ))}
          {!mine.data?.length && <p className="text-slate-400">Nenhuma férias programada.</p>}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
