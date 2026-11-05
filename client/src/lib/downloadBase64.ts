/** Baixa um arquivo recebido do servidor em base64. */
export function downloadBase64(base64: string, fileName: string, mimeType = "application/octet-stream") {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Mês atual AAAA-MM no fuso de São Paulo. */
export function currentMonthSP(offset = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  let y = Number(parts.find((p) => p.type === "year")?.value);
  let m = Number(parts.find((p) => p.type === "month")?.value) + offset;
  while (m < 1) { m += 12; y -= 1; }
  while (m > 12) { m -= 12; y += 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export const fmtDateTimeSP = (v: string | Date | null | undefined) =>
  v ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export const fmtMinutes = (n: number | null | undefined) => {
  if (n == null) return "—";
  const a = Math.abs(Math.round(n));
  return `${n < 0 ? "-" : ""}${Math.floor(a / 60)}h${String(a % 60).padStart(2, "0")}`;
};
