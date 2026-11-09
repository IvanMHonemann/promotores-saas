/**
 * O servidor precisa rodar em UTC (como na Vercel).
 *
 * O banco (TiDB) guarda DATETIME em UTC e várias consultas em SQL puro fazem
 * `new Date("2026-11-09 20:14:03")` — o Node interpreta isso no fuso do processo.
 * O mysql2 também serializa parâmetros Date no fuso do processo. Com
 * TZ=America/Sao_Paulo (VPS em 09/11/2026) todos esses horários ficaram +3h
 * (ex.: alerta de batida "Entrada 20:14" para uma entrada às 17:14).
 *
 * Este módulo deve ser o PRIMEIRO import dos entrypoints do servidor.
 */
export function forceUtc(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const previous = env.TZ;
  if (previous !== "UTC") {
    env.TZ = "UTC";
    if (previous) console.warn(`[tz] TZ=${previous} ignorado; o servidor roda em UTC.`);
  }
  return previous;
}

forceUtc();
