import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..");
const ledgerPath = resolve(repositoryRoot, "EXECUTION-STATE-PROGRAM.md");

function git(...args: string[]): string {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
  }).trim();
}

const head = git("rev-parse", "HEAD");
const branch = git("branch", "--show-current");
const status = git("status", "--short", "--untracked-files=all");
const ledger = readFileSync(ledgerPath, "utf8");
const marker = `\`HEAD\` = \`${head}\``;

if (!ledger.includes("## Correção de estado M-02") || !ledger.includes(marker)) {
  console.error(
    `Ledger M-02 desatualizado: registre a correção aditiva para HEAD ${head} antes de prosseguir.`,
  );
  process.exitCode = 1;
} else {
  console.log(`M-02 state marker matches HEAD ${head} on ${branch}.`);
}

console.log(`Worktree: ${status ? "dirty (preservado e auditável)" : "clean"}.`);
console.log("External state: not inspected by this local check.");
