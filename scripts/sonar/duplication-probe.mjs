/**
 * TEMPORÁRIO (2026-10-09) — sonda de leitura da duplicação do código novo do PR
 * corrente. v2: métricas de código novo voltam em `period`/`periods`, não em
 * `value`; imprime a forma crua para não inferir errado. Não imprime
 * código-fonte: chave de arquivo, contagens e intervalos de linha apenas.
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

const measureValue = (m) =>
  m.value ?? m.period?.value ?? (Array.isArray(m.periods) ? m.periods[0]?.value : undefined);

const overall = await api(
  `measures/component?component=${project}&pullRequest=${pr}&metricKeys=new_duplicated_lines,new_duplicated_blocks,new_lines,new_duplicated_lines_density`,
);
console.log(`OVERALL ${JSON.stringify(overall.component?.measures ?? [])}`);

const tree = await api(
  `measures/component_tree?component=${project}&pullRequest=${pr}&qualifiers=FIL&metricKeys=new_duplicated_lines,new_duplicated_blocks,new_lines&ps=500`,
);
const components = tree.components ?? [];
console.log(`TREE paging=${JSON.stringify(tree.paging ?? {})} components=${components.length}`);
for (const sample of components.slice(0, 3)) {
  console.log(`SAMPLE ${sample.key} ${JSON.stringify(sample.measures ?? [])}`);
}

let files = 0;
for (const component of components) {
  const measures = Object.fromEntries(
    (component.measures ?? []).map((m) => [m.metric, measureValue(m)]),
  );
  const duplicated = Number(measures.new_duplicated_lines ?? 0);
  if (!Number.isFinite(duplicated) || duplicated <= 0) continue;
  files += 1;
  console.log(`DUP_FILE ${component.key} new_lines=${measures.new_lines} duplicated=${duplicated}`);
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
