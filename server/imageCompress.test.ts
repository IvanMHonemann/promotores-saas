import { describe, expect, it } from "vitest";
import { COMPRESSION_PLAN, IMAGE_MAX_SIDE, IMAGE_START_QUALITY, IMAGE_TARGET_BYTES, assertPhotoSize, compressToTarget } from "../client/src/lib/imageCompress";
import { MAX_PHOTO_BASE64_CHARS } from "../shared/uploadLimits";

const fakeBlob = (size: number) => ({ size } as Blob);

describe("compressão de fotos", () => {
  it("começa em 1600 px e qualidade 0,75", () => {
    expect(COMPRESSION_PLAN[0]).toEqual({ maxSide: IMAGE_MAX_SIDE, quality: IMAGE_START_QUALITY });
    expect(IMAGE_MAX_SIDE).toBe(1600);
  });
  it("para na primeira tentativa que fica abaixo do alvo (~500 KB)", async () => {
    const calls: number[] = [];
    const sizes = [1_400_000, 900_000, 420_000, 100_000];
    const out = await compressToTarget(async (side, q) => { calls.push(q); return fakeBlob(sizes[calls.length - 1]); });
    expect(out.size).toBe(420_000);
    expect(calls.length).toBe(3);
  });
  it("nunca piora: devolve a menor versão se nenhuma atingir o alvo", async () => {
    let n = 0;
    const out = await compressToTarget(async () => fakeBlob([3e6, 2e6, 1.5e6, 1.2e6, 9e5, 8e5][n++]));
    expect(out.size).toBe(8e5);
    expect(n).toBe(COMPRESSION_PLAN.length);
  });
  it("cada passo reduz qualidade ou tamanho", () => {
    for (let i = 1; i < COMPRESSION_PLAN.length; i++) {
      const a = COMPRESSION_PLAN[i - 1], b = COMPRESSION_PLAN[i];
      expect(b.maxSide < a.maxSide || b.quality < a.quality).toBe(true);
    }
    expect(IMAGE_TARGET_BYTES).toBe(500 * 1024);
  });
  it("verificação final de tamanho com mensagem em pt-BR", () => {
    expect(() => assertPhotoSize("a".repeat(MAX_PHOTO_BASE64_CHARS + 1))).toThrow(/grande demais/);
    expect(() => assertPhotoSize("a".repeat(1000))).not.toThrow();
  });
});
