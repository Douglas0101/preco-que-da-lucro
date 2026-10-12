import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  classifyBuildWarnings,
  collectWarningLines,
  evaluateBuild,
  stripAnsi,
  warningAllowlist,
} from "../../scripts/lib/build-warnings.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const entry = (overrides = {}) => ({
  id: "WARN-TEST-001",
  signature: "synthetic warning",
  owner: "teste",
  releaseChannels: ["local"],
  expiresOn: "2099-01-01",
  recheckedAt: "2026-10-12",
  ...overrides,
});

describe("gate de warnings do build (fail-closed)", () => {
  it("streams limpos com exit 0 passam", () => {
    const r = evaluateBuild({
      exitCode: 0,
      stdout: "vite build ok\n✓ built in 659ms",
      stderr: "",
      today: "2026-10-12",
      releaseChannel: "local",
    });
    expect(r.passed).toBe(true);
    expect(r.observedWarnings).toEqual([]);
  });

  it("exit != 0 reprova mesmo sem warnings", () => {
    const r = evaluateBuild({ exitCode: 1, today: "2026-10-12", releaseChannel: "local" });
    expect(r.passed).toBe(false);
  });

  it("stderr não registrado reprova (controle negativo)", () => {
    const r = evaluateBuild({
      exitCode: 0,
      stderr: "some plugin noise\n",
      today: "2026-10-12",
      releaseChannel: "local",
    });
    expect(r.passed).toBe(false);
    expect(r.unexpectedWarnings.map((w) => w.line)).toEqual(["some plugin noise"]);
  });

  it("stdout só entra com WARN/(!)/deprecated", () => {
    const lines = collectWarningLines({
      stdout: "plain line\nWARN something\n(!) rolldown note\ndeprecated api\n",
      stderr: "",
    });
    expect(lines).toEqual(["WARN something", "(!) rolldown note", "deprecated api"]);
  });

  it("entrada sintética válida é aceita (canal e expiração vigentes)", () => {
    const r = evaluateBuild({
      exitCode: 0,
      stderr: "synthetic warning\n",
      today: "2026-10-12",
      releaseChannel: "local",
      allowlist: [entry()],
    });
    expect(r.passed).toBe(true);
    expect(r.observedWarnings[0]).toMatchObject({
      exceptionId: "WARN-TEST-001",
      expired: false,
      releaseAllowed: true,
      accepted: true,
    });
  });

  it("entrada EXPIRADA não é aceita (expiração = fail-closed)", () => {
    const r = evaluateBuild({
      exitCode: 0,
      stderr: "synthetic warning\n",
      today: "2026-10-12",
      releaseChannel: "local",
      allowlist: [entry({ expiresOn: "2026-10-06" })],
    });
    expect(r.passed).toBe(false);
    expect(r.observedWarnings[0]).toMatchObject({
      exceptionId: "WARN-TEST-001",
      expired: true,
      accepted: false,
    });
  });

  it("canal não permitido não é aceito", () => {
    const r = evaluateBuild({
      exitCode: 0,
      stderr: "synthetic warning\n",
      today: "2026-10-12",
      releaseChannel: "unclassified-ci",
      allowlist: [entry()],
    });
    expect(r.passed).toBe(false);
    expect(r.observedWarnings[0].releaseAllowed).toBe(false);
  });

  it("assinatura exige igualdade exata (só prefixo de marca e crases são normalizados)", () => {
    const r = classifyBuildWarnings(
      ["WARN synthetic warning", "[warn] synthetic warning", "synthetic warning with extra"],
      { today: "2026-10-12", releaseChannel: "local", allowlist: [entry()] },
    );
    expect(r.map((w) => w.accepted)).toEqual([true, true, false]);
  });

  it("ANSI é removido antes da classificação", () => {
    expect(stripAnsi("\u001b[31mWARN x\u001b[39m")).toBe("WARN x");
    const r = evaluateBuild({
      exitCode: 0,
      stderr: "\u001b[31msynthetic warning\u001b[39m\n",
      today: "2026-10-12",
      releaseChannel: "local",
      allowlist: [entry()],
    });
    expect(r.passed).toBe(true);
  });

  it("regressão do incidente (DBT-109): [PLUGIN_TIMINGS] não é aceito por este gate", () => {
    const incident = "- [PLUGIN_TIMINGS] Your build spent 89% of 3.3s inside plugin hooks (2.9s).";
    const r = evaluateBuild({
      exitCode: 0,
      stderr: `${incident}\n`,
      today: "2026-10-12",
      releaseChannel: "local",
    });
    expect(r.passed).toBe(false);
    expect(r.unexpectedWarnings).toHaveLength(1);
  });

  it("allowlist real: contrato por entrada e nenhuma expirada", () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const item of warningAllowlist) {
      expect(item.id).toMatch(/^WARN-[A-Z0-9-]+$/);
      expect(item.signature.length).toBeGreaterThan(0);
      expect(item.owner.length).toBeGreaterThan(0);
      expect(item.releaseChannels.length).toBeGreaterThan(0);
      expect(item.expiresOn >= today, `${item.id} expirada em ${item.expiresOn}`).toBe(true);
      expect(item.recheckedAt <= today).toBe(true);
    }
  });

  it("vite.config.ts suprime o [PLUGIN_TIMINGS] na origem (cliente e ssr) — pin do DBT-109", () => {
    const config = readFileSync(resolve(repoRoot, "vite.config.ts"), "utf8");
    const disabled = config.match(/pluginTimings:\s*false/g) ?? [];
    expect(disabled.length).toBeGreaterThanOrEqual(2);
    expect(config).toMatch(/checks:\s*\{\s*pluginTimings:\s*false\s*\}/);
  });
});
