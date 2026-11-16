/** Regras e textos dos avisos da plataforma e da empresa. */

export const ANNOUNCEMENT_ROLES = ["company_admin", "supervisor", "promoter"] as const;
export type AnnouncementRole = (typeof ANNOUNCEMENT_ROLES)[number];

export const ANNOUNCEMENT_TONES = ["info", "warning", "urgent"] as const;
export type AnnouncementTone = (typeof ANNOUNCEMENT_TONES)[number];

export const ANNOUNCEMENT_ROLE_LABELS: Record<AnnouncementRole, string> = {
  company_admin: "Administrador da empresa",
  supervisor: "Supervisor",
  promoter: "Promotor",
};

/** Funções que o admin/supervisor da empresa pode avisar. O admin da empresa nunca é alvo. */
export const COMPANY_ANNOUNCEMENT_ROLES = ["supervisor", "promoter"] as const;
export type CompanyAnnouncementRole = (typeof COMPANY_ANNOUNCEMENT_ROLES)[number];

export type AnnouncementSource = "platform" | "company";
export type AnnouncementTargetMode = "roles" | "members";

export const ANNOUNCEMENT_TONE_LABELS: Record<AnnouncementTone, string> = {
  info: "Informação",
  warning: "Atenção",
  urgent: "Urgente",
};

export type AnnouncementAudienceScope = "all" | "selected";

export type AnnouncementRecord = {
  id: number;
  active: boolean | number;
  startsAt: string | null;
  endsAt: string | null;
  audienceScope: AnnouncementAudienceScope | string;
  companyIds: number[];
  roles: readonly string[];
  source?: AnnouncementSource | string | null;
  companyId?: number | null;
  targetMode?: AnnouncementTargetMode | string | null;
  memberIds?: number[];
  createdByMemberAccountId?: number | null;
};

export type AnnouncementViewer = {
  companyId: number;
  role: string;
  todayIso: string;
  dismissedIds?: number[];
  memberAccountId?: number | null;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Normaliza data do banco ou string para YYYY-MM-DD no calendário informado. */
export function toAnnouncementIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const s = value.trim();
    if (ISO_DATE.test(s.slice(0, 10))) return s.slice(0, 10);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString("en-CA", { timeZone: "UTC" });
  }
  const s = String(value);
  if (ISO_DATE.test(s.slice(0, 10))) return s.slice(0, 10);
  return null;
}

