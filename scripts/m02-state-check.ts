import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gitSync } from "./lib/git-exec";

const repositoryRoot = resolve(import.meta.dirname, "..");
const ledgerPath = resolve(repositoryRoot, "EXECUTION-STATE-PROGRAM.md");

function git(...args: string[]): string {
  // S4036: `git` ja vem resolvido para caminho absoluto de diretorio fixo do
  // sistema. O pin de `PATH` no `env` (fdc0a17) nao satisfazia a regra: ela marca
  // o literal do programa, nao a variavel — ver `scripts/lib/git-exec.ts`.
  return gitSync(args, { cwd: repositoryRoot }).trim();
}

const head = git("rev-parse", "HEAD");
const parent = git("rev-parse", "HEAD^");
const branch = git("branch", "--show-current");
const status = git("status", "--short", "--untracked-files=all");
const ledger = readFileSync(ledgerPath, "utf8");
const exactMarker = `\`HEAD\` = \`${head}\``;
const parentPinnedMarker = `P1 marker parent = \`${parent}\``;
const latestParentPinnedMarker = `Latest state marker parent = \`${parent}\``;

if (
  !ledger.includes("## Correção de estado M-02") ||
  (!ledger.includes(exactMarker) &&
    !ledger.includes(parentPinnedMarker) &&
    !ledger.includes(latestParentPinnedMarker))
) {
  console.error(
    `Ledger M-02 desatualizado: registre HEAD ${head} ou o parent-pinned marker ${parent} antes de prosseguir.`,
  );
  process.exitCode = 1;
} else {
  const markerKind = ledger.includes(exactMarker)
    ? "exact"
    : ledger.includes(latestParentPinnedMarker)
      ? "latest parent-pinned"
      : "parent-pinned";
  console.log(`M-02 ${markerKind} state marker is valid for HEAD ${head} on ${branch}.`);
}

console.log(`Worktree: ${status ? "dirty (preservado e auditável)" : "clean"}.`);
console.log("External state: not inspected by this local check.");
