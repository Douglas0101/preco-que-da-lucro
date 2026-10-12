import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

const repository = "Douglas0101/preco-que-da-lucro";
const proofs = new WeakSet<object>();
const sha = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export class PrApplicabilityRefusal extends Error {
  readonly code: string;
  constructor(code: string) {
    super(`gate aplicabilidade indisponível: NO-VERDICT (${code})`);
    this.name = "PrApplicabilityRefusal";
    this.code = code;
  }
}
const refuse = (code: string): never => {
  throw new PrApplicabilityRefusal(code);
};

export interface PrApplicability {
  readonly schema: "sonar-pr-applicability/1";
  readonly policy: "ADR-044";
  readonly status: "APPLICABLE" | "NOT_APPLICABLE";
  readonly ceTaskId: string;
  readonly analysisId: string;
  readonly providerIdentity: Readonly<{ revision: string; branch: string; pullRequest: string }>;
  readonly event: Readonly<{
    repository: string;
    number: number;
    baseBranch: "main";
    headBranch: "develop";
    baseSha: string;
    headSha: string;
    checkoutSha: string;
    /** Shape of the analyzed revision, proven on Git objects (see merge_commit_sha note). */
    analyzedShape: "merge" | "head";
  }>;
  readonly scope: Readonly<{ sources: "src"; exclusions: "src/test/**" }>;
  readonly changes: readonly Readonly<{ status: string; path: string }>[];
  readonly eligibleChanges: readonly Readonly<{ status: string; path: string }>[];
  readonly fingerprint: string;
  readonly approvesMain: false;
}

/** Exact CLI scope, from the authenticated CE task; never persist the raw scanner context. */
function scope(context: unknown) {
  if (typeof context !== "string") return refuse("PR_SCOPE_UNAVAILABLE");
  const property = (key: string) => {
    const values = context
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*(?:- )?/, ""))
      .filter((line) => line.startsWith(`${key}=`))
      .map((line) => line.slice(key.length + 1));
    if (values.length !== 1) return refuse("PR_SCOPE_UNAVAILABLE");
    return values[0];
  };
  if (property("sonar.sources") !== "src" || property("sonar.exclusions") !== "src/test/**")
    return refuse("PR_SCOPE_UNAVAILABLE");
  return Object.freeze({ sources: "src" as const, exclusions: "src/test/**" as const });
}
const eligible = (path: string) =>
  (path === "src" || path.startsWith("src/")) && !path.startsWith("src/test/");

