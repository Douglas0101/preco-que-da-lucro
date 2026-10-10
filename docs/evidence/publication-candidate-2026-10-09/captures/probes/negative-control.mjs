/**
 * Controle negativo do classificador de falha de banco
 * (`src/lib/db-failure-classifier.ts`).
 *
 * A afirmacao que este probe falsifica: "a classificacao de readiness nao deixa
 * passar valor do erro". O probe injeta, de proposito, a mensagem do erro na
 * saida do classificador e verifica que os testes de regressao
 * (`src/test/db-failure-classifier.test.ts` e
 * `src/test/health-readiness-logging.test.ts`) REPROVAM. Sem este controle, uma
 * mutacao que passasse a classificar sem vazar nao seria distinguivel de uma
 * mutacao que passasse a vazar — e o teste ficaria verde nos dois casos.
 *
 * Read-only em relacao a git e a rede: copia o modulo para /tmp, aplica a
 * mutacao la, roda os testes e restaura. Nenhum arquivo do repositorio e
 * alterado.
 *
 * Uso: node probes/negative-control.mjs
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..", "..", "..", "..", "..");
const target = resolve(repositoryRoot, "src/lib/db-failure-classifier.ts");
const backup = resolve(import.meta.dirname, "db-failure-classifier.original.ts");
const vitest = resolve(repositoryRoot, "node_modules/vitest/vitest.mjs");

const TESTS = [
  "src/test/db-failure-classifier.test.ts",
  "src/test/health-readiness-logging.test.ts",
];

function run(label) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [vitest, "run", ...TESTS], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const failed = /Tests\s+(\d+) failed/.exec(combined);
  const passed = /Tests\s+(\d+) passed/.exec(combined);
  console.log(
    [
      label,
      `exit=${result.status}`,
      `passed=${passed ? passed[1] : "0"}`,
      `failed=${failed ? failed[1] : "0"}`,
      `elapsed_ms=${Date.now() - started}`,
    ].join(" "),
  );
  return { status: result.status, failed: Number(failed ? failed[1] : 0) };
}

const original = readFileSync(target, "utf8");
copyFileSync(target, backup);
try {
  const green = run("GREEN (modulo intacto)");

  // Mutacao: devolver a mensagem do erro dentro da classificacao.
  const mutated = original
    .replace(
      "    inspectedCauses,\n  };\n  // Defesa de contrato",
      '    inspectedCauses,\n    leaked: String(isRecord(error) ? (error as { message?: unknown }).message : ""),\n  };\n  // Defesa de contrato',
      1,
    )
    .replace("const UNKNOWN", "export interface Leaky { leaked: string }\nconst UNKNOWN", 1);

  if (mutated === original || !mutated.includes("leaked:")) {
    console.log("MUTATION_NOT_APPLIED o alvo da mutacao mudou de forma; nada foi testado");
    process.exitCode = 2;
  } else {
    writeFileSync(target, mutated);
    const red = run("RED (mutacao que vaza a mensagem)");
    const verdict =
      red.status !== 0 && red.failed > 0 ? "NEGATIVE-CONTROL=OK" : "NEGATIVE-CONTROL=FALHOU";
    console.log(verdict);
    if (verdict.endsWith("FALHOU")) process.exitCode = 1;
  }
} finally {
  copyFileSync(backup, target);
  rmSync(backup, { force: true });
  const restored = run("RESTORED (modulo original de volta)");
  if (restored.failed > 0) process.exitCode = 1;
}
