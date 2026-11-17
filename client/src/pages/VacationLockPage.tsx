import { LogOut, Palmtree } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { formatBrDate } from "@shared/vacationLock";

export default function VacationLockPage({ startDate, endDate }: { startDate: string; endDate: string }) {
  const { logout } = useAuth();
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07111f] p-4 text-white">
      <section className="w-full max-w-md rounded-3xl border border-teal-300/30 bg-slate-950/90 p-6 shadow-2xl shadow-teal-950/40">
        <div className="mb-6 flex items-center justify-between gap-3">
          <BrandLogo />
        </div>
        <div className="flex flex-col items-center text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-teal-300/15 text-teal-300">
            <Palmtree className="h-7 w-7" />
          </span>
          <h1 className="text-2xl font-black tracking-tight">Você está de férias</h1>
          <p className="mt-3 text-sm text-slate-300">
            Suas férias vão de <strong className="text-white">{formatBrDate(startDate)}</strong> a{" "}
            <strong className="text-white">{formatBrDate(endDate)}</strong>.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            O aplicativo é liberado automaticamente no dia seguinte ao término.
          </p>
          <Button
            className="mt-8 w-full bg-teal-300 text-slate-950 hover:bg-teal-200"
            onClick={() => void logout()}
          >
            <LogOut className="mr-2 h-4 w-4" />Sair
          </Button>
        </div>
      </section>
    </main>
  );
}
