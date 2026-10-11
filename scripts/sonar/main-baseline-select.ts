// Seleção da análise de `main` que serve de baseline (DBT-103).
//
// O defeito medido (run 38112535521, attempt 2): a regra em vigor exigia **exatamente uma**
// análise para a revisão de `main`. Isso é verdade na primeira execução e deixa de ser na
// RE-EXECUÇÃO, que submete uma segunda análise da mesma revisão — o baseline virava NO-VERDICT e
// o selo de proveniência reprovava o check exigido `scan + cobertura`.
//
// A identidade correta não é "a única": é "a do CE **deste** run". O gate readout do próprio job
// carrega o `analysisId` da tarefa que ele acabou de esperar. A seleção conserva a propriedade
// fail-closed que a unicidade protegia — a análise mais recente de `main` tem de ser a NOSSA e estar
// na revisão medida — sem depender de o histórico conter exatamente um registro.

export interface AnalysisSummary {
  key?: string;
  date?: string;
  revision?: string;
}

export type MainAnalysisRefusal =
  | "CE_ANALYSIS_ID_UNAVAILABLE"
  | "ANALYSES_UNAVAILABLE"
  | "NEWEST_ANALYSIS_NOT_OUR_REVISION"
  | "NEWEST_ANALYSIS_NOT_CE_ANALYSIS";

export type MainAnalysisSelection =
  | { ok: true; analysis: AnalysisSummary & { key: string; revision: string } }
  | { ok: false; reasonCode: MainAnalysisRefusal };

export function selectMainAnalysis(input: {
  analyses: AnalysisSummary[] | undefined;
  mainSha: string;
  ceAnalysisId: string | undefined;
}): MainAnalysisSelection {
  const { analyses, mainSha, ceAnalysisId } = input;
  if (typeof ceAnalysisId !== "string" || ceAnalysisId.trim() === "")
    return { ok: false, reasonCode: "CE_ANALYSIS_ID_UNAVAILABLE" };
  if (!Array.isArray(analyses) || analyses.length === 0)
    return { ok: false, reasonCode: "ANALYSES_UNAVAILABLE" };
  const newest = analyses[0] as AnalysisSummary | undefined;
  if (newest?.revision !== mainSha)
    return { ok: false, reasonCode: "NEWEST_ANALYSIS_NOT_OUR_REVISION" };
  if (newest?.key !== ceAnalysisId)
    return { ok: false, reasonCode: "NEWEST_ANALYSIS_NOT_CE_ANALYSIS" };
  return { ok: true, analysis: { ...newest, key: ceAnalysisId, revision: mainSha } };
}
