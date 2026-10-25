import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import { logJson } from "@/lib/structured-logger";

/**
 * ADR-048 §Decisão 1 e §Decisão 8 — nonce de CSP com escopo de requisição.
 *
 * O nonce precisa ser **por requisição** e nunca viver em opções de uma instância de router
 * compartilhada: duas requisições concorrentes no mesmo isolate trocariam o valor. O
 * `AsyncLocalStorage` dá esse escopo sem passar o valor por assinatura em cada camada.
 *
 * Módulo server-only (`*.server.ts`): importa `node:async_hooks`/`node:crypto`, então não pode
 * entrar no bundle do cliente. O consumo em `getRouter()` é o próximo PR (wiring), junto com a
 * política de documento que ainda depende do WIP de `security-headers.ts`/`start.ts`.
 */

/** 16 bytes em base64url = 22 caracteres; 128 bits de entropia. */
export const CSP_NONCE_PATTERN = /^[A-Za-z0-9_-]{22}$/;

const storage = new AsyncLocalStorage<string>();

export function isValidCspNonce(value: unknown): value is string {
  return typeof value === "string" && CSP_NONCE_PATTERN.test(value);
}

export function mintCspNonce(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * Executa `run` com o nonce no escopo. Valor inválido **não** estabelece contexto (fail-closed):
 * a resposta sai sem nonce, com código de log fixo. O valor em si nunca é logado.
 */
export function withCspNonce<T>(nonce: string | undefined, run: () => T): T {
  if (!isValidCspNonce(nonce)) {
    if (nonce !== undefined) logJson("warn", "csp.nonce_rejected", { reason: "format" });
    return run();
  }
  return storage.run(nonce, run);
}

export function currentCspNonce(): string | undefined {
  return storage.getStore();
}
