/**
 * Consistência do caminho do relatório de cobertura — `DBT-62`, C1.4.
 *
 * O mesmo caminho é declarado em **três** lugares, e um desalinhamento entre eles
 * é silencioso: o scanner procura um arquivo que a suíte não escreveu, ou escreve
 * onde ninguém lê — e o `analyze` mede 0 % sem que nada falhe. Foi esse o modo de
 * falha do `DBT-57`, e é por isso que o caminho é contrato, não convenção.
 *
 * Fontes:
 *   1. `.sonarcloud.properties` — `sonar.javascript.lcov.reportPaths`
 *   2. `.github/workflows/sonar.yml` — `-Dsonar.javascript.lcov.reportPaths`
 *   3. `package.json` — `test:coverage` (`--coverage.reportsDirectory` + reporter `lcov`)
 *
 * **Por que este passo não exige que o arquivo exista:** a suíte com cobertura
 * roda no CI, não no `local-ci.sh` (o scanner local é limite declarado desde o
 * Ciclo 21 — heap do bridge). Exigir existência aqui reprovaria toda execução
 * local por um artefato que este pipeline não produz. O que se verifica é a
 * **declaração**, que é o que pode divergir em silêncio.
 *
 * Exit: `0` = os três concordam · `1` = divergência · `2` = precondição
 * (arquivo ausente ou declaração ilegível).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const falhas = [];

function ler(caminho) {
  try {
    return readFileSync(resolve(root, caminho), "utf8");
  } catch (error) {
    console.error(`precondicao: não foi possível ler ${caminho} (${error.message})`);
    process.exit(2);
  }
}

const propriedades = ler(".sonarcloud.properties");
const workflow = ler(".github/workflows/sonar.yml");
const pacote = JSON.parse(ler("package.json"));

const PROPRIEDADE = "sonar.javascript.lcov.reportPaths";
const FLAG = "-Dsonar.javascript.lcov.reportPaths=";

const declaradoEmPropriedades = new RegExp(`^${PROPRIEDADE}=(.+)$`, "m")
  .exec(propriedades)?.[1]
  ?.trim();
if (!declaradoEmPropriedades) {
  console.error(`precondicao: ${PROPRIEDADE} ausente de .sonarcloud.properties`);
  process.exit(2);
}

const declaradoNoWorkflow = workflow
  .split("\n")
  .map((linha) => linha.trim())
  .filter((linha) => linha.startsWith(FLAG))
  .map((linha) => linha.slice(FLAG.length).replace(/\\$/, "").trim())[0];
if (!declaradoNoWorkflow) {
  console.error(`precondicao: ${FLAG} ausente de .github/workflows/sonar.yml`);
  process.exit(2);
}

const script = pacote.scripts?.["test:coverage"];
if (typeof script !== "string") {
  console.error("precondicao: script test:coverage ausente de package.json");
  process.exit(2);
}
const diretorio = /--coverage\.reportsDirectory=([^\s]+)/.exec(script)?.[1];
if (!diretorio) {
  console.error("precondicao: test:coverage sem --coverage.reportsDirectory");
  process.exit(2);
}
if (!script.includes("--coverage.reporter=lcov")) {
  falhas.push(
    "test:coverage não emite o reporter lcov — o arquivo do caminho declarado não existiria",
  );
}
const produzidoPelaSuite = `${diretorio}/lcov.info`;

if (declaradoEmPropriedades !== declaradoNoWorkflow) {
  falhas.push(
    `${PROPRIEDADE} diverge: .sonarcloud.properties declara "${declaradoEmPropriedades}" e o workflow envia "${declaradoNoWorkflow}"`,
  );
}
if (declaradoNoWorkflow !== produzidoPelaSuite) {
  falhas.push(
    `o scanner lê "${declaradoNoWorkflow}" e a suíte escreve "${produzidoPelaSuite}" — o analyze mediria 0% em silêncio`,
  );
}

if (falhas.length > 0) {
  for (const falha of falhas) console.error(`lcov-path: ${falha}`);
  process.exit(1);
}
console.log(
  `lcov-path: os três concordam em "${declaradoEmPropriedades}" (propriedades, workflow, test:coverage)`,
);
