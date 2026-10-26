import { Plugin } from "@opencode/plugin";
import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateToolPolicy } from "./policy";

interface ToolBeforeEvent {
  tool: string;
  sessionID: string;
  agent: string;
  messageID: string;
  id: string;
  input: unknown;
}

interface ToolAfterEvent extends ToolBeforeEvent {
  status: "completed" | "error";
  error?: { type?: string; message?: string };
}

interface ObservabilityLike {
  startTool(event: ToolBeforeEvent, decision: ReturnType<typeof evaluateToolPolicy>): void;
  endTool(event: ToolAfterEvent): void;
  recordUsage(data: unknown, scope?: "step" | "session"): void;
  recordMcp(server: string, status: string, detail?: unknown): void;
  recordError(error: unknown): void;
  shutdown(): Promise<void>;
}

function bootLog(dir: string, type: string, payload: Record<string, unknown> = {}): void {
  try {
    mkdirSync(dir, { recursive: true });
    appendFileSync(
      resolve(dir, "plugin-boot.ndjson"),
      `${JSON.stringify({ ts: new Date().toISOString(), type, ...payload })}\n`,
    );
  } catch {
    // O boot log é best-effort.
  }
}

async function createObservability(dir: string): Promise<ObservabilityLike | null> {
  // O import é dinâmico para que uma falha de resolução do SDK OTel no runtime
  // do OpenCode não impeça o registro dos hooks de enforcement. O erro vai para
  // o boot log e para o stderr, nunca é engolido em silêncio.
  try {
    const mod = await import("./telemetry");
    return new mod.Observability({ dir }) as ObservabilityLike;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    bootLog(dir, "init_failed", { message });
    console.error(
      JSON.stringify({
        level: "error",
        event: "opencode.observability.init_failed",
        message,
      }),
    );
    return null;
  }
}

function mcpServerStatus(
  entry: unknown,
): { server: string; status: string; detail?: unknown } | null {
  if (!entry || typeof entry !== "object") return null;
  const record = entry as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name : null;
  const statusRecord =
    record.status && typeof record.status === "object"
      ? (record.status as Record<string, unknown>)
      : null;
  const status = typeof statusRecord?.status === "string" ? statusRecord.status : "unknown";
  if (!name) return null;
  return { server: name, status, detail: statusRecord };
}

export default Plugin.define({
  id: "observability",
  async setup(ctx) {
    const evidenceDir =
      process.env.OPENCODE_OBSERVABILITY_DIR ??
      resolve(ctx.location.directory, "docs/evidence/observability");
    bootLog(evidenceDir, "setup", { version: ctx.app.version, directory: ctx.location.directory });
    const obs = await createObservability(evidenceDir);
    const controller = new AbortController();

    await ctx.tool.hook("execute.before", (event: ToolBeforeEvent) => {
      bootLog(evidenceDir, "tool.before", { tool: event.tool, callID: event.id });
      const decision = evaluateToolPolicy(event.tool, event.input);
      obs?.startTool(event, decision);
      if (!decision.allowed) {
        // O hook adapter converte este erro em Tool.Error; a chamada falha
        // sozinha e o modelo recebe a regra, sem executar a ferramenta.
        throw new Error(`policy_violation:${decision.rule}: ${decision.reason}`);
      }
    });

    await ctx.tool.hook("execute.after", (event: ToolAfterEvent) => {
      bootLog(evidenceDir, "tool.after", {
        tool: event.tool,
        callID: event.id,
        status: event.status,
      });
      obs?.endTool(event);
    });

    void (async () => {
      for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
        try {
          if (event.type === "session.step.ended" || event.type === "session.usage.updated") {
            obs?.recordUsage(event.data, event.type === "session.step.ended" ? "step" : "session");
            continue;
          }
          if (event.type === "mcp.status.changed") {
            const data =
              event.data && typeof event.data === "object"
                ? (event.data as Record<string, unknown>)
                : null;
            const serverName = typeof data?.server === "string" ? data.server : null;
            if (serverName) {
              const listed = await ctx.mcp.list();
              const entries = Array.isArray(listed)
                ? listed
                : Array.isArray((listed as { data?: unknown[] }).data)
                  ? (listed as { data: unknown[] }).data
                  : [];
              const match = entries
                .map(mcpServerStatus)
                .find((entry) => entry?.server === serverName);
              obs?.recordMcp(
                match?.server ?? serverName,
                match?.status ?? "unknown",
                match?.detail,
              );
            }
          }
        } catch (error) {
          obs?.recordError(error);
        }
      }
    })().catch((error: unknown) => obs?.recordError(error));

    return async () => {
      controller.abort();
      await obs?.shutdown();
    };
  },
});
