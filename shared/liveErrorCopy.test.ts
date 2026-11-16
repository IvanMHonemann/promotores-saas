import { describe, expect, it } from "vitest";
import {
  applyLiveErrorOverride,
  classifyLiveError,
  extractPlace,
  formatLiveErrorWhen,
  isGrowing,
  liveErrorsHeadline,
  type LiveErrorInput,
} from "./liveErrorCopy";

function base(over: Partial<LiveErrorInput> = {}): LiveErrorInput {
  return { title: "Error", count24h: 1, count7d: 1, userCount: 1, ...over };
}

describe("classifyLiveError", () => {
  it("trata TypeError: Failed to fetch como falha de rede normal, não como bug de código", () => {
    const copy = classifyLiveError(base({ title: "TypeError: Failed to fetch", culprit: "https://gondup.com/lojas" }));
    expect(copy.kind).toBe("network");
    expect(copy.action).toBe("expected");
    expect(copy.severity).toBe("leve");
    expect(copy.title).toMatch(/conexão/i);
    expect(copy.place).toBe("Lojas");
    expect(copy.actionReason).toMatch(/rede|offline/i);
  });

  it("classifica TypeError real de código como precisa corrigir", () => {
    const copy = classifyLiveError(base({
      title: "TypeError: Cannot read properties of undefined (reading 'map')",
      metadataType: "TypeError",
      transaction: "/cartao-ponto",
      count24h: 8,
      count7d: 10,
      userCount: 4,
    }));
    expect(copy.kind).toBe("type_error");
    expect(copy.action).toBe("needs_fix");
    expect(copy.severity).toBe("grave");
    expect(copy.place).toBe("Cartão-ponto");
    expect(copy.actionReason).toMatch(/TypeError/);
  });

  it("classifica ReferenceError como precisa corrigir", () => {
    const copy = classifyLiveError(base({ title: "ReferenceError: foo is not defined", metadataType: "ReferenceError" }));
    expect(copy.kind).toBe("reference_error");
    expect(copy.action).toBe("needs_fix");
  });

  it("classifica erro 500 do servidor como precisa corrigir e grave", () => {
    const copy = classifyLiveError(base({ title: "Internal Server Error", metadataValue: "HTTP 500", userCount: 2, count24h: 3, count7d: 3 }));
    expect(copy.kind).toBe("server_500");
    expect(copy.action).toBe("needs_fix");
    expect(copy.severity).toBe("grave");
  });

  it("classifica falha de banco como precisa corrigir e grave", () => {
    const copy = classifyLiveError(base({ title: "TiDB server timeout", culprit: "drizzle query companies" }));
    expect(copy.kind).toBe("database");
    expect(copy.action).toBe("needs_fix");
    expect(copy.severity).toBe("grave");
  });

  it("trata um ChunkLoadError isolado como normal e o persistente como precisa corrigir", () => {
    const once = classifyLiveError(base({ title: "ChunkLoadError: Loading chunk 5 failed", count24h: 1, count7d: 1, userCount: 1 }));
    expect(once.kind).toBe("chunk_load");
    expect(once.action).toBe("expected");

    const many = classifyLiveError(base({ title: "Failed to fetch dynamically imported module", count24h: 6, count7d: 8, userCount: 3 }));
    expect(many.action).toBe("needs_fix");
    expect(many.actionReason).toMatch(/várias vezes|carregar/i);
  });

  it("trata foto de check-in que caiu por sinal fraco como normal", () => {
    const copy = classifyLiveError(base({
      title: "TypeError: Failed to fetch",
      culprit: "/api/trpc/storePhotos.upload",
      transaction: "/check-in-out",
    }));
    expect(copy.kind).toBe("checkin_photo");
    expect(copy.action).toBe("expected");
    expect(copy.place).toBe("Check-in e check-out");
    expect(copy.actionReason).toMatch(/foto|sinal/i);
  });

  it("trata GPS ou câmera negados como normal", () => {
    const gps = classifyLiveError(base({ title: "NotAllowedError: User denied Geolocation" }));
    expect(gps.kind).toBe("gps_camera");
    expect(gps.action).toBe("expected");
    const camera = classifyLiveError(base({ title: "NotFoundError: Requested device not found", culprit: "getUserMedia" }));
    expect(camera.kind).toBe("gps_camera");
    expect(camera.action).toBe("expected");
  });

  it("trata timeout do aparelho e cancelamento do usuário como normal", () => {
    const timeout = classifyLiveError(base({ title: "TimeoutError: signal timed out" }));
    expect(timeout.kind).toBe("timeout");
    expect(timeout.action).toBe("expected");
    const abort = classifyLiveError(base({ title: "AbortError: The user aborted a request" }));
    expect(abort.kind).toBe("user_abort");
    expect(abort.action).toBe("expected");
  });

  it("trata extensão do navegador e ruído do service worker como normal", () => {
    const ext = classifyLiveError(base({ title: "TypeError: can't access dead object", culprit: "chrome-extension://abcdef/content.js" }));
    expect(ext.kind).toBe("browser_extension");
    expect(ext.action).toBe("expected");
    const sw = classifyLiveError(base({ title: "InvalidStateError: Failed to update a ServiceWorker", count24h: 40, count7d: 200, userCount: 12 }));
    expect(sw.kind).toBe("service_worker");
    expect(sw.isServiceWorkerNoise).toBe(true);
    expect(sw.action).toBe("expected");
    expect(sw.severity).toBe("leve");
  });

  it("trata sessão expirada como normal", () => {
    const copy = classifyLiveError(base({ title: "Error: Não autenticado", metadataValue: "401 unauthorized" }));
    expect(copy.kind).toBe("session");
    expect(copy.action).toBe("expected");
  });

  it("marca como crescente quando o volume do dia dispara", () => {
    const copy = classifyLiveError(base({
      title: "TypeError: Cannot read properties of null (reading 'id')",
      count24h: 20,
      count7d: 24,
      userCount: 2,
    }));
    expect(copy.growing).toBe(true);
    expect(copy.action).toBe("needs_fix");
  });
});

