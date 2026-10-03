import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const PROJECT_ID = "damp-forest-57346541";
export const DEVELOP_ID = "br-small-hill-aymcu14y";
export const PRODUCTION_ID = "br-snowy-violet-aymcvvvv";
const apiBase = "https://console.neon.tech/api/v2";
export interface ResourcePlan {
  purpose: "readiness" | "provisioning";
  projectId: string;
  parentId: string;
  name: string;
  sourceSha: string;
  runId: string;
  runAttempt: string;
  startedAt: string;
  expiresAt: string;
}
export interface Branch {
  id: string;
  name: string;
  project_id: string;
  parent_id?: string;
  default: boolean;
  expires_at?: string;
  created_at?: string;
}
export type ResourceFetch = (url: string, init: RequestInit) => Promise<Response>;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function resourcePlan(env: NodeJS.ProcessEnv, now = new Date()): ResourcePlan {
  const purpose = env.RESOURCE_PURPOSE ?? "readiness";
  if (!["readiness", "provisioning"].includes(purpose))
    throw new Error("resource purpose unavailable");
  if (
    env.GITHUB_REF !== "refs/heads/develop" ||
    env.NEON_PROJECT_ID !== PROJECT_ID ||
    !/^[a-f0-9]{40}$/.test(env.GITHUB_SHA ?? "") ||
    !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID ?? "") ||
    !/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ATTEMPT ?? "")
  )
    throw new Error("develop/project/source/run precondition failed");
  const startedAt = env.RESOURCE_STARTED_AT ?? now.toISOString();
  const start = Date.parse(startedAt);
  if (
    !Number.isFinite(start) ||
    start > now.getTime() + 60000 ||
    now.getTime() - start > 2 * 3600000
  )
    throw new Error("run start identity is stale or absent");
  const expiresAt = new Date(Math.floor((start + 24 * 3600000) / 1000) * 1000)
    .toISOString()
    .replace(/\.000Z$/, "Z");
  if (env.RESOURCE_EXPIRES_AT && Date.parse(env.RESOURCE_EXPIRES_AT) !== Date.parse(expiresAt))
    throw new Error("run expiry identity differs");
  return {
    purpose: purpose as ResourcePlan["purpose"],
    projectId: PROJECT_ID,
    parentId: purpose === "provisioning" ? PRODUCTION_ID : DEVELOP_ID,
    name: `${purpose}/develop-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`,
    sourceSha: env.GITHUB_SHA!,
    runId: env.GITHUB_RUN_ID!,
    runAttempt: env.GITHUB_RUN_ATTEMPT!,
    startedAt,
    expiresAt,
  };
}
export function assertPermanentInventory(branches: Branch[]) {
  if (new Set(branches.map((branch) => branch.id)).size !== branches.length)
    throw new Error("duplicated branch discovery");
  for (const [id, name, isDefault] of [
    [DEVELOP_ID, "develop", false],
    [PRODUCTION_ID, "production", true],
  ] as const) {
    const found = branches.filter((branch) => branch.id === id);
    if (
      found.length !== 1 ||
      found[0].name !== name ||
      found[0].project_id !== PROJECT_ID ||
      found[0].default !== isDefault
    )
      throw new Error("permanent branch identity/default is not verified");
  }
}
export function assertTemporary(
  branch: Branch,
  plan: ResourcePlan,
  id: string,
  created: string,
  now: Date,
) {
  if (created !== "true")
    throw new Error("resource ownership or non-production identity is not verified");
  assertOwnedResource(branch, plan, id, now);
  const expires = Date.parse(branch.expires_at ?? "");
  if (
    !Number.isFinite(expires) ||
    expires !== Date.parse(plan.expiresAt) ||
    expires <= now.getTime()
  )
    throw new Error("temporary branch expiry/creation time is not verified");
}

