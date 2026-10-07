import { appendFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DEVELOP_ID,
  MaskedSecrets,
  pinConnection,
  PRODUCTION_ID,
  PROJECT_ID,
  type ResourceFetch,
} from "./neon-resource";

// S6-R2/N04: provisioning of the PR fixture is done with the official REST API
// instead of the action wrapper, so a refusal (e.g. HTTP 412) surfaces its
// status and code sanitized. Every URI is masked the moment it arrives and any
// value already known is redacted from a failure before it is logged or
// persisted. The fixture is schema-only: no retry ever falls back to data.

const apiBase = "https://console.neon.tech/api/v2";
const repository = "Douglas0101/preco-que-da-lucro";
const fixtureDatabase = "neondb";
const fixtureAdminRole = "neondb_owner";
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export interface ProvisionPlan {
  projectId: string;
  parentId: string;
  branchName: string;
  expiresAt: string;
}

export function provisionPlan(env: NodeJS.ProcessEnv, now = new Date()): ProvisionPlan {
  const numeric = [env.PR_NUMBER, env.GITHUB_RUN_ID, env.GITHUB_RUN_ATTEMPT];
  if (
    env.GITHUB_REPOSITORY !== repository ||
    env.GITHUB_EVENT_NAME !== "pull_request" ||
    env.NEON_PROJECT_ID !== PROJECT_ID ||
    !["main", "develop"].includes(env.GITHUB_BASE_REF ?? "") ||
    numeric.some((value) => !/^[1-9][0-9]*$/.test(value ?? ""))
  )
    throw new Error("fixture provisioning precondition failed");
  // §12.4: release PRs (base main) copy the production structure; the others
  // copy develop's. The created branch is a schema-only ROOT either way.
  return {
    projectId: PROJECT_ID,
    parentId: env.GITHUB_BASE_REF === "main" ? PRODUCTION_ID : DEVELOP_ID,
    branchName: `pr-${env.PR_NUMBER}-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`,
    expiresAt: new Date(Math.floor((now.getTime() + 24 * 3600_000) / 1000) * 1000)
      .toISOString()
      .replace(/\.000Z$/, "Z"),
  };
}

class ProviderRefusal extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`fixture provisioning HTTP ${status}, code=${code}`);
  }
}

export class ProviderApi {
  constructor(
    private readonly apiKey: string,
    private readonly projectId: string,
    private readonly fetchImpl: ResourceFetch,
  ) {}
  /** Errors expose only status and code; the provider body is never persisted. */
  async request(path: string, init: RequestInit = {}): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${apiBase}/projects/${this.projectId}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
        redirect: "error",
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new Error("fixture provisioning request failed without a provider response");
    }
    if (response.status === 204) return null;
    const prefix = `fixture provisioning HTTP ${response.status}`;
    let text: string;
    try {
      text = await response.text();
    } catch {
      if (!response.ok) throw new ProviderRefusal(response.status, "UNCLASSIFIED");
      throw new Error(`${prefix} body is unavailable`);
    }
    let body: unknown;
    const json = response.headers.get("content-type")?.includes("application/json");
    if (!response.ok) {
      if (json && text.length <= 2_000_000) {
        try {
          body = JSON.parse(text);
        } catch {
          // A malformed refusal still retains the observed HTTP status.
        }
      }
      const code =
        record(body) &&
        typeof body.code === "string" &&
        /^[a-zA-Z][a-zA-Z0-9_.-]{2,63}$/.test(body.code) &&
        (!this.apiKey || !body.code.includes(this.apiKey))
          ? body.code
          : "UNCLASSIFIED";
      throw new ProviderRefusal(response.status, code);
    }
    if (!json) throw new Error(`${prefix} without a JSON body`);
    if (text.length > 2_000_000) throw new Error(`${prefix} body exceeds limit`);
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`${prefix} returned invalid JSON`);
    }
    return body;
  }
}

export interface ProvisionIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  appendOutput: (text: string) => void;
  writePrivate: (name: string, content: string) => void;
  writeReport: (name: string, content: string) => void;
}

