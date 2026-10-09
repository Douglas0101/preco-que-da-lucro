/**
 * TEMPORÁRIO (2026-10-09) — sonda de leitura da duplicação do código novo do PR
 * corrente. Existe para nomear, **por medição**, o bloco que reprova o gate em
 * `new_duplicated_lines_density` (3.5% > 3%), depois de a busca local não
 * reproduzir o bloco. É removida no commit seguinte à leitura.
 *
 * Não imprime código-fonte: apenas chave de arquivo, contagens e intervalos de
 * linha. O token nunca é impresso.
 */
const token = process.env.SONAR_TOKEN;
const project = "Douglas0101_preco-que-da-lucro";
const pr = process.env.EXPECTED_PR;
if (!token || !pr) {
  console.error("precondicao: SONAR_TOKEN/EXPECTED_PR ausentes");
  process.exit(2);
}

const api = async (path) => {
  const response = await fetch(`https://sonarcloud.io/api/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    redirect: "error",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} em ${path}`);
  return response.json();
};

const tree = await api(
  `measures/component_tree?component=${project}&pullRequest=${pr}&qualifiers=FIL&metricKeys=new_duplicated_lines,new_lines,new_duplicated_lines_density&ps=500`,
);
let files = 0;
for (const component of tree.components ?? []) {
  const measures = Object.fromEntries((component.measures ?? []).map((m) => [m.metric, m.value]));
  const duplicated = Number(measures.new_duplicated_lines ?? 0);
  if (duplicated <= 0) continue;
  files += 1;
  console.log(
    `DUP_FILE ${component.key} new_lines=${measures.new_lines} duplicated=${measures.new_duplicated_lines} density=${measures.new_duplicated_lines_density}`,
  );
  const show = await api(
    `duplications/show?key=${encodeURIComponent(component.key)}&pullRequest=${pr}`,
  );
  const refs = show.files ?? {};
  for (const [id, blocks] of Object.entries(show.duplications ?? {})) {
    const ranges = blocks.map(
      (b) => `${b.from}+${b.size}@${b._ref ? (refs[b._ref]?.key ?? b._ref) : component.key}`,
    );
    console.log(`  BLOCK ${id}: ${ranges.join(" | ")}`);
  }
}
console.log(`DUP_PROBE_DONE files_with_duplication=${files}`);