// Cleanup cannot depend on expiry having succeeded: an owned branch with a
// missing expiry is precisely a resource that must still be discarded.
export function assertOwnedResource(branch: Branch, plan: ResourcePlan, id: string, now: Date) {
  if (!/^br-[a-z0-9-]+$/.test(id) || [DEVELOP_ID, PRODUCTION_ID].includes(id))
    throw new Error("resource non-production identity is not verified");
  if (
    branch.id !== id ||
    branch.project_id !== plan.projectId ||
    branch.parent_id !== plan.parentId ||
    branch.name !== plan.name ||
    branch.default !== false
  )
    throw new Error("temporary branch identity/parent/default differs");
  const createdAt = Date.parse(branch.created_at ?? "");
  if (
    !Number.isFinite(createdAt) ||
    createdAt < Date.parse(plan.startedAt) - 60000 ||
    createdAt > now.getTime() + 60000
  )
    throw new Error("temporary branch expiry/creation time is not verified");
}
export function assertConnectionPair(admin: string, pooled: string) {
  const direct = new URL(admin),
    runtime = new URL(pooled);
  const host = direct.hostname;
  if (
    ![direct.protocol, runtime.protocol].every((value) =>
      ["postgres:", "postgresql:"].includes(value),
    ) ||
    !/^ep-[a-z0-9-]+(?:\.c-[0-9]+)?\.[a-z0-9-]+\.aws\.neon\.tech$/.test(host) ||
    host.includes("-pooler") ||
    host.includes("ep-long-violet-aye9g0bn") ||
    runtime.hostname !== host.replace(/^([^.]+)/, "$1-pooler") ||
    direct.pathname !== runtime.pathname ||
    direct.username !== runtime.username ||
    direct.password !== runtime.password ||
    !direct.username ||
    !direct.password ||
    direct.pathname === "/" ||
    [direct, runtime].some(
      (url) =>
        !["require", "verify-ca", "verify-full"].includes(url.searchParams.get("sslmode") ?? ""),
    )
  )
    throw new Error("temporary direct/pooled connection identity differs or targets production");
}
export class NeonResources {
  private plan: ResourcePlan;
  private apiKey: string;
  private fetchImpl: ResourceFetch;
  constructor(plan: ResourcePlan, apiKey: string, fetchImpl: ResourceFetch = fetch) {
    const expectedParent = plan.purpose === "provisioning" ? PRODUCTION_ID : DEVELOP_ID;
    if (
      !apiKey ||
      !["readiness", "provisioning"].includes(plan.purpose) ||
      plan.projectId !== PROJECT_ID ||
      plan.parentId !== expectedParent ||
      plan.name !== `${plan.purpose}/develop-${plan.runId}-${plan.runAttempt}`
    )
      throw new Error("resource API precondition failed");
    this.plan = plan;
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }
  async request(path: string, method = "GET", payload?: unknown) {
    const response = await this.fetchImpl(`${apiBase}/projects/${this.plan.projectId}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
        ...(payload ? { "Content-Type": "application/json" } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    let body: unknown = null;
    if (response.status !== 204) {
      if (!response.headers.get("content-type")?.includes("application/json"))
        throw new Error("resource API returned non-JSON");
      const text = await response.text();
      if (text.length > 2000000) throw new Error("resource API response exceeds limit");
      try {
        body = JSON.parse(text);
      } catch {
        throw new Error("resource API returned invalid JSON");
      }
    }
    if (!response.ok && response.status !== 404) {
      const code =
        record(body) && typeof body.code === "string" && /^[A-Z_]{3,64}$/.test(body.code)
          ? body.code
          : "UNCLASSIFIED";
      throw new Error(`resource API ${method} HTTP ${response.status}, code=${code}`);
    }
    return { status: response.status, body };
  }
  async branches() {
    const branches: Branch[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined;
    for (let page = 0; page < 100; page++) {
      const params = new URLSearchParams({ limit: "100", sort_by: "name", sort_order: "asc" });
      if (cursor) params.set("cursor", cursor);
      const { status, body } = await this.request(`branches?${params}`);
      if (
        status !== 200 ||
        !record(body) ||
        !Array.isArray(body.branches) ||
        !record(body.pagination)
      )
        throw new Error("branch inventory is incomplete");
      for (const item of body.branches) {
        if (
          !record(item) ||
          typeof item.id !== "string" ||
          typeof item.name !== "string" ||
          typeof item.project_id !== "string" ||
          typeof item.default !== "boolean"
        )
          throw new Error("branch inventory identity is absent");
        branches.push(item as unknown as Branch);
      }
      const next = body.pagination.next;
      if (next === undefined || next === null || next === "") {
        assertPermanentInventory(branches);
        return branches;
      }
      if (typeof next !== "string" || seen.has(next))
        throw new Error("branch pagination is invalid");
      seen.add(next);
      cursor = next;
    }
    throw new Error("branch pagination exceeds limit");
  }
  async prepare() {
    const branches = await this.branches();
    if (branches.some((branch) => branch.name === this.plan.name))
      throw new Error("run resource name already exists; never reuse it");
    return {
      schema: "neon-resource/1",
      plan: this.plan,
      phase: "planned",
      permanentIds: [DEVELOP_ID, PRODUCTION_ID],
    };
  }
  async created(id: string, ownership: string, now: Date) {
    const { status, body } = await this.request(`branches/${encodeURIComponent(id)}`);
    if (status !== 200 || !record(body) || !record(body.branch))
      throw new Error("created resource is not observable");
    assertTemporary(body.branch as unknown as Branch, this.plan, id, ownership, now);
    return {
      schema: "neon-resource/1",
      plan: this.plan,
      phase: "created-verified",
      branchId: id,
      created: true,
    };
  }
  private async discover(id: string, ownership: string, now: Date): Promise<Branch | null> {
    if (ownership === "false") throw new Error("resource ownership is reused; cleanup escalated");
    if (id) {
      if (ownership !== "true" || [DEVELOP_ID, PRODUCTION_ID].includes(id))
        throw new Error("resource ownership or non-production identity is not verified");
      const { status, body } = await this.request(`branches/${encodeURIComponent(id)}`);
      if (status === 404) return null;
      if (status !== 200 || !record(body) || !record(body.branch))
        throw new Error("created resource is not observable");
      const branch = body.branch as unknown as Branch;
      assertOwnedResource(branch, this.plan, id, now);
      return branch;
    }
    // Only a prepare output emitted after absence verification authorizes this
    // recovery path in CI. Name AND parent/project/default/creation time bind it
    // to this run; cardinality alone never authorizes deletion.
    const matches = (await this.branches()).filter((branch) => branch.name === this.plan.name);
    if (matches.length > 1) throw new Error("resource discovery is ambiguous; cleanup escalated");
    if (matches.length === 0) return null;
    assertOwnedResource(matches[0], this.plan, matches[0].id, now);
    return matches[0];
  }
  async adopt(id: string, ownership: string, now: Date) {
    const branch = await this.discover(id, ownership, now);
    if (!branch) throw new Error("created resource absent; provisioning is not verified");
    if (Date.parse(branch.expires_at ?? "") !== Date.parse(this.plan.expiresAt)) {
      const response = await this.request(`branches/${encodeURIComponent(branch.id)}`, "PATCH", {
        branch: { expires_at: this.plan.expiresAt },
      });
      if (response.status !== 200) throw new Error("resource expiry update unavailable");
    }
    return this.created(branch.id, "true", now);
  }
  async connections(id: string, ownership: string, admin: string, pooled: string, now: Date) {
    if (!admin || !pooled) throw new Error("resource connection outputs unavailable");
    assertConnectionPair(admin, pooled);
    await this.created(id, ownership, now);
    const { status, body } = await this.request(`branches/${encodeURIComponent(id)}/endpoints`);
    const host = new URL(admin).hostname;
    if (
      status !== 200 ||
      !record(body) ||
      !Array.isArray(body.endpoints) ||
      body.endpoints.filter(
        (endpoint) =>
          record(endpoint) &&
          endpoint.host === host &&
          endpoint.branch_id === id &&
          endpoint.project_id === this.plan.projectId,
      ).length !== 1
    )
      throw new Error("resource connection endpoint does not belong to the owned branch");
    return {
      schema: "neon-resource/1",
      phase: "connection-identity-verified",
      branchId: id,
      directAndPooled: true,
      hostname: host,
    };
  }
  async cleanup(id: string, ownership: string, now: Date) {
    const owned = await this.discover(id, ownership, now);
    if (!owned) {
      const branches = await this.branches();
      if (branches.some((branch) => branch.id === id || branch.name === this.plan.name))
        throw new Error("resource still present in independent inventory");
      return {
        schema: "neon-resource/1",
        plan: this.plan,
        phase: "no-resource-observed",
        created: false,
        deletePerformed: false,
        permanentIds: [DEVELOP_ID, PRODUCTION_ID],
        absentByIdAndName: true,
        ...(id ? { getStatus: 404, branchId: id } : {}),
      };
    }
    id = owned.id;
    const deleted = await this.request(`branches/${encodeURIComponent(id)}`, "DELETE");
    if (![200, 204].includes(deleted.status)) throw new Error("resource delete was not accepted");
    if (
      deleted.status === 200 &&
      (!record(deleted.body) || !record(deleted.body.branch) || deleted.body.branch.id !== id)
    )
      throw new Error("resource delete response identity differs");
    const observed = await this.request(`branches/${encodeURIComponent(id)}`);
    if (observed.status !== 404) throw new Error("resource deletion has no GET 404 proof");
    const branches = await this.branches();
    if (branches.some((branch) => branch.id === id || branch.name === this.plan.name))
      throw new Error("resource still present in independent inventory");
    return {
      schema: "neon-resource/1",
      plan: this.plan,
      phase: "discarded-verified",
      branchId: id,
      created: true,
      deletePerformed: true,
      getStatus: 404,
      absentByIdAndName: true,
      permanentIds: [DEVELOP_ID, PRODUCTION_ID],
    };
  }
}
async function main() {
  const command = process.argv[2];
  const dir = resolve(
    process.env.RESOURCE_PURPOSE === "provisioning"
      ? ".artifacts/neon-provisioning"
      : ".artifacts/neon-readiness",
  );
  mkdirSync(dir, { recursive: true });
  let report: unknown;
  try {
    const plan = resourcePlan(process.env);
    if (execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() !== plan.sourceSha)
      throw new Error("checkout differs from resource source");
    const api = new NeonResources(plan, process.env.NEON_API_KEY ?? "");
    if (command === "prepare") {
      report = await api.prepare();
      if (!process.env.GITHUB_OUTPUT) throw new Error("resource output file absent");
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `branch_name=${plan.name}\nexpires_at=${plan.expiresAt}\nstarted_at=${plan.startedAt}\n`,
      );
    } else if (command === "adopt") {
      if (!process.env.RESOURCE_STARTED_AT) throw new Error("resource prepare checkpoint absent");
      const adopted = await api.adopt(
        process.env.BRANCH_ID ?? "",
        process.env.BRANCH_CREATED ?? "",
        new Date(),
      );
      report = adopted;
      if (process.env.GITHUB_OUTPUT)
        appendFileSync(process.env.GITHUB_OUTPUT, `branch_id=${adopted.branchId}\ncreated=true\n`);
    } else if (command === "created")
      report = await api.created(
        process.env.BRANCH_ID ?? "",
        process.env.BRANCH_CREATED ?? "",
        new Date(),
      );
    else if (command === "connections")
      report = await api.connections(
        process.env.BRANCH_ID ?? "",
        process.env.BRANCH_CREATED ?? "",
        process.env.DATABASE_ADMIN_URL ?? "",
        process.env.DATABASE_URL ?? "",
        new Date(),
      );
    else if (command === "cleanup") {
      if (!process.env.RESOURCE_STARTED_AT) throw new Error("resource prepare checkpoint absent");
      report = await api.cleanup(
        process.env.BRANCH_ID ?? "",
        process.env.BRANCH_CREATED ?? "",
        new Date(),
      );
    } else throw new Error("unknown resource command");
    console.log(JSON.stringify(report));
  } catch (error) {
    // Never persist an arbitrary network exception or provider response.
    const message =
      error instanceof Error &&
      /^(develop\/|run |resource |permanent |duplicated |temporary |branch |created |creation |checkout |unknown )/.test(
        error.message,
      )
        ? error.message
        : "resource request unavailable; no remote raw body exposed";
    report = { schema: "neon-resource/1", phase: command, verdict: "NO-VERDICT", reason: message };
    console.error(message);
    process.exitCode = 2;
  } finally {
    writeFileSync(join(dir, `${command}.json`), JSON.stringify(report, null, 2) + "\n");
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  await main();
