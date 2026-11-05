import { describe, expect, it } from "vitest";
import React, { createElement } from "react";
(globalThis as { React?: typeof React }).React = React; // componente usa JSX automático no app
import { renderToStaticMarkup } from "react-dom/server";
import FloatingContactButton from "../client/src/components/FloatingContactButton";

describe("bolinha Fale conosco", () => {
  it("renderiza botão fixo no canto inferior direito com safe-area", () => {
    const html = renderToStaticMarkup(createElement(FloatingContactButton, { onOpen: () => {} }));
    expect(html).toContain('aria-label="Fale conosco"');
    expect(html).toContain("fixed");
    expect(html).toContain("safe-area-inset-bottom");
  });
  it("some enquanto o chat está aberto", () => {
    expect(renderToStaticMarkup(createElement(FloatingContactButton, { onOpen: () => {}, hidden: true }))).toBe("");
  });
});
