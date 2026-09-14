import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  findBaselineDisciplineViolations,
  UNAVAILABLE_REGIME,
  type BaselineReport,
} from "../../scripts/obs/baseline-regime";
import { verdictFor } from "../../scripts/obs/rum-percentiles";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const artifactDir = join(root, "docs", "evidence", "slo-ai-2026-09-14");
const iaPath = join(artifactDir, "ai-latency-controlled.json");
const frontendPath = join(artifactDir, "frontend-p75.json");
const sloDocPath = join(root, "docs", "evidence", "slo-ai-2026-09-14.md");
const rumSourcePath = join(root, "docs", "evidence", "rum-p75-2026-09-13", "raw.json");

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function readFile(path: string): string {
  return readFileSync(path, "utf8");
}

interface ArtifactSeries {
  name: string;
  scenario?: string;
  regime: string;
  provider: string;
  n: number;
  p75?: number;
  verdict?: string;
  window_start?: string;
  window_end?: string;
}

interface ArtifactUnavailable {
  name: string;
  regime: string;
  provider: string;
  n: number;
  reason: string;
}

function seriesOf(report: Record<string, unknown>): ArtifactSeries[] {
  return (report.series ?? []) as ArtifactSeries[];
}

function unavailableOf(report: Record<string, unknown>): ArtifactUnavailable[] {
  return (report.unavailable ?? []) as ArtifactUnavailable[];
}

/** Verifica o p75 com a função oficial de `scripts/obs/rum-percentiles.ts`. */
function officialVerdict(row: { name: string; n: number; p75: number }): string {
  return verdictFor(row as Parameters<typeof verdictFor>[0]);
}

