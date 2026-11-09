import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateStoreForm } from "../shared/storeForm";

describe("validateStoreForm", () => {
  it("exige nome e cidade e normaliza UF", () => {
    expect(validateStoreForm({ name: " ", city: "SP", state: "", address: "" })).toMatchObject({ ok: false, message: "Informe o nome da loja." });
    expect(validateStoreForm({ name: "Loja", city: "", state: "", address: "" })).toMatchObject({ ok: false, message: "Informe a cidade." });
    expect(validateStoreForm({ name: "Loja", city: "Campinas", state: "s", address: "" })).toMatchObject({ ok: false });
    expect(validateStoreForm({ name: " Loja A ", city: " Campinas ", state: "sp", address: " " })).toEqual({ ok: true, payload: { name: "Loja A", city: "Campinas", state: "SP", address: undefined } });
  });
});

describe("Cadastrar loja em Lojas e em Roteiros", () => {
  it("as duas telas usam o mesmo StoreForm", () => {
    for (const f of ["client/src/pages/StoresPage.tsx", "client/src/pages/operations/RoutesSection.tsx"]) {
      expect(readFileSync(f, "utf8"), f).toMatch(/import StoreForm from "@\/components\/StoreForm"/);
    }
    expect(readFileSync("client/src/pages/operations/RoutesSection.tsx", "utf8")).toContain("Cadastrar loja");
  });
});
