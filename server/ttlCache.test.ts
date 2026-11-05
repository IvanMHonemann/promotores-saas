import { describe, expect, it, vi } from "vitest";
import { createTtlCache } from "./ttlCache";
describe("ttlCache", () => {
  it("reaproveita e expira", async () => {
    vi.useFakeTimers();
    const c = createTtlCache<number>(1000); let n = 0; const load = async () => ++n;
    expect(await c.get("a", load)).toBe(1); expect(await c.get("a", load)).toBe(1);
    vi.advanceTimersByTime(1001); expect(await c.get("a", load)).toBe(2);
    vi.useRealTimers();
  });
  it("não guarda erro", async () => {
    const c = createTtlCache<number>(1000);
    await expect(c.get("x", async () => { throw new Error("x"); })).rejects.toThrow();
    await new Promise(r => setTimeout(r));
    expect(await c.get("x", async () => 5)).toBe(5);
  });
});
