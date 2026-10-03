export interface RequestObservation {
  origin: "sonar" | "github";
  path: string;
  status: number | null;
  latencyMs: number;
  failure?: "http" | "transport" | "payload";
}
export interface ApiPayload {
  commit?: { sha?: string };
  analyses?: { key?: string; revision?: string }[];
  components?: unknown[];
  paging?: { total?: number };
  workflow_runs?: unknown[];
  total_count?: number;
  [key: string]: unknown;
}

export class ApiPrecondition extends Error {
  status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.status = status;
  }
}

export function apiReader(
  tokens: { sonar: string; github: string },
  requests: RequestObservation[],
  fetchImpl: typeof fetch = fetch,
) {
  return async function get<T = ApiPayload>(
    origin: "sonar" | "github",
    endpoint: string,
  ): Promise<T> {
    if (!/^[a-z_]+\/[A-Za-z0-9_/?=&.%,-]+$/.test(endpoint))
      throw new ApiPrecondition("API endpoint identity unavailable");
    const base = origin === "sonar" ? "https://sonarcloud.io/api/" : "https://api.github.com/";
    const url = new URL(endpoint, base);
    const observation: RequestObservation = {
      origin,
      path: url.pathname,
      status: null,
      latencyMs: 0,
    };
    requests.push(observation);
    const started = Date.now();
    try {
      const response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${tokens[origin]}`, Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(15000),
      });
      observation.status = response.status;
      if (!response.ok) {
        observation.failure = "http";
        throw new ApiPrecondition(
          `API ${observation.path} HTTP ${response.status}`,
          response.status,
        );
      }
      const body = await response.text();
      if (Buffer.byteLength(body) > 2_000_000) {
        observation.failure = "payload";
        throw new ApiPrecondition("API payload exceeds limit");
      }
      try {
        return JSON.parse(body) as T;
      } catch {
        observation.failure = "payload";
        throw new ApiPrecondition("API response is not JSON");
      }
    } catch (error) {
      if (error instanceof ApiPrecondition) throw error;
      observation.failure = "transport";
      throw new ApiPrecondition(`API ${observation.path} transport unavailable`);
    } finally {
      observation.latencyMs = Math.max(0, Date.now() - started);
    }
  };
}

export function permitsSourceFallback(error: unknown) {
  return error instanceof ApiPrecondition && [400, 404, 405].includes(error.status ?? 0);
}
