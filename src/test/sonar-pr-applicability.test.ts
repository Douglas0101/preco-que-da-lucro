import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ceVerdict, releaseVerdict } from "../../scripts/sonar/gate-readout";
import { prApplicability } from "../../scripts/sonar/pr-applicability";

const ce = { ceTaskId: "ce-fixture-62", analysisId: "analysis-fixture-62" };
const repository = "Douglas0101/preco-que-da-lucro";
const context = (revision: string) =>
  `Project scanner properties:\n  - sonar.scm.revision=${revision}\n  - sonar.pullrequest.key=62\n  - sonar.pullrequest.branch=develop\n  - sonar.pullrequest.base=main\n  - sonar.sources=src\n  - sonar.exclusions=src/test/**\n  - private.field=PRIVATE_CONTEXT_SENTINEL\n`;
const controls = () => [
  ...["new_security_rating", "new_reliability_rating", "new_maintainability_rating"].map(
    (metricKey) => ({
      metricKey,
      status: "OK",
      comparator: "GT",
      errorThreshold: "1",
      actualValue: "1",
    }),
  ),
  {
    metricKey: "new_security_hotspots_reviewed",
    status: "OK",
    comparator: "LT",
    errorThreshold: "100",
    actualValue: "100.0",
  },
];
const noMetrics = () => ({ status: "OK", ignoredConditions: false, conditions: controls() });
const measured = (coverage: number) => ({
  status: coverage < 80 ? "ERROR" : "OK",
  ignoredConditions: false,
  conditions: [
    ...controls(),
    {
      metricKey: "new_duplicated_lines_density",
      status: "OK",
      comparator: "GT",
      errorThreshold: "3",
      actualValue: "0.0",
    },
    {
      metricKey: "new_coverage",
      status: coverage < 80 ? "ERROR" : "OK",
      comparator: "LT",
      errorThreshold: "80",
      actualValue: String(coverage),
    },
  ],
});

function fixture(
  change: (put: (path: string, contents: string) => void, root: string) => void = (put) => {
    put("scripts/fixture.ts", "export const changed = true;\n");
    put("docs/evidence/fixture.md", "fixture documentation\n");
    put("src/test/fixture.test.ts", "export const testOnly = true;\n");
  },
) {
  const directory = mkdtempSync(resolve(tmpdir(), "pr-scope-")),
    root = resolve(directory, "repo"),
    temp = resolve(directory, "runner");
  mkdirSync(root);
  mkdirSync(temp);
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  const put = (path: string, contents: string) => {
    const target = resolve(root, path);
    mkdirSync(resolve(target, ".."), { recursive: true });
    writeFileSync(target, contents);
  };
  git("init", "-b", "main");
  git("config", "user.email", "fixture@example.invalid");
  git("config", "user.name", "fixture");
  put("src/fixture.ts", "export const base = true;\n");
  put("scripts/rename-source.ts", "export const external = true;\n");
  put("package.json", '{"type":"module"}\n');
  put(".gitignore", ".scannerwork/\nsrc/generated-ignored.ts\n");
  for (const file of ["gate-readout.ts", "pr-applicability.ts"]) {
    mkdirSync(resolve(root, "scripts/sonar"), { recursive: true });
    copyFileSync(resolve("scripts/sonar", file), resolve(root, "scripts/sonar", file));
  }
  git("add", ".");
  git("commit", "-m", "fixture base");
  const base = git("rev-parse", "HEAD");
  git("switch", "-c", "develop");
  change(put, root);
  git("add", ".");
  git("commit", "--allow-empty", "-m", "fixture candidate");
  const head = git("rev-parse", "HEAD");
  git("switch", "main");
  git("merge", "--no-ff", "develop", "-m", "fixture PR merge");
  const checkout = git("rev-parse", "HEAD");
  const event = {
    number: 62,
    repository: { full_name: repository },
    pull_request: {
      number: 62,
      body: "PRIVATE_EVENT_SENTINEL",
      merge_commit_sha: checkout,
      base: { ref: "main", sha: base, repo: { full_name: repository } },
      head: { ref: "develop", sha: head, repo: { full_name: repository } },
    },
  };
  const eventPath = resolve(directory, "event.json");
  const saveEvent = () => writeFileSync(eventPath, JSON.stringify(event));
  saveEvent();
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    GITHUB_REPOSITORY: repository,
    GITHUB_SHA: checkout,
    GITHUB_EVENT_NAME: "pull_request",
    GITHUB_EVENT_PATH: eventPath,
    RUNNER_TEMP: temp,
    SONAR_TOKEN: "fixture-only-not-a-credential",
    EXPECTED_BRANCH: "develop",
    EXPECTED_PR: "62",
  };
  const identity = { revision: checkout, branch: "develop", pullRequest: "62" };
  const input = () => ({ identity, ce, scannerContext: context(checkout), env, cwd: root });
  const task = () => ({
    id: ce.ceTaskId,
    analysisId: ce.analysisId,
    componentKey: "Douglas0101_preco-que-da-lucro",
    status: "SUCCESS",
    branch: "develop",
    branchType: "PULL_REQUEST",
    pullRequest: "62",
    analysisRevision: checkout,
    scannerContext: context(checkout),
  });
  const verdict = (gate = noMetrics()) => ceVerdict(task(), gate, ce.ceTaskId);
  const cleanup = () => rmSync(directory, { recursive: true, force: true });
  return {
    directory,
    root,
    temp,
    git,
    put,
    base,
    head,
    checkout,
    event,
    saveEvent,
    env,
    input,
    task,
    verdict,
    cleanup,
  };
}