export async function provision(
  env: NodeJS.ProcessEnv,
  fetchImpl: ResourceFetch,
  io: ProvisionIo,
  options: {
    now?: () => number;
    pause?: (milliseconds: number) => Promise<void>;
    readyDeadlineMs?: number;
  } = {},
): Promise<{ verdict: "OK" | "NO-VERDICT"; branchId?: string }> {
  const secrets = new MaskedSecrets();
  const now = options.now ?? (() => Date.now());
  const pause = options.pause ?? ((ms) => new Promise<void>((done) => setTimeout(done, ms)));
  const readyDeadlineMs = options.readyDeadlineMs ?? 150_000;
  let phase = "planning";
  let branchId = "";
  io.stdout(secrets.mask(env.NEON_API_KEY ?? ""));
  try {
    const plan = provisionPlan(env, new Date(now()));
    const api = new ProviderApi(env.NEON_API_KEY ?? "", plan.projectId, fetchImpl);
    phase = "creating";
    const created = await api.request("/branches", {
      method: "POST",
      body: JSON.stringify({
        branch: {
          name: plan.branchName,
          parent_id: plan.parentId,
          init_source: "schema-only",
          expires_at: plan.expiresAt,
        },
        endpoints: [{ type: "read_write" }],
      }),
    });
    const createdId =
      record(created) && record(created.branch) && typeof created.branch.id === "string"
        ? created.branch.id
        : "";
    if (!/^br-[a-z0-9-]+$/.test(createdId) || [DEVELOP_ID, PRODUCTION_ID].includes(createdId))
      throw new Error("fixture provisioning did not return a verified disposable branch id");
    branchId = createdId;
    // The disposable identity reaches the cleanup job before anything waits on
    // compute or URIs; the TTL from the POST is the last-resort expiry.
    io.appendOutput(`branch_id=${branchId}\ncreated=true\n`);
    phase = "waiting-ready";
    const deadline = now() + readyDeadlineMs;
    for (;;) {
      if (!Number.isFinite(now()) || now() > deadline)
        throw new Error("fixture provisioning readiness deadline exhausted");
      const body = await api.request(`/branches/${encodeURIComponent(branchId)}`);
      if (
        record(body) &&
        record(body.branch) &&
        body.branch.id === branchId &&
        body.branch.current_state === "ready"
      )
        break;
      await pause(2000);
    }
    phase = "reading-endpoints";
    const endpoints = await api.request(`/branches/${encodeURIComponent(branchId)}/endpoints`);
    const directHost =
      record(endpoints) && Array.isArray(endpoints.endpoints)
        ? endpoints.endpoints.filter(
            (endpoint) =>
              record(endpoint) &&
              endpoint.branch_id === branchId &&
              endpoint.project_id === plan.projectId &&
              endpoint.type === "read_write" &&
              endpoint.disabled === false,
          )
        : [];
    if (
      directHost.length !== 1 ||
      typeof directHost[0].host !== "string" ||
      !/^ep-[a-z0-9-]+(?:\.c-[0-9]+)?\.[a-z0-9-]+\.aws\.neon\.tech$/.test(directHost[0].host) ||
      directHost[0].host.includes("-pooler.")
    )
      throw new Error("fixture provisioning endpoint identity is not verified");
    const host = directHost[0].host;
    async function connectionUri(pooled: boolean) {
      const params = new URLSearchParams({
        branch_id: branchId,
        database_name: fixtureDatabase,
        role_name: fixtureAdminRole,
        pooled: String(pooled),
      });
      const body = await api.request(`/connection_uri?${params}`);
      if (!record(body) || typeof body.uri !== "string" || !body.uri)
        throw new Error("fixture provisioning connection URI is unavailable");
      io.stdout(secrets.mask(body.uri));
      try {
        const password = new URL(body.uri).password;
        io.stdout(secrets.mask(password));
        io.stdout(secrets.mask(decodeURIComponent(password)));
      } catch {
        throw new Error("fixture provisioning connection URI is invalid");
      }
      return body.uri;
    }
    phase = "reading-direct-uri";
    const direct = pinConnection(await connectionUri(false), false);
    if (new URL(direct).hostname !== host)
      throw new Error("fixture direct URI does not match the observed endpoint");
    io.stdout(secrets.mask(direct));
    io.stdout(secrets.mask(new URL(direct).password));
    phase = "writing-private-uris";
    io.writePrivate("branch_direct_url", direct);
    phase = "reading-pooled-uri";
    const pooled = pinConnection(await connectionUri(true), true);
    if (
      new URL(pooled).hostname !== host.replace(/^([^.]+)/, "$1-pooler") ||
      new URL(pooled).pathname !== new URL(direct).pathname ||
      new URL(pooled).password !== new URL(direct).password ||
      new URL(pooled).username !== new URL(direct).username
    )
      throw new Error("fixture pooled URI does not pair with the direct endpoint");
    io.stdout(secrets.mask(pooled));
    io.stdout(secrets.mask(new URL(pooled).password));
    phase = "writing-private-uris";
    io.writePrivate("branch_pooled_url", pooled);
    io.writeReport(
      "neon-pr-provision.json",
      `${JSON.stringify(
        {
          schema: "neon-pr-provision/1",
          phase: "connection-verified",
          branchId,
          initSource: "schema-only",
          expiresAt: plan.expiresAt,
        },
        null,
        2,
      )}\n`,
    );
    return { verdict: "OK", branchId };
  } catch (error) {
    // N04: every value already known is redacted from the reason before it is
    // logged or persisted — a provider message that echoes a secret is never
    // stored verbatim.
    const reason = secrets.redact(
      error instanceof Error && error.message
        ? error.message
        : "fixture provisioning unavailable; no raw remote error persisted",
    );
    io.stderr(`Neon fixture provisioning refused: ${reason}`);
    io.writeReport(
      "neon-pr-provision.json",
      `${JSON.stringify(
        {
          schema: "neon-pr-provision/1",
          phase,
          verdict: "NO-VERDICT",
          ...(branchId ? { branchId } : {}),
          ...(error instanceof ProviderRefusal
            ? {
                providerStatus: error.status,
                providerCode: secrets.redact(error.code),
                ...(error.status === 412
                  ? {
                      nextStep:
                        "Provider precondition refused. Check project access, schema-only root allowance and branch-expiration support; the HTTP status alone does not identify the cause. No retry or data-copy fallback was attempted.",
                    }
                  : {}),
              }
            : {}),
          reason,
        },
        null,
        2,
      )}\n`,
    );
    return { verdict: "NO-VERDICT", ...(branchId ? { branchId } : {}) };
  }
}

async function main() {
  const env = process.env;
  if (!env.RUNNER_TEMP || !env.NEON_API_KEY || !env.GITHUB_OUTPUT) {
    console.error("Neon fixture provisioning precondition failed: CI context absent");
    process.exitCode = 2;
    return;
  }
  const temp = env.RUNNER_TEMP;
  const result = await provision(env, fetch, {
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(`${text}\n`),
    appendOutput: (text) => appendFileSync(env.GITHUB_OUTPUT!, text),
    writePrivate: (name, content) => writeFileSync(resolve(temp, name), content, { mode: 0o600 }),
    writeReport: (name, content) => writeFileSync(resolve(temp, name), content),
  });
  if (result.verdict !== "OK") process.exitCode = 2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
