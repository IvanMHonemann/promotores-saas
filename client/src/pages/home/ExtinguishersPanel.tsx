import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Edit,
  Flame,
  Loader2,
  MapPin,
  Plus,
  QrCode,
  Search,
  Trash2,
} from "lucide-react";

type Filter = "all" | "active" | "near" | "expired";

export type ExtinguisherListItem = {
  id: number;
  clientId: number;
  typeModel: string;
  capacity?: string | null;
  serialNumber?: string | null;
  locationInBuilding?: string | null;
  expirationDate: string | Date;
  lastInspectionDate?: string | Date | null;
  status?: string;
  notes?: string | null;
  publicToken?: string | null;
  clientName?: string;
  clientCity?: string;
};

function formatDate(value: unknown): string {
  if (!value) return "—";
  try {
    const d = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("pt-BR");
  } catch {
    return String(value);
  }
}

function statusBadge(expirationDate: unknown) {
  const exp = expirationDate ? new Date(String(expirationDate)) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (exp && !Number.isNaN(exp.getTime()) && exp < today) {
    return { label: "Vencido", className: "bg-red-100 text-red-800 border-red-200" };
  }
  if (exp && !Number.isNaN(exp.getTime())) {
    const days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 30) {
      return { label: `Vence em ${days}d`, className: "bg-amber-100 text-amber-900 border-amber-200" };
    }
  }
  return { label: "Válido", className: "bg-emerald-50 text-emerald-800 border-emerald-200" };
}

export function ExtinguishersPanel({
  onCreate,
  onEdit,
  onDelete,
  onOpenQr,
}: {
  onCreate: () => void;
  onEdit: (ext: ExtinguisherListItem) => void;
  onDelete: (ext: ExtinguisherListItem) => void;
  onOpenQr: (ext: ExtinguisherListItem) => void; // QR operacional da empresa
}) {
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === "platform_admin";
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const pageSize = 25;

  const pageQuery = trpc.extinguishers.page.useQuery(
    { page, pageSize, search: search || undefined, filter },
    { enabled: Boolean(user && !isPlatformAdmin), staleTime: 15_000 },
  );

  const items = useMemo(() => {
    const raw = pageQuery.data?.items || [];
    return raw.map((row: any) => {
      const e = row.extinguisher || row;
      const c = row.client;
      return {
        id: e.id,
        clientId: e.clientId,
        typeModel: e.typeModel,
        capacity: e.capacity,
        serialNumber: e.serialNumber,
        locationInBuilding: e.locationInBuilding,
        expirationDate: e.expirationDate,
        lastInspectionDate: e.lastInspectionDate,
        status: e.status,
        notes: e.notes,
        publicToken: e.publicToken,
        clientName: c?.companyName || row.clientName,
        clientCity: c?.city || row.clientCity,
      } as ExtinguisherListItem;
    });
  }, [pageQuery.data]);

  const total = pageQuery.data?.total ?? items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (isPlatformAdmin) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Selecione uma empresa na visão geral e gerencie extintores pelo cliente correspondente.
        A listagem completa de extintores está disponível para usuários da empresa.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900">Extintores</h2>
          <p className="text-xs text-slate-500">
            {total} equipamento(s) cadastrado(s)
          </p>
        </div>
        <Button
          size="sm"
          className="h-9 gap-1.5 bg-red-600 font-semibold text-white hover:bg-red-700"
          onClick={onCreate}
        >
          <Plus className="h-4 w-4" /> Cadastrar extintor
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="h-9 pl-9 text-sm"
                placeholder="Buscar por tipo, selo ou localização…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSearch(searchInput.trim());
                    setPage(1);
                  }
                }}
              />
            </div>
            <Select
              value={filter}
              onValueChange={(v) => {
                setFilter(v as Filter);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-full sm:w-44">
                <SelectValue placeholder="Filtro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Válidos</SelectItem>
                <SelectItem value="near">Vence em 30 dias</SelectItem>
                <SelectItem value="expired">Vencidos</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-9"
              onClick={() => {
                setSearch(searchInput.trim());
                setPage(1);
              }}
            >
              Filtrar
            </Button>
          </div>

          {pageQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-red-600" /> Carregando…
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-lg bg-slate-50 py-12 text-center text-sm text-slate-500">
              Nenhum extintor encontrado.
              <div className="mt-3">
                <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={onCreate}>
                  <Plus className="mr-1 h-4 w-4" /> Cadastrar primeiro extintor
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((ext) => {
                const badge = statusBadge(ext.expirationDate);
                const label = ext.serialNumber || ext.typeModel || `#${ext.id}`;
                return (
                  <div
                    key={ext.id}
                    className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Flame className="h-4 w-4 shrink-0 text-red-600" />
                        <span className="font-bold text-slate-900">
                          {ext.typeModel}
                          {ext.capacity ? ` (${ext.capacity})` : ""}
                        </span>
                        <Badge variant="outline" className={`text-[10px] ${badge.className}`}>
                          {badge.label}
                        </Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600">
                        <span className="font-mono">{label}</span>
                        {ext.clientName && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            {ext.clientName}
                            {ext.clientCity ? ` · ${ext.clientCity}` : ""}
                          </span>
                        )}
                        <span>Local: {ext.locationInBuilding || "—"}</span>
                        <span>Validade: {formatDate(ext.expirationDate)}</span>
                        <span>Últ. inspeção: {formatDate(ext.lastInspectionDate)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        onClick={() => onOpenQr(ext)}
                        title="QR Code operacional"
                      >
                        <QrCode className="h-3.5 w-3.5" /> QR
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        onClick={() => onEdit(ext)}
                      >
                        <Edit className="h-3.5 w-3.5 text-blue-600" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 gap-1 text-xs text-slate-500 hover:text-red-600"
                        onClick={() => onDelete(ext)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
              <span>
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
