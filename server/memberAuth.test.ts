import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./memberAuth";

describe("member authentication", () => {
  it("hashes passwords and validates only the original password", () => {
    const encoded = hashPassword("SenhaSegura123!");
    expect(encoded).toMatch(/^scrypt:[^:]+:[^:]+$/);
    expect(encoded).not.toContain("SenhaSegura123!");
    expect(verifyPassword("SenhaSegura123!", encoded)).toBe(true);
    expect(verifyPassword("senha-incorreta", encoded)).toBe(false);
  });

  it("uses a different salt for each password hash", () => {
    expect(hashPassword("SenhaSegura123!")).not.toBe(hashPassword("SenhaSegura123!"));
  });
});
