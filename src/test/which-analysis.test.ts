import { describe, expect, it } from "vitest";

import {
  decideWhichAnalysis,
  type AnalysisRecord,
  type CoverageFact,
} from "../../scripts/sonar/which-analysis";

/**
 * Ciclo 22 / F2 — o closure test de `DBT-59` e o de `DBT-61` são o **mesmo executável**.
 *
 * `DBT-59` fecha quando a análise em vigor é **nomeada por commit**, nunca inferida pela ordem.
 * `DBT-61` fecha quando essa nomeação também detecta **desvio de atribuição** — a árvore de uma
 * branch arquivada sob outra, que foi o defeito medido (commit de `develop` gravado como `main`).
 *
 * O núcleo é puro: nenhum caso toca a rede, então o teste é determinístico e reproduzível por clone.
 */

const analise = (over: Partial<AnalysisRecord> = {}): AnalysisRecord => ({
  key: "chave-1",
  revision: "2d73fa32933aa6968e1ae87edbd7d28422754a82",
  branch: "main",
  date: "2026-10-01T02:55:04+0000",
  ...over,
});

const cobertura = (branch: string, coverage: number | null): CoverageFact => ({ branch, coverage });

describe("F2 · which-analysis — nomeia a análise por commit", () => {
  it("scanner-only: cobertura importada prova a origem (a App não importa cobertura)", () => {
    const v = decideWhichAnalysis({
      revision: "2d73fa32",
      analyses: [analise()],
      coverage: [cobertura("main", 63.3)],
    });
    expect(v.named).toBe(true);
    expect(v.origin).toBe("scanner");
    expect(v.importedCoverage).toBe(true);
    expect(v.branch).toBe("main");
    expect(v.attributionMismatch).toBe(false);
  });

  it("App-only: cobertura zero NÃO prova App — a origem é declarada indeterminada", () => {
    const v = decideWhichAnalysis({
      revision: "2d73fa32",
      analyses: [analise()],
      coverage: [cobertura("main", 0)],
    });
    expect(v.named).toBe(true);
    expect(v.origin).toBe("indeterminada");
    expect(v.importedCoverage).toBe(false);
    // A distinção que importa: "não sei" nunca é apresentado como "é a App".
    expect(v.reason).toContain("análise única");
  });

  it("cobertura desconhecida (null) também é indeterminada, nunca zero", () => {
    const v = decideWhichAnalysis({
      revision: "2d73fa32",
      analyses: [analise()],
      coverage: [cobertura("main", null)],
    });
    expect(v.origin).toBe("indeterminada");
    expect(v.importedCoverage).toBe(false);
  });

  it("AMBÍGUO: duas análises para o mesmo commit não são desempatadas por ordem", () => {
    const v = decideWhichAnalysis({
      revision: "2d73fa32",
      analyses: [
        analise({ key: "a", branch: "main" }),
        analise({ key: "b", branch: "develop", date: "2026-10-01T03:00:00+0000" }),
      ],
      coverage: [cobertura("main", 0), cobertura("develop", 70)],
    });
    expect(v.named).toBe(false);
    expect(v.reason).toContain("ambíguo por construção");
    // O ponto do DBT-59: recusar é o comportamento correto — escolher "a mais recente" seria a
    // inferência por ordem que a dívida existe para eliminar.
    expect(v.analysisKey).toBeNull();
  });

  it("AUSENTE: commit sem análise não é 'verde', é ausência de veredito", () => {
    const v = decideWhichAnalysis({
      revision: "0000000",
      analyses: [analise()],
      coverage: [cobertura("main", 63.3)],
    });
    expect(v.named).toBe(false);
    expect(v.reason).toContain("nenhuma análise");
  });

  it("DBT-61 DETECTOR: commit de develop arquivado sob main é desvio de atribuição", () => {
    // Este é o caso MEDIDO no Ciclo 22 — a análise de `2d73fa3` (commit de develop) ficou sob `main`.
    const v = decideWhichAnalysis({
      revision: "2d73fa32",
      analyses: [analise({ branch: "main" })],
      coverage: [cobertura("main", 63.3)],
      expectedBranch: "develop",
    });
    expect(v.named).toBe(true);
    expect(v.attributionMismatch).toBe(true);
    expect(v.reason).toContain("desvio de atribuição");
    // A verificação de atribuição é opt-in: sem `expectedBranch`, não há como saber onde o commit
    // vive, e o veredito não inventa.
  });

  it("DBT-61 CONTROLE: commit arquivado na branch certa não acusa desvio", () => {
    const v = decideWhichAnalysis({
      revision: "2d73fa32",
      analyses: [analise({ branch: "develop" })],
      coverage: [cobertura("develop", 63.3)],
      expectedBranch: "develop",
    });
    expect(v.attributionMismatch).toBe(false);
    expect(v.named).toBe(true);
  });

  it("revision abreviada casa por prefixo (o CLI recebe o sha curto do git log)", () => {
    const v = decideWhichAnalysis({
      revision: "2D73FA32",
      analyses: [analise()],
      coverage: [cobertura("main", 63.3)],
    });
    expect(v.named).toBe(true);
    expect(v.analysisKey).toBe("chave-1");
  });
});