function readoutCli(
  f: ReturnType<typeof fixture>,
  gate = noMetrics(),
  task: {
    id: string;
    analysisId: string;
    componentKey: string;
    status: string;
    branch: string;
    branchType: string;
    pullRequest?: string;
    analysisRevision: string;
    scannerContext: string;
  } = f.task(),
  httpFailure = false,
) {
  mkdirSync(resolve(f.root, ".scannerwork"), { recursive: true });
  writeFileSync(
    resolve(f.root, ".scannerwork/report-task.txt"),
    `projectKey=Douglas0101_preco-que-da-lucro\nceTaskId=${ce.ceTaskId}\nceTaskUrl=https://sonarcloud.io/api/ce/task?id=${ce.ceTaskId}\n`,
  );
  const preload = resolve(f.directory, "api-fixture.mjs");
  writeFileSync(
    resolve(f.directory, "api.json"),
    JSON.stringify({ task, projectStatus: gate, httpFailure }),
  );
  writeFileSync(
    preload,
    `
import {readFileSync,appendFileSync} from 'node:fs';
const fixture=JSON.parse(readFileSync(${JSON.stringify(resolve(f.directory, "api.json"))},'utf8'));
globalThis.fetch=async (input,options)=>{
 const url=new URL(String(input));
 if(url.origin!=='https://sonarcloud.io'||options.headers.Authorization!=='Bearer fixture-only-not-a-credential'||options.redirect!=='error') throw new Error('NO_NETWORK_INVALID_REQUEST');
 appendFileSync(process.env.RUNNER_TEMP+'/requests.jsonl',JSON.stringify({path:url.pathname,query:url.search})+'\\n');
 if(fixture.httpFailure) return new Response(JSON.stringify({private:'PRIVATE_BODY_SENTINEL'}),{status:403});
 if(url.pathname==='/api/ce/task'&&url.searchParams.get('id')==='${ce.ceTaskId}'&&url.searchParams.get('additionalFields')==='scannerContext') return new Response(JSON.stringify({task:fixture.task}));
 if(url.pathname==='/api/qualitygates/project_status'&&url.searchParams.get('analysisId')==='${ce.analysisId}') return new Response(JSON.stringify({projectStatus:fixture.projectStatus}));
 throw new Error('NO_NETWORK_UNREGISTERED_ENDPOINT');
};
`,
  );
  const result = spawnSync(
    process.execPath,
    ["--import", preload, resolve(f.root, "scripts/sonar/gate-readout.ts")],
    { cwd: f.root, env: f.env, encoding: "utf8", timeout: 12000 },
  );
  expect(result.error).toBeUndefined();
  expect(existsSync(resolve(f.temp, "c25-gate-readout.json")), result.stderr).toBe(true);
  const report = JSON.parse(readFileSync(resolve(f.temp, "c25-gate-readout.json"), "utf8"));
  for (const sentinel of [
    "PRIVATE_CONTEXT_SENTINEL",
    "PRIVATE_EVENT_SENTINEL",
    "PRIVATE_BODY_SENTINEL",
    "fixture-only-not-a-credential",
  ])
    expect(result.stdout + result.stderr + JSON.stringify(report)).not.toContain(sentinel);
  return { report, status: result.status };
}