/** Construct a fresh proof from the immutable PR event + real Git state, not a supplied path list. */
export function prApplicability(input: {
  identity: { revision: string; branch: string; pullRequest: string | null };
  ce: { ceTaskId: string; analysisId: string };
  scannerContext: unknown;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
}): PrApplicability {
  const env = input.env ?? process.env,
    cwd = input.cwd ?? process.cwd();
  const identity = input.identity;
  if (
    env.GITHUB_EVENT_NAME !== "pull_request" ||
    !env.GITHUB_EVENT_PATH ||
    !isAbsolute(env.GITHUB_EVENT_PATH)
  )
    return refuse("PR_EVENT_UNAVAILABLE");
  let event;
  try {
    event = record(JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")));
  } catch {
    return refuse("PR_EVENT_UNAVAILABLE");
  }
  const pr = record(event.pull_request),
    head = record(pr.head),
    base = record(pr.base);
  if (
    env.GITHUB_REPOSITORY !== repository ||
    record(event.repository).full_name !== repository ||
    record(head.repo).full_name !== repository ||
    record(base.repo).full_name !== repository ||
    base.ref !== "main" ||
    head.ref !== "develop" ||
    identity.branch !== "develop"
  )
    return refuse("PR_EVENT_REPOSITORY_DIVERGENT");
  if (
    !Number.isSafeInteger(event.number) ||
    Number(event.number) <= 0 ||
    event.number !== pr.number ||
    String(event.number) !== identity.pullRequest
  )
    return refuse("PR_EVENT_NUMBER_DIVERGENT");
  if (!sha(base.sha) || !sha(head.sha) || base.sha === head.sha || !sha(identity.revision))
    return refuse("PR_EVENT_REFS_DIVERGENT");
  if (
    typeof input.ce.ceTaskId !== "string" ||
    typeof input.ce.analysisId !== "string" ||
    !/^[A-Za-z0-9_-]{1,160}$/.test(input.ce.ceTaskId) ||
    !/^[A-Za-z0-9_-]{1,160}$/.test(input.ce.analysisId)
  )
    return refuse("PR_EVENT_CE_IDENTITY_UNAVAILABLE");
  // `github.sha` num evento pull_request é a revisão de test-merge que o scanner viu
  // (actions/checkout usa esse valor por default) e pode ser o próprio head quando a
  // plataforma não constrói a ref de merge. Os dois são fatos do runner para ESTE PR; a
  // revisão analisada é amarrada nos objetos do Git logo abaixo, então qualquer um dos
  // dois serve como testemunha.
  if (env.GITHUB_SHA !== identity.revision && env.GITHUB_SHA !== head.sha)
    return refuse("PR_EVENT_RUNNER_SHA_DIVERGENT");
  const scannerScope = scope(input.scannerContext);
  const deadline = performance.now() + 10_000;
  const git = (args: string[], refusal = "PR_GIT_PRECONDITION_UNAVAILABLE") => {
    const remaining = deadline - performance.now();
    if (remaining <= 0) return refuse("PR_GIT_PRECONDITION_UNAVAILABLE");
    try {
      return execFileSync("git", ["--no-replace-objects", ...args], {
        cwd,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: Math.max(1, Math.ceil(Math.min(5000, remaining))),
        maxBuffer: 2_000_000,
      });
    } catch {
      return refuse(refusal);
    }
  };
  if (git(["rev-parse", "--is-shallow-repository"]).trim() !== "false")
    return refuse("PR_GIT_PRECONDITION_UNAVAILABLE");
  const grafts = resolve(cwd, git(["rev-parse", "--git-path", "info/grafts"]).trim());
  if (existsSync(grafts) && readFileSync(grafts).length > 0)
    return refuse("PR_GIT_PRECONDITION_UNAVAILABLE");
  if (git(["rev-parse", "HEAD"]).trim() !== identity.revision)
    return refuse("PR_CHECKOUT_DIVERGENT");
  for (const commit of [base.sha, head.sha, identity.revision])
    if (git(["rev-parse", "--verify", `${commit}^{commit}`], "PR_REFS_DIVERGENT").trim() !== commit)
      return refuse("PR_REFS_DIVERGENT");
  // A revisão analisada tem de ser ESTE PR: ou o commit de test-merge cujos pais são
  // exatamente a base e o head registrados, ou o próprio head. O `merge_commit_sha` do
  // payload não é lido aqui de propósito: o GitHub o documenta como campo depreciado de
  // test-merge e ele chega nulo ou defasado depois de um push — a relação de merge é
  // provada nos objetos do Git, não no payload.
  const parents = git(["cat-file", "commit", identity.revision])
    .split("\n\n")[0]
    .split("\n")
    .filter((line) => line.startsWith("parent "))
    .map((line) => line.slice(7));
  const mergeShape =
    parents.length === 2 &&
    [...parents].sort().join("\n") === [base.sha, head.sha].sort().join("\n");
  const headShape = identity.revision === head.sha && parents.length <= 1;
  if (!mergeShape && !headShape) return refuse("PR_REFS_DIVERGENT");
  const analyzedShape: "merge" | "head" = mergeShape ? "merge" : "head";
  const clean = () => {
    if (git(["rev-parse", "HEAD"]).trim() !== identity.revision)
      return refuse("PR_CHECKOUT_DIVERGENT");
    if (git(["status", "--porcelain", "-z", "--untracked-files=all"]) !== "")
      return refuse("PR_WORKTREE_DIRTY");
    if (
      git(["ls-files", "-v", "-z"])
        .split("\0")
        .filter(Boolean)
        .some((entry) => !entry.startsWith("H "))
    )
      return refuse("PR_GIT_PRECONDITION_UNAVAILABLE");
    if (
      git(["ls-files", "--others", "--ignored", "--exclude-standard", "-z", "--", "src"])
        .split("\0")
        .filter(Boolean)
        .some(eligible)
    )
      return refuse("PR_WORKTREE_DIRTY");
  };
  clean();
  const bytes = git([
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--no-renames",
    "--ignore-submodules=none",
    "--name-status",
    "-z",
    base.sha,
    identity.revision,
    "--",
  ]);
  if (bytes === "") return refuse("PR_DIFF_EMPTY");
  if (bytes.includes("\uFFFD")) return refuse("PR_DIFF_UNAVAILABLE");
  const fields = bytes.split("\0");
  if (fields.pop() !== "" || fields.length % 2 !== 0) return refuse("PR_DIFF_UNAVAILABLE");
  const changes: { status: string; path: string }[] = [];
  for (let i = 0; i < fields.length; i += 2) {
    const status = fields[i],
      path = fields[i + 1];
    if (
      !/^[AMDT]$/.test(status) ||
      !path ||
      path.includes("\\") ||
      path.startsWith("/") ||
      path.split("/").some((part) => part === "." || part === ".." || part === "")
    )
      return refuse("PR_DIFF_UNAVAILABLE");
    changes.push(Object.freeze({ status, path }));
  }
  if (new Set(changes.map((change) => change.path)).size !== changes.length)
    return refuse("PR_DIFF_UNAVAILABLE");
  const eligibleChanges = Object.freeze(changes.filter((change) => eligible(change.path)));
  const eventIdentity = Object.freeze({
    repository,
    number: Number(event.number),
    baseBranch: "main" as const,
    headBranch: "develop" as const,
    baseSha: base.sha,
    headSha: head.sha,
    checkoutSha: identity.revision,
    analyzedShape,
  });
  clean();
  const proof: PrApplicability = Object.freeze({
    schema: "sonar-pr-applicability/1",
    policy: "ADR-044",
    status: eligibleChanges.length === 0 ? "NOT_APPLICABLE" : "APPLICABLE",
    ceTaskId: input.ce.ceTaskId,
    analysisId: input.ce.analysisId,
    providerIdentity: Object.freeze({
      revision: identity.revision,
      branch: "develop",
      pullRequest: identity.pullRequest as string,
    }),
    event: eventIdentity,
    scope: scannerScope,
    changes: Object.freeze(changes),
    eligibleChanges,
    fingerprint: createHash("sha256")
      .update(
        JSON.stringify({
          identity: {
            revision: identity.revision,
            branch: identity.branch,
            pullRequest: identity.pullRequest,
            analyzedShape,
          },
          ce: { ceTaskId: input.ce.ceTaskId, analysisId: input.ce.analysisId },
          event: eventIdentity,
          scope: scannerScope,
          changes,
        }),
      )
      .digest("hex"),
    approvesMain: false,
  });
  proofs.add(proof);
  return proof;
}

/** A JSON artifact, mutable copy or other CE's proof cannot authorize NOT_APPLICABLE. */
export function assertPrApplicability(
  proof: PrApplicability,
  ce: {
    ceTaskId: string;
    analysisId: string;
    surface: { branch: string | null; pullRequest: string | null };
  },
) {
  if (
    !proof ||
    !proofs.has(proof) ||
    proof.ceTaskId !== ce.ceTaskId ||
    proof.analysisId !== ce.analysisId ||
    proof.providerIdentity.pullRequest !== ce.surface.pullRequest ||
    (ce.surface.branch !== null && proof.providerIdentity.branch !== ce.surface.branch)
  )
    return refuse("PR_PROOF_UNAVAILABLE");
}
