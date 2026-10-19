import { describe, expect, it } from "vitest";
import { barcodeVariants, isValidGtin } from "../shared/barcode";

describe("código de barras", () => {
  it("valida dígito verificador GTIN", () => {
    expect(isValidGtin("7891000100103")).toBe(true);
    expect(isValidGtin("7891000100104")).toBe(false);
    expect(isValidGtin("036000291452")).toBe(true);
    expect(isValidGtin("96385074")).toBe(true);
  });
  it("gera variantes UPC-A/EAN-13", () => {
    expect(barcodeVariants("036000291452")).toContain("0036000291452");
    expect(barcodeVariants("0036000291452")).toContain("036000291452");
  });
});
