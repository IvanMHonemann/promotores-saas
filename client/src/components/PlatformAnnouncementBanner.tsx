import { useMemo, useState } from "react";
import { AlertTriangle, Info, Megaphone, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { AnnouncementMessage } from "@/components/AnnouncementMessage";
import { announcementExcerpt } from "@shared/platformAnnouncements";

type Item = {
  id: number;
  title: string;
  body: string;
  tone: "info" | "warning" | "urgent" | string;
  buttonLabel: string | null;
  buttonUrl: string | null;
  dismissable: boolean;
  senderLabel?: string | null;
  source?: string | null;
};

const shells: Record<string, string> = {
  info: "border-sky-400/50 bg-sky-950/70 text-sky-50",
  warning: "border-amber-400/50 bg-amber-950/70 text-amber-50",
  urgent: "border-rose-400/60 bg-rose-950/80 text-rose-50",
};

function toneIcon(tone: string) {
  if (tone === "urgent") return AlertTriangle;
  if (tone === "warning") return AlertTriangle;
  return Info;
}

function BannerCard({ item, onDismiss }: { item: Item; onDismiss: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const Icon = toneIcon(item.tone);
  const excerpt = announcementExcerpt(item.body);
  const headline = excerpt && excerpt !== item.title ? `${item.title} — ${excerpt}` : item.title;
  return (
    <section role="status" className={`mb-3 overflow-hidden rounded-2xl border p-3 sm:p-4 ${shells[item.tone] || shells.info}`}>
      <div className="flex items-start gap-2 sm:gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-bold leading-5">{open ? item.title : headline}</p>
          {item.senderLabel ? <p className="mt-1 text-xs font-medium text-current/80">{item.senderLabel}</p> : null}
          <div className="mt-3">
            <Button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
              className="h-10 w-full bg-teal-300 text-slate-950 hover:bg-teal-200 sm:w-auto"
            >
              {open ? "Ocultar aviso" : "Ler aviso"}
            </Button>
          </div>
          {open ? (
            <div className="mt-3 w-full min-w-0 overflow-hidden">
              <AnnouncementMessage text={item.body} className="text-sm leading-5 text-current/90" />
              {item.buttonLabel && item.buttonUrl ? (
                <Button
                  type="button"
                  asChild
                  className="mt-3 h-10 w-full min-w-0 bg-teal-300 text-slate-950 hover:bg-teal-200 sm:w-auto"
                >
                  <a href={item.buttonUrl} target="_blank" rel="noopener noreferrer">{item.buttonLabel}</a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {item.dismissable ? (
          <button
            type="button"
            onClick={() => onDismiss(item.id)}
            className="shrink-0 rounded-lg p-1 text-current/70 hover:bg-white/10 hover:text-current"
            aria-label="Dispensar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </section>
  );
}

export default function PlatformAnnouncementBanner() {
  const { user } = useAuth();
  const enabled = Boolean(user && user.role !== "platform_admin" && user.companyId);
  const query = trpc.announcements.mine.useQuery(undefined, {
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const utils = trpc.useUtils();
  const dismiss = trpc.announcements.dismiss.useMutation({
    onSuccess: () => { void utils.announcements.mine.invalidate(); },
  });
  const [hidden, setHidden] = useState<number[]>([]);
  const items = useMemo(
    () => ((query.data ?? []) as Item[]).filter((item) => !hidden.includes(item.id)),
    [query.data, hidden],
  );
  if (!enabled || !items.length) return null;

  const onDismiss = (id: number) => {
    setHidden((prev) => (prev.includes(id) ? prev : [...prev, id]));
    dismiss.mutate({ id });
  };

  return (
    <div>
      {items.map((item) => (
        <BannerCard key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export function AnnouncementsNavIcon() {
  return <Megaphone className="h-4 w-4" />;
}
