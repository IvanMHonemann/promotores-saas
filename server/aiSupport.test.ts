import { describe, expect, it } from "vitest";
import { asksForChange, buildUserParts, explainGithubError, isAiEditablePath, needsCode } from "./aiGithubService";
import { classifyAiFile } from "../shared/aiAttachments";

describe("suporte com IA", () => {
  it("só abre PR quando há pedido de alteração (e respeita 'não altere')", () => {
    expect(asksForChange("Corrija o botão da tela de lojas")).toBe(true);
    expect(asksForChange("Faça o botão ficar verde")).toBe(true);
    expect(asksForChange("Procure erros e não altere nada ainda")).toBe(false);
    expect(asksForChange("O que você consegue fazer?")).toBe(true); // 'fazer' conta, mas sem changes nada é aberto
    expect(asksForChange("Oi, tudo bem?")).toBe(false);
  });
  it("lê código quando há anexos ou pedido de análise", () => {
    expect(needsCode("oi", true)).toBe(true);
    expect(needsCode("procure erros no código", false)).toBe(true);
    expect(needsCode("bom dia", false)).toBe(false);
  });
  it("nunca deixa a IA mexer em segredos, testes ou no núcleo de login", () => {
    expect(isAiEditablePath("client/src/pages/ProductsPage.tsx")).toBe(true);
    expect(isAiEditablePath("server/modules/products.ts")).toBe(true);
    expect(isAiEditablePath("server/_core/context.ts")).toBe(false);
    expect(isAiEditablePath("server/aiSupport.test.ts")).toBe(false);
    expect(isAiEditablePath(".env")).toBe(false);
    expect(isAiEditablePath("drizzle/0001.sql")).toBe(false);
    expect(isAiEditablePath("package.json")).toBe(true);
  });
  it("explica os erros do GitHub em português", () => {
    expect(explainGithubError(401, "Bad credentials")).toContain("GITHUB_TOKEN");
    expect(explainGithubError(403, "Resource not accessible by personal access token")).toContain("Pull requests");
    expect(explainGithubError(404, "Not Found")).toContain("Repository access");
  });
  it("envia fotos/PDF como arquivo para o modelo e textos como texto", () => {
    const parts = buildUserParts("veja", [
      { name: "print.jpg", mimeType: "image/jpeg", kind: "image", data: "AAAA" },
      { name: "log.txt", mimeType: "text/plain", kind: "text", data: "erro x" },
      { name: "doc.pdf", mimeType: "application/pdf", kind: "pdf", data: "BBBB" },
    ]);
    expect(parts.some((p: any) => p.inlineData?.mimeType === "image/jpeg")).toBe(true);
    expect(parts.some((p: any) => p.inlineData?.mimeType === "application/pdf")).toBe(true);
    expect(parts.some((p: any) => String(p.text).includes("erro x"))).toBe(true);
    expect(classifyAiFile("a.png", "image/png")).toBe("image");
    expect(classifyAiFile("a.tsx", "")).toBe("text");
    expect(classifyAiFile("a.pdf", "application/pdf")).toBe("pdf");
    expect(classifyAiFile("a.zip", "application/zip")).toBeNull();
  });
});