describe("isGrowing e headline", () => {
  it("detecta crescimento e formata o resumo do topo", () => {
    expect(isGrowing(1, 20)).toBe(false);
    expect(isGrowing(10, 12)).toBe(true);
    expect(liveErrorsHeadline({ needsFix24h: 0, grave24h: 0, expected24h: 4 })).toBe("Nenhum erro nas últimas 24h");
    expect(liveErrorsHeadline({ needsFix24h: 2, grave24h: 0, expected24h: 5 })).toBe("2 problemas nas últimas 24h");
    expect(liveErrorsHeadline({ needsFix24h: 3, grave24h: 1, expected24h: 0 })).toBe("3 problemas nas últimas 24h, 1 grave");
  });
});

describe("extractPlace, datas e override", () => {
  it("traduz rotas conhecidas e formata horário de Brasília", () => {
    expect(extractPlace("https://gondup.com/espelho-ponto?mes=2026-11")).toBe("Espelho de ponto");
    expect(extractPlace("/plataforma/scanner")).toBe("Erros ao vivo");
    expect(extractPlace(null, undefined)).toBe("Tela não identificada");
    expect(formatLiveErrorWhen("2026-11-16T12:21:00.000Z")).toBe("16/11/2026, 09:21");
  });

  it("permite marcar como normal e desfazer", () => {
    const copy = classifyLiveError(base({ title: "TypeError: x is not a function", count24h: 2, userCount: 1 }));
    expect(copy.action).toBe("needs_fix");
    const marked = applyLiveErrorOverride(copy, "expected");
    expect(marked.action).toBe("expected");
    expect(marked.severity).toBe("leve");
    expect(marked.actionReason).toMatch(/marcou este erro como normal/i);
    const undone = applyLiveErrorOverride(marked, "needs_fix");
    expect(undone.action).toBe("needs_fix");
    expect(undone.actionReason).toMatch(/desfez/i);
  });
});
