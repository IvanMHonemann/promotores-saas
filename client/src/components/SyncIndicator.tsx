import { useEffect, useState } from "react";
import { Cloud, CloudOff, Loader2 } from "lucide-react";
import { list as listQueue } from "@/lib/offlineQueue";
import { isOnline } from "@/lib/offlineCache";

/**
 * Indicador de sincronização em tempo real.
 * Mostra: online, offline, ou quantidade de itens pendentes.
 */
export function SyncIndicator() {
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const update = () => {
      setOnline(isOnline());
      setPending(listQueue().length);
    };
    update();
    const interval = setInterval(update, 2000);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!online) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-2.5 py-1 text-xs font-bold text-amber-200">
        <CloudOff className="h-3.5 w-3.5" />
        Offline{pending > 0 ? ` · ${pending}` : ""}
      </span>
    );
  }

  if (pending > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/40 bg-sky-400/15 px-2.5 py-1 text-xs font-bold text-sky-200">
        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />}
        {pending} pendente{pending > 1 ? "s" : ""}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-200">
      <Cloud className="h-3.5 w-3.5" />
      Online
    </span>
  );
}
