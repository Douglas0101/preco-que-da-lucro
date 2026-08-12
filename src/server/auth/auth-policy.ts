export interface AuthRuntimePolicy {
  baseURL?: string;
  trustedOrigins: string[];
  secureCookies: boolean;
  sessionCookieName: string;
}

function parseOrigin(value: string, variableName: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${variableName} contém uma URL inválida`);
  }

  if (
    parsed.protocol !== "https:" &&
    parsed.hostname !== "localhost" &&
    parsed.hostname !== "127.0.0.1"
  ) {
    throw new Error(`${variableName} deve usar HTTPS fora do ambiente local`);
  }
  if (
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(`${variableName} deve conter somente a origem, sem path, credencial ou query`);
  }
  return parsed.origin;
}

export function resolveAuthPolicy(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AuthRuntimePolicy {
  const production = environment.NODE_ENV === "production";
  const baseURL = environment.BETTER_AUTH_URL
    ? parseOrigin(environment.BETTER_AUTH_URL, "BETTER_AUTH_URL")
    : undefined;

  if (production && !baseURL) {
    throw new Error("BETTER_AUTH_URL é obrigatória em produção");
  }

  const configuredOrigins = (environment.AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => parseOrigin(value, "AUTH_TRUSTED_ORIGINS"));

  const localOrigins = production
    ? []
    : ["http://localhost:3000", "http://localhost:4173", "http://127.0.0.1:3000"];

  return {
    baseURL,
    trustedOrigins: [
      ...new Set([...(baseURL ? [baseURL] : []), ...configuredOrigins, ...localOrigins]),
    ],
    secureCookies: production,
    sessionCookieName: production
      ? "__Host-preco_que_da_lucro.session_token"
      : "preco_que_da_lucro.session_token",
  };
}

export function requireAuthSecret(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const secret = environment.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET deve ter pelo menos 32 caracteres");
  }
  return secret;
}

export function resolveGoogleCredentials(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): { clientId: string; clientSecret: string } | undefined {
  const clientId = environment.GOOGLE_CLIENT_ID;
  const clientSecret = environment.GOOGLE_CLIENT_SECRET;
  if (!clientId && !clientSecret) return undefined;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET devem ser configurados juntos");
  }
  return { clientId, clientSecret };
}
