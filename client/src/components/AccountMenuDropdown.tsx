import { ChevronDown, Clock3, CreditCard, KeyRound, LogOut, UserRound } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { trpc } from "@/lib/trpc";

type AccountMenuDropdownProps = {
  tone?: "dark" | "light";
};

export default function AccountMenuDropdown({ tone = "dark" }: AccountMenuDropdownProps) {
  const { user, logout } = useAuth();
  const isPlatformAdmin = user?.role === "platform_admin";
  const isCompanyAdmin = user?.role === "company_admin";
  const entitlements = trpc.entitlements.mine.useQuery(undefined, {
    enabled: Boolean(user && !isPlatformAdmin),
  });
  const canViewTimeBank = Boolean(entitlements.data?.effective.timeTracking);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          aria-label="Abrir menu da conta"
          className={`h-10 w-10 rounded-full p-0 ${tone === "light"
            ? "border-teal-800/20 bg-teal-50 text-teal-900 hover:bg-teal-100 hover:text-teal-950"
            : "border-teal-300/30 bg-teal-300/10 text-teal-100 hover:bg-teal-300/20 hover:text-white"
          }`}
        >
          <UserRound className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 border-white/10 bg-[#0b1728] text-white shadow-2xl">
        <DropdownMenuLabel className="px-3 py-2">
          <p className="truncate font-semibold text-white">{user?.name || "Minha conta"}</p>
          {user?.email && <p className="mt-0.5 truncate text-xs font-normal text-slate-400">{user.email}</p>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem asChild className="cursor-pointer gap-3 py-2.5 text-slate-200 focus:bg-white/10 focus:text-white">
          <a href="/minha-conta#dados-usuario">
            <UserRound className="text-teal-300" />
            Minha conta
          </a>
        </DropdownMenuItem>
        {!isPlatformAdmin && canViewTimeBank && (
          <DropdownMenuItem asChild className="cursor-pointer gap-3 py-2.5 text-slate-200 focus:bg-white/10 focus:text-white">
            <a href="/minha-conta#banco-de-horas">
              <Clock3 className="text-teal-300" />
              Banco de horas
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild className="cursor-pointer gap-3 py-2.5 text-slate-200 focus:bg-white/10 focus:text-white">
          <a href="/minha-conta#seguranca">
            <KeyRound className="text-teal-300" />
            Segurança e senha
          </a>
        </DropdownMenuItem>
        {isCompanyAdmin && (
          <DropdownMenuItem asChild className="cursor-pointer gap-3 py-2.5 text-slate-200 focus:bg-white/10 focus:text-white">
            <a href="/minha-assinatura">
              <CreditCard className="text-teal-300" />
              Minha assinatura
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => void logout()}
          className="cursor-pointer gap-3 py-2.5"
        >
          <LogOut />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