describe("ADR-044 / DBT-105 · prova de aplicabilidade por evento e Git reais", () => {
  it("PR sem delta no escopo recebe NOT_APPLICABLE explícito, sem cobertura numérica", () => {
    const f = fixture();
    try {
      const proof = prApplicability(f.input());
      expect(proof).toMatchObject({
        status: "NOT_APPLICABLE",
        approvesMain: false,
        event: { baseSha: f.base, headSha: f.head, checkoutSha: f.checkout },
        scope: { sources: "src", exclusions: "src/test/**" },
        eligibleChanges: [],
      });
      expect(proof.changes).toEqual([
        { status: "A", path: "docs/evidence/fixture.md" },
        { status: "A", path: "scripts/fixture.ts" },
        { status: "A", path: "src/test/fixture.test.ts" },
      ]);
      expect(proof.fingerprint).toMatch(/^[a-f0-9]{64}$/);
      const raw = f.verdict(),
        before = JSON.stringify(raw),
        policy = releaseVerdict(raw, proof);
      expect(policy).toMatchObject({
        policy: "ADR-044/pr-no-analyzed-delta",
        status: "NOT_APPLICABLE",
        coverage: { actual: null, minimum: 60, status: "NOT_APPLICABLE" },
        duplication: { actual: null, status: "NOT_APPLICABLE" },
        blockingConditions: [],
      });
      expect(JSON.stringify(raw)).toBe(before);
      expect(policy).not.toHaveProperty("approvesMain");
    } finally {
      f.cleanup();
    }
  });
  it("prova serializada, cópia mutável ou CE trocado não autorizam dispensa", () => {
    const f = fixture();
    try {
      const proof = prApplicability(f.input());
      for (const candidate of [JSON.parse(JSON.stringify(proof)), { ...proof }])
        expect(() => releaseVerdict(f.verdict(), candidate)).toThrow("PR_PROOF_UNAVAILABLE");
      expect(() => releaseVerdict({ ...f.verdict(), analysisId: "other-analysis" }, proof)).toThrow(
        "PR_PROOF_UNAVAILABLE",
      );
      expect(() => Object.assign(proof, { status: "APPLICABLE" })).toThrow();
      expect(() => Object.assign(proof.changes[0], { path: "src/fixture.ts" })).toThrow();
    } finally {
      f.cleanup();
    }
  });
  it.each([
    "modificada",
    "adicionada",
    "excluída",
    "renomeada para fora",
    "renomeada para dentro",
    "CSS",
    "test-prefix",
  ])("qualquer fonte %s permanece elegível e ausência de métrica continua NO-VERDICT", (kind) => {
    const f = fixture((put, root) => {
      if (kind === "excluída") rmSync(resolve(root, "src/fixture.ts"));
      else if (kind === "renomeada para fora") {
        mkdirSync(resolve(root, "scripts"), { recursive: true });
        renameSync(resolve(root, "src/fixture.ts"), resolve(root, "scripts/renamed.ts"));
      } else if (kind === "renomeada para dentro") {
        renameSync(resolve(root, "scripts/rename-source.ts"), resolve(root, "src/renamed.ts"));
      } else
        put(
          kind === "adicionada"
            ? "src/new.ts"
            : kind === "CSS"
              ? "src/styles.css"
              : kind === "test-prefix"
                ? "src/testish.ts"
                : "src/fixture.ts",
          "changed source\n",
        );
    });
    try {
      const proof = prApplicability(f.input());
      expect(proof.status).toBe("APPLICABLE");
      expect(proof.eligibleChanges.length).toBeGreaterThan(0);
      expect(() => releaseVerdict(f.verdict(), proof)).toThrow("controle obrigatório ausente");
      for (const coverage of [59.99, 60, 79.99, 80])
        expect(releaseVerdict(f.verdict(measured(coverage)), proof)).toMatchObject({
          policy: "ADR-042/coverage-minimum-60",
          status: coverage >= 60 ? "OK" : "ERROR",
          coverage: { actual: coverage, minimum: 60 },
        });
    } finally {
      f.cleanup();
    }
  });
  it.each([
    undefined,
    "sonar.sources=src",
    "sonar.sources=scripts\nsonar.exclusions=src/test/**",
    "sonar.sources=src\nsonar.exclusions=src/test/**,src/lib/**",
    "sonar.sources=src\nsonar.sources=src\nsonar.exclusions=src/test/**",
  ])("escopo omitido/alterado/duplicado %j recusa", (scannerContext) => {
    const f = fixture();
    try {
      expect(() => prApplicability({ ...f.input(), scannerContext })).toThrow(
        "PR_SCOPE_UNAVAILABLE",
      );
    } finally {
      f.cleanup();
    }
  });
  it.each([
    "evento ausente",
    "main",
    "fork",
    "PR trocado",
    "base trocada",
    "head trocado",
    "merge trocado",
    "runner trocado",
  ])("precondição %s nunca vira dispensa", (kind) => {
    const f = fixture();
    try {
      if (kind === "evento ausente") delete f.env.GITHUB_EVENT_PATH;
      if (kind === "main") f.env.GITHUB_EVENT_NAME = "push";
      if (kind === "fork") f.event.pull_request.head.repo.full_name = "foreign/fork";
      if (kind === "PR trocado") f.event.number = 63;
      if (kind === "base trocada") f.event.pull_request.base.sha = "b".repeat(40);
      if (kind === "head trocado") f.event.pull_request.head.sha = f.base;
      if (kind === "merge trocado") f.event.pull_request.merge_commit_sha = f.head;
      if (kind === "runner trocado") f.env.GITHUB_SHA = f.head;
      f.saveEvent();
      expect(() => prApplicability(f.input())).toThrow("NO-VERDICT");
    } finally {
      f.cleanup();
    }
  });
  it.each([
    "tracked dirty",
    "untracked",
    "ignored source",
    "assume-unchanged",
    "shallow",
    "checkout trocado",
    "grafts",
  ])("estado Git %s recusa sem sleep/rede", (kind) => {
    const f = fixture();
    try {
      if (kind === "tracked dirty") f.put("src/fixture.ts", "dirty\n");
      if (kind === "untracked") f.put("untracked.md", "dirty\n");
      if (kind === "ignored source") f.put("src/generated-ignored.ts", "hidden source\n");
      if (kind === "assume-unchanged")
        f.git("update-index", "--assume-unchanged", "src/fixture.ts");
      if (kind === "shallow") writeFileSync(resolve(f.root, ".git/shallow"), f.base + "\n");
      if (kind === "checkout trocado") f.git("checkout", "--detach", f.head);
      if (kind === "grafts") writeFileSync(resolve(f.root, ".git/info/grafts"), f.checkout + "\n");
      expect(() => prApplicability(f.input())).toThrow("NO-VERDICT");
    } finally {
      f.cleanup();
    }
  });
  it("lista de mudanças vazia é precondição, não prova de PR", () => {
    const f = fixture(() => {});
    try {
      expect(() => prApplicability(f.input())).toThrow("PR_DIFF_EMPTY");
    } finally {
      f.cleanup();
    }
  });
  it("NA não ignora métricas presentes, condições ignoradas, ratings ou veto adicional", () => {
    const f = fixture();
    try {
      const proof = prApplicability(f.input());
      expect(() => releaseVerdict(f.verdict(measured(0)), proof)).toThrow("métricas presentes");
      expect(() => releaseVerdict({ ...f.verdict(), ignoredConditions: true }, proof)).toThrow(
        "ignoradas",
      );
      const bad = noMetrics();
      bad.status = "ERROR";
      bad.conditions[0].status = "ERROR";
      bad.conditions[0].actualValue = "2";
      expect(releaseVerdict(f.verdict(bad), proof)).toMatchObject({
        status: "ERROR",
        coverage: { actual: null, status: "NOT_APPLICABLE" },
      });
      const extra = noMetrics();
      extra.status = "ERROR";
      extra.conditions.push({
        metricKey: "other_control",
        status: "ERROR",
        comparator: "GT",
        errorThreshold: "0",
        actualValue: "1",
      });
      expect(releaseVerdict(f.verdict(extra), proof).status).toBe("ERROR");
      const absent = noMetrics();
      absent.conditions.pop();
      expect(() => releaseVerdict(f.verdict(absent), proof)).toThrow(
        "controle obrigatório ausente",
      );
    } finally {
      f.cleanup();
    }
  });
});

