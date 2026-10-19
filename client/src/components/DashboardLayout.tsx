import { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import MissingPunchAlert from "@/components/MissingPunchAlert";
import AccountMenuDropdown from "@/components/AccountMenuDropdown";
import { SidebarMenuButton, SidebarNav } from "@/components/SidebarNav";

type Props = {
  title: string;
  description: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export default function DashboardLayout({ title, description, children, refreshing = false, onRefresh }: Props) {
  return (
    <main className="saas-page min-h-screen bg-[#07111f] text-white">
      <div className="mx-auto flex min-h-screen max-w-[1480px]">
        <SidebarNav />
        <section className="min-w-0 flex-1 px-4 pb-20 pt-4 sm:px-7 sm:pt-6 lg:px-10 lg:pt-8">
          <header className="mb-7 flex items-center justify-between gap-3 border-b border-white/10 pb-5">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarMenuButton />
              <div className="min-w-0">
                <p className="hidden text-xs font-semibold uppercase tracking-[.18em] text-teal-300 sm:block">
                  Promotores SaaS · Operação
                </p>
                <h1 className="truncate text-2xl font-black tracking-tight sm:mt-1 sm:text-3xl">{title}</h1>
                <p className="mt-1 hidden text-sm text-slate-300 sm:block">{description}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {onRefresh && (
                <Button
                  variant="outline"
                  className="hidden gap-2 border-white/15 bg-white/[.04] text-sm text-slate-200 hover:bg-white/10 hover:text-white sm:flex"
                  onClick={onRefresh}
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              )}
              <AccountMenuDropdown />
            </div>
          </header>
          <MissingPunchAlert />
          {children}
        </section>
      </div>
    </main>
  );
}
