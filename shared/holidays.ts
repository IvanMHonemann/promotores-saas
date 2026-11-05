/**
 * Feriados nacionais brasileiros (fixos + móveis).
 * Usado para identificar automaticamente e abonar falta de batida no cartão ponto,
 * sem impedir o registro de ponto nesses dias.
 */
export type Holiday = {
  date: string; // YYYY-MM-DD
  name: string;
  /**
   * Ponto facultativo (não é feriado nacional por lei): Carnaval e Corpus Christi.
   * Não é abonado automaticamente, a menos que a empresa configure o contrário.
   */
  optional?: boolean;
};

function easterSunday(year: number): Date {
  // Algoritmo de Meeus/Jones/Butcher
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const FIXED: Array<{ md: string; name: string; fromYear?: number }> = [
  { md: "01-01", name: "Confraternização Universal" },
  { md: "04-21", name: "Tiradentes" },
  { md: "05-01", name: "Dia do Trabalho" },
  { md: "09-07", name: "Independência do Brasil" },
  { md: "10-12", name: "Nossa Senhora Aparecida" },
  { md: "11-02", name: "Finados" },
  { md: "11-15", name: "Proclamação da República" },
  { md: "11-20", name: "Dia Nacional de Zumbi e da Consciência Negra", fromYear: 2024 }, // Lei 14.759/2023 (feriado nacional a partir de 2024)
  { md: "12-25", name: "Natal" },
];

/** Retorna o feriado nacional da data (ou null). Cobre 2020-2035. */
export function getBrazilianHoliday(dateStr: string): Holiday | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y] = dateStr.split("-").map(Number);
  if (y < 2020 || y > 2035) return null;

  const fixed = FIXED.find((f) => dateStr.endsWith(f.md) && (!f.fromYear || y >= f.fromYear));
  if (fixed) return { date: dateStr, name: fixed.name };

  const easter = easterSunday(y);
  const carnival = addDays(easter, -47); // terça de Carnaval (aprox. 47 dias antes)
  const goodFriday = addDays(easter, -2);
  const corpusChristi = addDays(easter, 60);

  const movable: Holiday[] = [
    { date: ymd(carnival), name: "Carnaval", optional: true },
    { date: ymd(addDays(carnival, -1)), name: "Carnaval (segunda)", optional: true },
    { date: ymd(goodFriday), name: "Sexta-feira Santa" },
    { date: ymd(corpusChristi), name: "Corpus Christi", optional: true },
  ];
  return movable.find((h) => h.date === dateStr) ?? null;
}

/** true só para feriados nacionais por lei (exclui pontos facultativos como Carnaval e Corpus Christi). */
export function isBrazilianHoliday(dateStr: string): boolean {
  const h = getBrazilianHoliday(dateStr);
  return h != null && !h.optional;
}