export function todayIsoSP(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function parseAnnouncementTone(raw: unknown): AnnouncementTone {
  const value = String(raw ?? "");
  return (ANNOUNCEMENT_TONES as readonly string[]).includes(value) ? (value as AnnouncementTone) : "info";
}

export function parseAnnouncementRoles(raw: unknown): AnnouncementRole[] {
  const parts = Array.isArray(raw)
    ? raw.map((item) => String(item))
    : String(raw ?? "").split(/[,\s]+/);
  const set = new Set<AnnouncementRole>();
  for (const part of parts) {
    if ((ANNOUNCEMENT_ROLES as readonly string[]).includes(part)) set.add(part as AnnouncementRole);
  }
  return ANNOUNCEMENT_ROLES.filter((role) => set.has(role));
}

export function serializeAnnouncementRoles(roles: readonly string[]): string {
  const unique = parseAnnouncementRoles(roles);
  if (!unique.length) throw new Error("Escolha pelo menos uma função.");
  return unique.join(",");
}

export function parseCompanyAnnouncementRoles(raw: unknown): CompanyAnnouncementRole[] {
  return parseAnnouncementRoles(raw).filter((role): role is CompanyAnnouncementRole =>
    (COMPANY_ANNOUNCEMENT_ROLES as readonly string[]).includes(role),
  );
}

export function serializeCompanyAnnouncementRoles(roles: readonly string[]): string {
  const unique = parseCompanyAnnouncementRoles(roles);
  if (!unique.length) throw new Error("Escolha pelo menos uma função (promotor ou supervisor).");
  return unique.join(",");
}

export function isHttpUrl(value: string): boolean {
  const s = value.trim();
  if (!/^https?:\/\/[^\s]+$/i.test(s)) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function announcementIsLive(announcement: AnnouncementRecord, todayIso: string): boolean {
  if (announcement.active === false || announcement.active === 0) return false;
  const start = toAnnouncementIsoDate(announcement.startsAt);
  const end = toAnnouncementIsoDate(announcement.endsAt);
  if (start && start > todayIso) return false;
  if (end && end < todayIso) return false;
  return true;
}

export function announcementVisibleTo(announcement: AnnouncementRecord, viewer: AnnouncementViewer): boolean {
  if (!announcementIsLive(announcement, viewer.todayIso)) return false;
  if (viewer.dismissedIds?.includes(announcement.id)) return false;

  const source = announcement.source || "platform";
  if (source === "company") {
    if (Number(announcement.companyId) !== Number(viewer.companyId)) return false;
    if (viewer.role === "company_admin") return false;
    if (
      viewer.memberAccountId
      && announcement.createdByMemberAccountId
      && Number(viewer.memberAccountId) === Number(announcement.createdByMemberAccountId)
    ) {
      return false;
    }
    if ((announcement.targetMode || "roles") === "members") {
      return Boolean(viewer.memberAccountId && (announcement.memberIds || []).includes(Number(viewer.memberAccountId)));
    }
    return announcement.roles.includes(viewer.role);
  }

  if (!announcement.roles.includes(viewer.role)) return false;
  if (announcement.audienceScope === "selected") {
    if (!announcement.companyIds.includes(viewer.companyId)) return false;
  }
  return true;
}

export function canManageCompanyAnnouncement(
  actor: { role: string; memberAccountId?: number | null; companyId?: number | null },
  announcement: { source?: string | null; companyId?: number | null; createdByMemberAccountId?: number | null },
): boolean {
  if ((announcement.source || "platform") !== "company") return false;
  if (Number(announcement.companyId) !== Number(actor.companyId)) return false;
  if (actor.role === "company_admin") return true;
  if (
    actor.role === "supervisor"
    && actor.memberAccountId
    && announcement.createdByMemberAccountId
    && Number(actor.memberAccountId) === Number(announcement.createdByMemberAccountId)
  ) {
    return true;
  }
  return false;
}

export function announcementSenderLabel(input: {
  source?: string | null;
  companyName?: string | null;
  authorName?: string | null;
}): string {
  if ((input.source || "platform") === "company") {
    if (input.authorName && input.companyName) return `Aviso de ${input.authorName} (${input.companyName})`;
    if (input.authorName) return `Aviso de ${input.authorName}`;
    if (input.companyName) return `Aviso de ${input.companyName}`;
    return "Aviso da empresa";
  }
  return "Aviso da GondUp";
}

export function announcementAdminStatus(announcement: AnnouncementRecord, todayIso: string): "paused" | "scheduled" | "ended" | "active" {
  if (announcement.active === false || announcement.active === 0) return "paused";
  const start = toAnnouncementIsoDate(announcement.startsAt);
  const end = toAnnouncementIsoDate(announcement.endsAt);
  if (start && start > todayIso) return "scheduled";
  if (end && end < todayIso) return "ended";
  return "active";
}

export const ANNOUNCEMENT_STATUS_LABELS: Record<ReturnType<typeof announcementAdminStatus>, string> = {
  paused: "Pausado",
  scheduled: "Agendado",
  ended: "Encerrado",
  active: "Ativo",
};

export type MessagePart = { type: "text"; value: string } | { type: "link"; value: string; href: string };

const URL_RE = /https?:\/\/[^\s<>"'`]+/gi;

export function splitMessageLinks(text: string): MessagePart[] {
  const source = String(text ?? "");
  const parts: MessagePart[] = [];
  let last = 0;
  const re = new RegExp(URL_RE.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const start = match.index;
    const rawMatch = match[0];
    const raw = rawMatch.replace(/[),.;!?]+$/g, "");
    if (start > last) parts.push({ type: "text", value: source.slice(last, start) });
    if (isHttpUrl(raw)) {
      parts.push({ type: "link", value: raw, href: raw });
      if (raw.length < rawMatch.length) parts.push({ type: "text", value: rawMatch.slice(raw.length) });
    } else {
      parts.push({ type: "text", value: rawMatch });
    }
    last = start + rawMatch.length;
  }
  if (last < source.length) parts.push({ type: "text", value: source.slice(last) });
  const merged: MessagePart[] = [];
  for (const part of parts) {
    const prev = merged[merged.length - 1];
    if (part.type === "text" && prev?.type === "text") prev.value += part.value;
    else merged.push(part);
  }
  return merged.length ? merged : [{ type: "text", value: source }];
}

export function announcementExcerpt(body: string, max = 90): string {
  const compact = String(body ?? "").replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max).trimEnd()}…`;
}

export function filterAnnouncementsForViewer<T extends AnnouncementRecord>(items: T[], viewer: AnnouncementViewer): T[] {
  const rank: Record<string, number> = { urgent: 0, warning: 1, info: 2 };
  return items
    .filter((item) => announcementVisibleTo(item, viewer))
    .sort((a, b) => {
      const toneA = rank[(a as any).tone] ?? 9;
      const toneB = rank[(b as any).tone] ?? 9;
      if (toneA !== toneB) return toneA - toneB;
      return Number(b.id) - Number(a.id);
    });
}
