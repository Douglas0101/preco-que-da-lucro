/**
 * Política de enforcement do plugin de observabilidade do OpenCode.
 *
 * O módulo é puro: recebe a ferramenta e o input e devolve uma decisão. A
 * entrada nunca é persistida — só a regra violada e o tipo de erro. Isso é
 * deliberado: o hook roda em toda chamada (inclusive MCP) e não pode vazar
 * segredo para o log de observabilidade.
 */

export type PolicyDecision = { allowed: true } | { allowed: false; rule: string; reason: string };

type RecordValue = Record<string, unknown>;

const ENV_EXAMPLE = /^\.env\.(example|sample|template)$/i;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown, depth = 0): string[] {
  if (depth > 3) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap((entry) => strings(entry, depth + 1));
  if (isRecord(value)) return Object.values(value).flatMap((entry) => strings(entry, depth + 1));
  return [];
}

function valuesForKeys(input: unknown, keys: readonly string[]): string[] {
  if (!isRecord(input)) return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (!keys.includes(key.toLowerCase())) continue;
    out.push(...strings(value));
  }
  return out;
}

function basename(path: string): string {
  return path.replaceAll("\\", "/").split("/").pop() ?? "";
}

/** Um `.env` real nunca é legível/gravável; os exemplos versionados são. */
export function isSensitiveEnvPath(path: string): boolean {
  const name = basename(path.trim());
  if (name === "" || ENV_EXAMPLE.test(name)) return false;
  return name === ".env" || name.startsWith(".env.");
}

const DESTRUCTIVE_PATTERNS: ReadonlyArray<{ rule: string; pattern: RegExp; reason: string }> = [
  {
    rule: "recursive_root_delete",
    pattern:
      /\brm\s+(?:-[a-z]*[rR][a-z]*\s+)+(?:\/(?:\s|$)|~(?:\s|$)|\$HOME\b|\/home\b|\/root\b|\/etc\b|\/usr\b|\/var\b|\/opt\b|\/bin\b|\/sbin\b|\/boot\b)/i,
    reason: "remoção recursiva de raiz, home ou diretório de sistema",
  },
  {
    rule: "disk_format",
    pattern: /\bmkfs(?:\.[a-z0-9]+)?\b/i,
    reason: "formatação de dispositivo",
  },
  {
    rule: "raw_device_write",
    pattern: /\bdd\b[^\n]*\bof=\/dev\//i,
    reason: "escrita crua em dispositivo",
  },
  {
    rule: "fork_bomb",
    pattern: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
    reason: "fork bomb",
  },
  {
    rule: "world_writable_root",
    pattern: /\bchmod\s+-R\s+777\s+\//i,
    reason: "permissão world-writable na raiz",
  },
  {
    rule: "force_push",
    pattern: /\bgit\s+push\b[^\n]*\s--force(?:-with-lease)?\b/i,
    reason: "force-push é proibido pelo contrato do repositório",
  },
  {
    rule: "hard_reset",
    pattern: /\bgit\s+reset\s+--hard\b/i,
    reason: "reset --hard descarta WIP sem custódia",
  },
  {
    rule: "shutdown_host",
    pattern: /(?:^|[;&|]\s*)(?:sudo\s+)?(?:shutdown|reboot|halt|poweroff)\b(?:\s|$)/i,
    reason: "desligamento/reinício do host",
  },
];

const DISCOVERY_TOOLS = new Set(["glob", "grep"]);
const PATH_KEYS = ["filepath", "file_path", "path", "file", "filename", "target"] as const;
const COMMAND_KEYS = ["command", "cmd", "script"] as const;
const PATTERN_KEYS = ["pattern", "glob", "query"] as const;

function shellReferencesEnv(command: string): boolean {
  const tokens = command.split(/[\s;|&()<>"'`]+/).filter(Boolean);
  return tokens.some((token) => {
    const normalized = token.startsWith("--env-file=") ? token.slice("--env-file=".length) : token;
    const name = basename(normalized);
    if (name === "" || ENV_EXAMPLE.test(name)) return false;
    return name === ".env" || name.startsWith(".env.");
  });
}

export function evaluateToolPolicy(tool: string, input: unknown): PolicyDecision {
  const paths = valuesForKeys(input, PATH_KEYS);
  for (const path of paths) {
    if (isSensitiveEnvPath(path)) {
      return {
        allowed: false,
        rule: "sensitive_env_file",
        reason: "leitura/escrita de .env é proibida; use .env.example para documentação",
      };
    }
  }

  if (DISCOVERY_TOOLS.has(tool)) {
    for (const pattern of valuesForKeys(input, PATTERN_KEYS)) {
      if (/(^|[/\\*])\.env(?:$|[.*\\/])/.test(pattern) && !pattern.includes(".env.example")) {
        return {
          allowed: false,
          rule: "sensitive_env_discovery",
          reason: "busca explícita por .env é proibida",
        };
      }
    }
  }

  const commands = valuesForKeys(input, COMMAND_KEYS);
  for (const command of commands) {
    if (shellReferencesEnv(command)) {
      return {
        allowed: false,
        rule: "sensitive_env_shell",
        reason: "comando de shell referencia .env; use .env.example",
      };
    }
  }
  for (const command of commands) {
    for (const entry of DESTRUCTIVE_PATTERNS) {
      if (entry.pattern.test(command)) {
        return { allowed: false, rule: entry.rule, reason: entry.reason };
      }
    }
  }

  return { allowed: true };
}

export const policyRules = Object.freeze([
  "sensitive_env_file",
  "sensitive_env_discovery",
  "sensitive_env_shell",
  ...DESTRUCTIVE_PATTERNS.map((entry) => entry.rule),
] as const);
