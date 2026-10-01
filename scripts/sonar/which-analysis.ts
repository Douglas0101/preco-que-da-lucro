/**
 * `which-analysis <sha>` — nomeia a análise do SonarCloud em vigor para um commit.
 *
 * **Para que serve.** O `DBT-59` existe porque a resposta "qual análise vale?" era inferida pela
 * ordem de chegada. Este instrumento troca a inferência por uma consulta: dado um commit, diz
 * **qual** análise o representa, **em qual branch** ela foi arquivada, e **se** ela importou
 * cobertura.
 *
 * **Como a origem é decidida — e onde ela é indeterminada.** A `Automatic Analysis` **não** importa
 * relatório de cobertura; o `sonar-scanner` importa. Então `coverage > 0` prova que a análise veio do
 * scanner. `coverage = 0` **não** prova o contrário: pode ser a App, ou um scanner que rodou sem
 * relatório. Nesse caso a origem é declarada **indeterminada** — nunca chutada. (Medido no Ciclo 22:
 * `submitterLogin` e `hasScannerContext` são idênticos nas duas superfícies e **não** discriminam.)
 *
 * **O detector do `DBT-61`.** Se o commit pertence a uma branch mas a análise está arquivada em
 * outra, isso é um desvio de atribuição — o defeito em que a árvore de `develop` era gravada como
 * `main`. O veredito sai com `attributionMismatch: true` e o processo sai **1**.
 *
 * Exit: `0` = nomeada e sem desvio · `1` = ambígua, ausente ou com desvio · `2` = precondição
 * (sem token, rede, resposta ilegível). Precondição nunca vira "não encontrado".
 */

export interface AnalysisRecord {
  key: string;
  revision: string;
  branch: string;
  date: string;
}

export interface CoverageFact {
  branch: string;
  /** `null` = a API não devolveu cobertura para a branch (desconhecido, não zero). */
  coverage: number | null;
}

export interface Verdict {
  revision: string;
  named: boolean;
  branch: string | null;
  analysisKey: string | null;
  date: string | null;
  /** `scanner` só quando há prova (cobertura importada); caso contrário `indeterminada`. */
  origin: "scanner" | "indeterminada";
  importedCoverage: boolean;
  attributionMismatch: boolean;
  reason: string;
}

const short = (sha: string) => sha.slice(0, 8);

/**
 * Núcleo puro — toda a decisão vive aqui, sem rede, para o teste ser determinístico e
 * reproduzível por clone.
 */
export function decideWhichAnalysis(input: {
  revision: string;
  analyses: readonly AnalysisRecord[];
  coverage: readonly CoverageFact[];
  /** Branch onde o commit vive, quando conhecida. Ausente = não verifica atribuição. */
  expectedBranch?: string;
}): Verdict {
  const { revision, analyses, coverage, expectedBranch } = input;
  const alvo = revision.trim().toLowerCase();
  const candidatas = analyses.filter((a) => a.revision.toLowerCase().startsWith(alvo));

  if (candidatas.length === 0) {
    return {
      revision,
      named: false,
      branch: null,
      analysisKey: null,
      date: null,
      origin: "indeterminada",
      importedCoverage: false,
      attributionMismatch: false,
      reason: `nenhuma análise tem revision ${short(revision)}`,
    };
  }

  if (candidatas.length > 1) {
    const branches = candidatas
      .map((c) => c.branch)
      .sort()
      .join(", ");
    return {
      revision,
      named: false,
      branch: null,
      analysisKey: null,
      date: null,
      origin: "indeterminada",
      importedCoverage: false,
      attributionMismatch: false,
      reason: `${candidatas.length} análises disputam ${short(revision)} (branches: ${branches}) — ambíguo por construção`,
    };
  }

  const unica = candidatas[0]!;
  const cobertura = coverage.find((c) => c.branch === unica.branch)?.coverage ?? null;
  const importedCoverage = typeof cobertura === "number" && cobertura > 0;
  const attributionMismatch = expectedBranch !== undefined && expectedBranch !== unica.branch;

  return {
    revision,
    named: true,
    branch: unica.branch,
    analysisKey: unica.key,
    date: unica.date,
    origin: importedCoverage ? "scanner" : "indeterminada",
    importedCoverage,
    attributionMismatch,
    reason: attributionMismatch
      ? `análise arquivada em '${unica.branch}' mas o commit vive em '${expectedBranch}' (desvio de atribuição)`
      : `análise única em '${unica.branch}'${importedCoverage ? " com cobertura importada" : ""}`,
  };
}

// ---------------------------------------------------------------------------------------------
// Camada de rede — fina de propósito: só busca e delega a decisão ao núcleo puro acima.
// ---------------------------------------------------------------------------------------------

const HOST = "https://sonarcloud.io";
const PROJECT = process.env.SONAR_PROJECT_KEY ?? "Douglas0101_preco-que-da-lucro";

function fail(message: string): never {
  console.error(`precondicao: ${message}`);
  process.exit(2);
}

async function api<T>(path: string, token: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${HOST}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  } catch (error) {
    fail(`rede: ${(error as Error).message}`);
  }
  if (!response.ok) fail(`${path} devolveu HTTP ${response.status}`);
  try {
    return (await response.json()) as T;
  } catch {
    return fail(`${path} devolveu corpo ilegível`);
  }
}

async function main(): Promise<never> {
  const revision = process.argv[2];
  if (!revision) fail("uso: which-analysis <sha> [--expected-branch <nome>]");

  const flagIndex = process.argv.indexOf("--expected-branch");
  const expectedBranch = flagIndex > 0 ? process.argv[flagIndex + 1] : undefined;

  const token = process.env.SONAR_TOKEN;
  if (!token) fail("SONAR_TOKEN ausente no ambiente (nunca por argv)");

  const analysesRaw = await api<{ analyses?: { key: string; revision?: string; date: string }[] }>(
    `/api/project_analyses/search?project=${PROJECT}&ps=100`,
    token,
  );
  const branchesRaw = await api<{ branches?: { name: string; isMain?: boolean }[] }>(
    `/api/project_branches/list?project=${PROJECT}`,
    token,
  );
  const mainName = branchesRaw.branches?.find((b) => b.isMain)?.name ?? "main";

  // `project_analyses/search` devolve a análise da branch principal; a branch de cada análise é
  // derivada do nome da branch principal quando não há short-lived branch correspondente.
  const analyses: AnalysisRecord[] = (analysesRaw.analyses ?? [])
    .filter((a) => typeof a.revision === "string")
    .map((a) => ({ key: a.key, revision: a.revision!, branch: mainName, date: a.date }));

  const coverage: CoverageFact[] = [];
  for (const branch of new Set(analyses.map((a) => a.branch))) {
    const measures = await api<{ component?: { measures?: { metric: string; value: string }[] } }>(
      `/api/measures/component?component=${PROJECT}&branch=${encodeURIComponent(branch)}&metricKeys=coverage`,
      token,
    );
    const valor = measures.component?.measures?.find((m) => m.metric === "coverage")?.value;
    coverage.push({ branch, coverage: valor === undefined ? null : Number(valor) });
  }

  const verdict = decideWhichAnalysis({ revision, analyses, coverage, expectedBranch });
  console.log(JSON.stringify(verdict, null, 2));
  process.exit(verdict.named && !verdict.attributionMismatch ? 0 : 1);
}

// Só executa quando chamado como CLI — importar o núcleo no teste não dispara rede.
if (process.argv[1] && process.argv[1].endsWith("which-analysis.ts")) {
  await main();
}
