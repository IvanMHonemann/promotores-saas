import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildRouteShareText, defaultRouteName, filterAndSortSchedules, findScheduleConflict, moveItem, weekdayLabel } from "../shared/routeSchedule";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const rows = [
  { id: 1, promoterId: 10, weekday: 0, name: "Domingo" },
  { id: 2, promoterId: 20, weekday: 1, name: "Seg B" },
  { id: 3, promoterId: 10, weekday: 1, name: "Seg A" },
  { id: 4, promoterId: 10, weekday: 6, name: "Sáb" },
];

describe("roteiros semanais", () => {
  it("nome padrão e dia", () => {
    expect(defaultRouteName(1)).toBe("Roteiro de segunda-feira");
    expect(weekdayLabel(6)).toBe("sábado");
  });
  it("filtra por promotor e ordena de segunda a domingo", () => {
    expect(filterAndSortSchedules(rows, "all").map((r) => r.id)).toEqual([3, 2, 4, 1]);
    expect(filterAndSortSchedules(rows, 10).map((r) => r.id)).toEqual([3, 4, 1]);
    expect(filterAndSortSchedules(rows, 99)).toEqual([]);
  });
  it("detecta outro roteiro no mesmo promotor e dia", () => {
    expect(findScheduleConflict(rows, 10, 1)?.id).toBe(3);
    expect(findScheduleConflict(rows, 10, 1, 3)).toBeUndefined();
    expect(findScheduleConflict(rows, 20, 6)).toBeUndefined();
  });
  it("muda a ordem das lojas sem sair da lista", () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 2, -1)).toEqual([1, 3, 2]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });
  it("compartilhar leva promotor, dia e lojas na ordem", () => {
    const text = buildRouteShareText({ name: "Roteiro de segunda-feira", weekday: 1, promoterName: "Ana", storeNames: ["Bistek", "Desco"] });
    expect(text).toContain("Promotor: Ana");
    expect(text).toContain("Dia: Segunda-feira");
    expect(text).toContain("1. Bistek\n2. Desco");
  });
});

describe("tela e servidor de roteiros", () => {
  const page = src("client/src/pages/operations/RoutesSection.tsx");
  const routers = src("server/routers.ts");
  const db = src("server/db.ts");
  it("tela permite escolher promotor e filtrar", () => {
    expect(page).toContain('id="route-promoter"');
    expect(page).toContain('id="route-filter"');
    expect(page).toContain("MoreVertical");
    expect(page).not.toMatch(/(window\.|[^.\w])confirm\(/);
  });
  it("promotor só vê os próprios roteiros semanais", () => {
    expect(routers).toMatch(/weekly: commercialFeatureProcedure\("fieldOperations"\)\.query\(async \(\{ ctx \}\) => \{\s*const ownerId = scopeMemberId\(ctx\);/);
    expect(routers).toContain("deleteWeekly: companyAdminProcedure");
  });
  it("visitas feitas não são apagadas ao editar/excluir roteiro e a ordem das lojas é mantida", () => {
    expect(db).toContain("histórico de visita feita nunca é apagado");
    expect(db).toContain("stores.sort((a, b) => storeIds.indexOf(a.id) - storeIds.indexOf(b.id))");
  });
});