describe("§29 — disciplina de baseline CONTROLADO (mock) × OBSERVED (provider real)", () => {
  it("rejeita números de mock e de provider real no mesmo relatório", () => {
    const violations = findBaselineDisciplineViolations({
      regime: "CONTROLLED",
      provider: "mock",
      series: [
        { name: "app.ai.time_to_final", regime: "CONTROLLED", provider: "mock", n: 50 },
        { name: "app.ai.time_to_final", regime: "OBSERVED", provider: "real", n: 40 },
      ],
    });

    expect(violations.join("\n")).toContain("misturado com o relatório CONTROLLED");
    expect(violations.join("\n")).toContain(
      "relatório CONTROLADO exige provider mock em todas as séries",
    );
  });

  it("rejeita rótulo CONTROLADO sobre provider real, mesmo sem mistura de séries", () => {
    const violations = findBaselineDisciplineViolations({
      regime: "CONTROLLED",
      provider: "real",
      series: [{ name: "app.ai.time_to_final", regime: "CONTROLLED", provider: "real", n: 40 }],
    });

    expect(violations).toContain(
      "app.ai.time_to_final: rótulo CONTROLADO não pode rotular provider real",
    );
    expect(violations.join("\n")).toContain("relatório CONTROLADO exige provider mock");
  });

  it("rejeita OBSERVED sem amostras e OBSERVED-UNAVAILABLE com amostras", () => {
    const semAmostras = findBaselineDisciplineViolations({
      regime: "OBSERVED",
      provider: "real",
      series: [{ name: "app.ai.time_to_final", regime: "OBSERVED", provider: "real", n: 0 }],
    });
    expect(semAmostras).toContain("relatório OBSERVED sem amostras: medição real precisa de n > 0");

    const indisponivelComAmostra = findBaselineDisciplineViolations({
      regime: "CONTROLLED",
      provider: "mock",
      series: [{ name: "app.ai.time_to_final", regime: "CONTROLLED", provider: "mock", n: 50 }],
      unavailable: [
        {
          name: "app.ai.time_to_final",
          regime: UNAVAILABLE_REGIME,
          provider: "real",
          n: 7,
          reason: "não deveria carregar amostras",
        },
      ],
    });
    expect(indisponivelComAmostra.join("\n")).toContain("não pode carregar amostras (n=7)");
  });

  it("aceita o baseline CONTROLADO do §29 (mock) com provider real declarado indisponível", () => {
    const ia = readJson(iaPath) as unknown as BaselineReport;

    expect(findBaselineDisciplineViolations(ia)).toEqual([]);
    expect(ia.regime).toBe("CONTROLLED");
    expect(ia.provider).toBe("mock");
    expect(
      seriesOf(ia as unknown as Record<string, unknown>).map((entry) => entry.scenario),
    ).toEqual([
      "mock-no-tool",
      "mock-no-tool",
      "mock-no-tool",
      "mock-tool-round",
      "mock-tool-round",
      "mock-tool-round",
    ]);
    expect(
      unavailableOf(ia as unknown as Record<string, unknown>).map((entry) => entry.regime),
    ).toEqual([UNAVAILABLE_REGIME, UNAVAILABLE_REGIME, UNAVAILABLE_REGIME]);
    expect(unavailableOf(ia as unknown as Record<string, unknown>).every((e) => e.n === 0)).toBe(
      true,
    );
  });

  it("não versiona nenhuma amostra de provider real (OBSERVED inexistente sem H-6)", () => {
    const artifacts = [readJson(iaPath), readJson(frontendPath)];

    for (const artifact of artifacts) {
      expect(artifact.provider).toBe("mock");
      expect(seriesOf(artifact).every((entry) => entry.provider === "mock")).toBe(true);
      expect(seriesOf(artifact).every((entry) => entry.regime === "CONTROLLED")).toBe(true);
      expect(
        unavailableOf(artifact).every(
          (entry) =>
            entry.provider === "real" && entry.regime === UNAVAILABLE_REGIME && entry.n === 0,
        ),
      ).toBe(true);
    }
  });

  it("deriva o p75 do frontend do raw versionado do §17.8 sem recriar limiares", () => {
    const source = readJson(rumSourcePath);
    const extract = readJson(frontendPath);
    const sourceRows = (source.rows ?? []) as Array<{
      name: string;
      n: number;
      p75: number;
      verdict: string;
      window_start: string;
      window_end: string;
    }>;

    expect(extract.window).toBe(source.window);
    expect(extract.min_samples).toBe(source.min_samples);
    expect(extract.targets).toEqual(source.targets);
    const targets = (source.targets ?? {}) as Record<
      string,
      { target: number; unit: string; label: string }
    >;
    expect(seriesOf(extract)).toEqual(
      sourceRows.map((row) => ({
        name: row.name,
        regime: "CONTROLLED",
        provider: "mock",
        n: row.n,
        p75: row.p75,
        unit: targets[row.name]?.unit ?? "",
        target: targets[row.name]?.target ?? null,
        target_label: targets[row.name]?.label ?? null,
        verdict: row.verdict,
        window_start: row.window_start,
        window_end: row.window_end,
      })),
    );
    for (const row of sourceRows) {
      expect(officialVerdict(row)).toBe(row.verdict);
    }
  });

  it("registra nos artefatos do §29 os alvos oficiais, N, janela e a lacuna H-6", () => {
    const doc = readFile(sloDocPath);
    const ia = readJson(iaPath);
    const frontend = readJson(frontendPath);
    const iaWindow = ia.window as { started_at: string; ended_at: string };

    // IA: método, N, janela e regime mock CONTROLADO.
    expect(doc).toContain("CONTROLADO");
    expect(doc).toContain("mock");
    expect(doc).toContain("n = 50");
    expect(doc).toContain(iaWindow.started_at);
    expect(doc).toContain(iaWindow.ended_at);
    for (const entry of seriesOf(ia)) {
      expect(doc).toContain(entry.name);
      expect(doc).toContain(entry.scenario ?? "");
    }
    // Não-streaming: as duas séries valem o mesmo hoje, documentado no artefato.
    expect(doc).toContain("time_to_first_content == time_to_final");

    // Frontend: alvos oficiais, N, janela e fonte re-derivável.
    expect(frontend.regime).toBe("CONTROLLED");
    expect(doc).toContain("LCP ≤ 2,5 s");
    expect(doc).toContain("INP ≤ 200 ms");
    expect(doc).toContain("CLS ≤ 0,1");
    expect(doc).toContain("docs/evidence/rum-p75-2026-09-13/raw.json");
    expect(doc).toContain("docs/evidence/slo-ai-2026-09-14/frontend-p75.json");
    for (const entry of seriesOf(frontend)) {
      expect(doc).toContain(`N=${entry.n}`);
    }
    expect(doc).toContain("2026-09-12T10:45:51.597Z → 2026-09-14T01:45:51.597Z");
    expect(doc).toContain("OK");
    expect(doc).toContain("N/A (N=12 < 20)");

    // Nenhum baseline provider-real existe: H-6 pendente, declarado nos dois artefatos.
    expect(doc).toContain("OBSERVED-UNAVAILABLE");
    expect(doc).toContain("H-6");
    expect(doc).toContain("OBSERVED");
  });
});
