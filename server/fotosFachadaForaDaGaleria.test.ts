import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { FACADE_KEY_PREFIXES, facadePhotoAction, facadePhotoKey, isFacadePhotoKey } from "../shared/facadePhotos";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// Pedido do Ivan (10/11/2026): fotos de check-in/check-out NÃO podem aparecer na galeria da loja.
describe("fotos de fachada fora da galeria da loja", () => {
  it("reconhece chaves de fachada (atual e antiga) e a ação", () => {
    const k = facadePhotoKey(690003, "start", "a".repeat(32));
    expect(isFacadePhotoKey(k)).toBe(true);
    expect(facadePhotoAction(k)).toBe("start");
    expect(facadePhotoAction(facadePhotoKey(5, "complete", "b".repeat(32)))).toBe("complete");
    expect(facadePhotoAction("visit-180003-complete-1761256212000")).toBe("complete");
    expect(k.length).toBeLessThanOrEqual(64);
  });

  it("foto normal da galeria (chave hexadecimal) não é tratada como fachada", () => {
    const hex = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    expect(isFacadePhotoKey(hex)).toBe(false);
    expect(isFacadePhotoKey(null)).toBe(false);
    expect(src("client/src/components/PhotoCapture.tsx")).toMatch(/idempotencyKey = crypto\.randomUUID\(\)\.replace\(\/-\/g, ""\)/);
  });

  it("check-in/check-out grava com a chave de fachada", () => {
    expect(src("client/src/components/VisitCheckIn.tsx")).toMatch(/idempotencyKey: facadePhotoKey\(visitId, action,/);
  });

  it("galeria, contagens e 'sem loja' excluem fotos de fachada", () => {
    const s = src("server/modules/storePhotos.ts");
    for (const p of FACADE_KEY_PREFIXES) expect(s).toContain(`NOT LIKE '${p}%'`);
    const block = (name: string) => s.slice(s.indexOf(`${name}: commercialFeatureProcedure`), s.indexOf("commercialFeatureProcedure", s.indexOf(`${name}: commercialFeatureProcedure`) + 40));
    expect(block("listByStore")).toContain("GALLERY_ONLY");
    expect(block("countWithoutStore")).toContain("GALLERY_ONLY");
    expect(block("listStoresWithStats").match(/GALLERY_ONLY/g)?.length).toBe(2);
    expect(block("listVisitFacade")).toContain("NOT ${GALLERY_ONLY}");
  });

  it("página Check-in/Check-out busca as fotos pela visita, não pela galeria", () => {
    const page = src("client/src/pages/admin/CheckInOutPage.tsx");
    expect(page).toContain("storePhotos.listVisitFacade");
    expect(page).not.toContain("storePhotos.listByStore");
  });
});