describe("ADR-044 · CLI real conserva CE, prova, veredito e recusas", () => {
  it("PR script/test/docs usa CE real e quatro controles, emite NA e exit0 sem atribuir cobertura", () => {
    const f = fixture();
    try {
      const result = readoutCli(f);
      expect(result.status).toBe(0);
      expect(result.report).toMatchObject({
        schema: "c25-ce-gate-readout/1",
        status: "OK",
        analysisId: ce.analysisId,
        ceTaskId: ce.ceTaskId,
        providerIdentity: { revision: f.checkout, pullRequest: "62" },
        releasePolicy: {
          status: "NOT_APPLICABLE",
          coverage: { actual: null },
          applicability: {
            event: { baseSha: f.base, headSha: f.head, checkoutSha: f.checkout },
            changes: [
              { path: "docs/evidence/fixture.md" },
              { path: "scripts/fixture.ts" },
              { path: "src/test/fixture.test.ts" },
            ],
          },
        },
      });
      expect(result.report.conditions).toHaveLength(4);
      const requests = readFileSync(resolve(f.temp, "requests.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(requests).toEqual([
        { path: "/api/ce/task", query: "?id=ce-fixture-62&additionalFields=scannerContext" },
        { path: "/api/qualitygates/project_status", query: "?analysisId=analysis-fixture-62" },
      ]);
    } finally {
      f.cleanup();
    }
  });
  it.each(["fonte elegível", "evento ausente", "escopo ausente", "dirty"])(
    "CLI %s conserva NO-VERDICT e observação, não selo de aprovação",
    (kind) => {
      const f = fixture(
        kind === "fonte elegível" ? (put) => put("src/fixture.ts", "changed\n") : undefined,
      );
      try {
        if (kind === "evento ausente") delete f.env.GITHUB_EVENT_PATH;
        if (kind === "dirty") f.put("src/fixture.ts", "dirty\n");
        const task = f.task();
        if (kind === "escopo ausente")
          task.scannerContext = `sonar.scm.revision=${f.checkout}\nsonar.pullrequest.key=62\nsonar.pullrequest.branch=develop`;
        const result = readoutCli(f, noMetrics(), task);
        expect(result.status).toBe(2);
        expect(result.report).toMatchObject({
          status: "NO-VERDICT",
          providerObservation: { analysisId: ce.analysisId, ceTaskId: ce.ceTaskId, status: "OK" },
          providerIdentity: { revision: f.checkout },
        });
        expect(result.report).not.toHaveProperty("releasePolicy");
        expect(result.report).not.toHaveProperty("analysisId");
      } finally {
        f.cleanup();
      }
    },
  );
  it.each([59.99, 60, 80])(
    "CLI elegível %s mantém ADR-042 e status bruto do preset80",
    (coverage) => {
      const f = fixture((put) => put("src/fixture.ts", "changed\n"));
      try {
        const result = readoutCli(f, measured(coverage));
        expect(result.status).toBe(coverage >= 60 ? 0 : 1);
        expect(result.report).toMatchObject({
          status: coverage < 80 ? "ERROR" : "OK",
          releasePolicy: {
            policy: "ADR-042/coverage-minimum-60",
            coverage: { actual: coverage, minimum: 60 },
            status: coverage >= 60 ? "OK" : "ERROR",
          },
        });
      } finally {
        f.cleanup();
      }
    },
  );
  it.each([undefined, 59.99, 60])(
    "CLI main %s nunca recebe NA mesmo com evento/lista do PR",
    (coverage) => {
      const f = fixture();
      try {
        f.env.EXPECTED_BRANCH = "main";
        f.env.EXPECTED_PR = "";
        f.env.GITHUB_EVENT_NAME = "push";
        const task = {
          ...f.task(),
          branch: "main",
          pullRequest: undefined,
          scannerContext: `sonar.scm.revision=${f.checkout}\nsonar.branch.name=main`,
        };
        const result = readoutCli(
          f,
          coverage === undefined ? noMetrics() : measured(coverage),
          task,
        );
        expect(result.status).toBe(coverage === undefined ? 2 : coverage >= 60 ? 0 : 1);
        if (coverage === undefined)
          expect(result.report).toMatchObject({
            status: "NO-VERDICT",
            providerIdentity: { branch: "main", pullRequest: null },
          });
        else
          expect(result.report.releasePolicy).toMatchObject({
            policy: "ADR-042/coverage-minimum-60",
            coverage: { actual: coverage, minimum: 60 },
          });
        expect(result.report.releasePolicy?.status).not.toBe("NOT_APPLICABLE");
      } finally {
        f.cleanup();
      }
    },
  );
  it("API inacessível conserva NO-VERDICT, sem observação fictícia", () => {
    const f = fixture();
    try {
      const result = readoutCli(f, noMetrics(), f.task(), true);
      expect(result.status).toBe(2);
      expect(result.report).toMatchObject({
        status: "NO-VERDICT",
        reason: "Web API /api/ce/task: HTTP 403",
      });
      expect(result.report).not.toHaveProperty("providerObservation");
      expect(result.report).not.toHaveProperty("releasePolicy");
    } finally {
      f.cleanup();
    }
  });
});
