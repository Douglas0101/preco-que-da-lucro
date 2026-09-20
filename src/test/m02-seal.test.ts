import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { auditRun, countApplicableSteps, extractAncestryClaims } from "../../scripts/m02-seal.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const script = resolve(root, "scripts/m02-seal.mjs");

const tmp = mkdtempSync(join(tmpdir(), "m02-seal-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function sealFixture(name: string, files: Record<string, string>): string {
  const dir = join(tmp, name);
  mkdirSync(dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const file = join(dir, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  return dir;
}

function run(args: string[]) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  });
}

describe("m02-seal — manifesto e não-vacuidade", () => {
  it("selo real (SPEC + README + capturas) gera e verifica o manifesto", () => {
    const dir = sealFixture("ok", {
      "SPEC.md": "# spec\n",
      "README.md": "# readme\n",
      "captures/nota.txt": "prova\n",
    });
    const write = run(["--dir", dir, "--write"]);
    expect(write.stderr).toBe("");
    expect(write.status).toBe(0);
    const verify = run(["--dir", dir]);
    expect(verify.stdout).toContain("m02-seal: OK (3 arquivos");
    expect(verify.status).toBe(0);
  });

  it("descoberta vazia reprova (0 = 0)", () => {
    const dir = sealFixture("vazio", {});
    const result = run(["--dir", dir, "--write"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("descoberta vazia");
  });

  it("selo sem SPEC.md reprova", () => {
    const dir = sealFixture("sem-spec", { "README.md": "# readme\n" });
    const result = run(["--dir", dir, "--write"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("selo sem SPEC.md");
  });

  it("hash divergente reprova nomeando o arquivo", () => {
    const dir = sealFixture("divergente", { "SPEC.md": "a\n", "README.md": "b\n" });
    expect(run(["--dir", dir, "--write"]).status).toBe(0);
    writeFileSync(join(dir, "SPEC.md"), "c\n");
    const result = run(["--dir", dir]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("hash diverge");
  });

  it("MANIFEST citando arquivo ausente reprova", () => {
    const dir = sealFixture("fantasma", { "SPEC.md": "a\n", "README.md": "b\n" });
    expect(run(["--dir", dir, "--write"]).status).toBe(0);
    appendFileSync(
      join(dir, "MANIFEST.sha256"),
      `${"0".repeat(64)}  docs/evidence/fantasma/ghost.md\n`,
    );
    const result = run(["--dir", dir]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("MANIFEST cita arquivo ausente");
  });

  it("diretório ilegível sai com erro alto (exit 2)", () => {
    const result = run(["--dir", join(tmp, "nao-existe")]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("ilegivel");
  });

  it("sem MANIFEST e sem --write sai com erro alto (exit 2)", () => {
    const dir = sealFixture("sem-manifesto", { "SPEC.md": "a\n", "README.md": "b\n" });
    const result = run(["--dir", dir]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("MANIFEST ausente");
  });
});

describe("m02-seal — ancestralidade offline (formato do L133)", () => {
  it("claim verdadeira passa e é reconhecida", () => {
    const dir = sealFixture("ancestral", { "SPEC.md": "a\n", "README.md": "b\n" });
    expect(run(["--dir", dir, "--write"]).status).toBe(0);
    writeFileSync(
      join(tmp, "ancestral.md"),
      "Medido: `git merge-base --is-ancestor a7f1e4a c9d1740` → exit 0.\n",
    );
    const result = run(["--dir", dir, "--ancestry", join(tmp, "ancestral.md")]);
    expect(result.status).toBe(0);
  });

  it("claim invertida reprova", () => {
    const dir = sealFixture("ancestral-falsa", { "SPEC.md": "a\n", "README.md": "b\n" });
    expect(run(["--dir", dir, "--write"]).status).toBe(0);
    writeFileSync(
      join(tmp, "ancestral-falsa.md"),
      "`git merge-base --is-ancestor c9d1740 a7f1e4a` seria falso.\n",
    );
    const result = run(["--dir", dir, "--ancestry", join(tmp, "ancestral-falsa.md")]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("ancestralidade falsa");
  });

  it("arquivo sem nenhuma claim reprova (0 = 0)", () => {
    const dir = sealFixture("ancestral-vazio", { "SPEC.md": "a\n", "README.md": "b\n" });
    expect(run(["--dir", dir, "--write"]).status).toBe(0);
    writeFileSync(join(tmp, "ancestral-vazio.md"), "sem comando de ancestralidade aqui.\n");
    const result = run(["--dir", dir, "--ancestry", join(tmp, "ancestral-vazio.md")]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("nenhuma declaracao de ancestralidade");
  });

  it("extrai todas as claims do texto", () => {
    const claims = extractAncestryClaims(
      "a `git merge-base --is-ancestor abc1234 def5678` e outra `git merge-base --is-ancestor 1111111 2222222`",
    );
    expect(claims).toEqual([
      { ancestor: "abc1234", descendant: "def5678" },
      { ancestor: "1111111", descendant: "2222222" },
    ]);
  });
});

describe("m02-seal — run@sha (puro)", () => {
  const commit = "c9d1740cbb9a576876ed0fd83f4e1c8bea4054cb";

  it("run no-op (todos os passos skipped) reprova como delegação", () => {
    const runJson = {
      databaseId: 1,
      headSha: commit,
      conclusion: "success",
      jobs: [{ steps: [{ conclusion: "skipped" }, { conclusion: "skipped" }] }],
    };
    const falhas = auditRun(runJson, { commit, isAncestor: () => false });
    expect(falhas.join("\n")).toContain("no-op");
  });

  it("run real da light no-op (scope guard success + checks skipped) reprova", () => {
    const runJson = {
      databaseId: 5,
      headSha: commit,
      conclusion: "success",
      jobs: [
        {
          steps: [
            { name: "Set up job", conclusion: "success" },
            {
              name: "Run actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1",
              conclusion: "success",
            },
            { name: "Scope guard (docs/evidence only)", conclusion: "success" },
            { name: "Lockfile guard (fail-closed)", conclusion: "skipped" },
            { name: "Work-package contract guard (fail-closed)", conclusion: "skipped" },
            { name: "Debt registry guard (fail-closed)", conclusion: "skipped" },
            { name: "Complete job", conclusion: "success" },
          ],
        },
      ],
    };
    expect(countApplicableSteps(runJson)).toBe(0);
    expect(auditRun(runJson, { commit, isAncestor: () => false }).join("\n")).toContain("no-op");
  });

  it("passos de infraestrutura não contam como check aplicável", () => {
    const runJson = {
      databaseId: 6,
      headSha: commit,
      conclusion: "success",
      jobs: [
        {
          steps: [
            { name: "Set up job", conclusion: "success" },
            { name: "Initialize containers", conclusion: "success" },
            { name: "Run actions/checkout@x", conclusion: "success" },
            { name: "Configure isolated runtime", conclusion: "success" },
            { name: "Post Run actions/setup-node@x", conclusion: "success" },
            { name: "Stop containers", conclusion: "success" },
          ],
        },
      ],
    };
    expect(countApplicableSteps(runJson)).toBe(0);
  });

  it("run substantivo (≥1 passo success) e headSha descendente passa", () => {
    const runJson = {
      databaseId: 2,
      headSha: "9659844e4012838ecef735eea630a35b03aa0b13",
      conclusion: "success",
      jobs: [{ steps: [{ conclusion: "success" }, { conclusion: "skipped" }] }],
    };
    const falhas = auditRun(runJson, {
      commit,
      isAncestor: (a: string, b: string) => a === commit && b === runJson.headSha,
    });
    expect(falhas).toEqual([]);
  });

  it("conclusion diferente de success reprova", () => {
    const runJson = {
      databaseId: 3,
      headSha: commit,
      conclusion: "failure",
      jobs: [{ steps: [{ conclusion: "success" }] }],
    };
    expect(auditRun(runJson, { commit, isAncestor: () => false }).join("\n")).toContain(
      "conclusion=failure",
    );
  });

  it("headSha nem igual nem descendente reprova", () => {
    const runJson = {
      databaseId: 4,
      headSha: "1aad70cbcf63de8c8d8a20f7b309df2b6a8ba715",
      conclusion: "success",
      jobs: [{ steps: [{ conclusion: "success" }] }],
    };
    expect(auditRun(runJson, { commit, isAncestor: () => false }).join("\n")).toContain(
      "nao e igual nem descendente",
    );
  });
});
