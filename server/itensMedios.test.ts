import { describe, expect, it } from "vitest";
import { detectImageMime } from "./modules/storePhotos";
import { brDate, humanizeValue, translateAction, translateModule } from "../client/src/lib/labels";

describe("detectImageMime", () => {
  it("reconhece JPEG, PNG e WebP pela assinatura", () => {
    expect(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/jpeg");
    expect(detectImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBe("image/png");
    expect(detectImageMime(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]))).toBe("image/webp");
  });
  it("recusa arquivos que não são imagem", () => {
    expect(detectImageMime(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectImageMime(Buffer.from([1, 2, 3]))).toBeNull();
  });
});

describe("labels", () => {
  it("traduz ações e módulos", () => {
    expect(translateAction("approved")).toBe("aprovado");
    expect(translateAction("clock_in")).toBe("entrada");
    expect(translateModule("products")).toBe("produtos");
  });
  it("formata datas", () => {
    expect(brDate("2026-11-07")).toBe("07/11/2026");
    expect(humanizeValue("2026-11-04 11:00:00.000000")).toBe("04/11/2026, 08:00:00");
    expect(humanizeValue({ status: "approved" })).toEqual({ status: "aprovado" });
  });
});
