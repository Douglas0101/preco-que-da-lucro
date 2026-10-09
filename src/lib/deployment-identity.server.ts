import { readEnv } from "@/lib/env.server";

/**
 * Identidade do artefato que está servindo, para logs de runtime.
 *
 * O incidente de 2026-10-08 (`docs/evidence/production-runtime-incident-2026-10-08/`)
 * só pôde ser atribuído a um deployment porque a superfície de clusters da
 * plataforma guarda `lastDeployment`; a linha de log em si
 * (`health.readiness_failed`) não carregava deployment nem SHA. Sem isso, duas
 * revisões com o mesmo sintoma são indistinguíveis no log.
 *
 * Os dois valores são variáveis de sistema que a plataforma Vercel publica em
 * todo deployment. Nenhum dos dois é sensível: são identificadores públicos,
 * comparáveis com o `gitCommitSha` que a API de deployment já devolve.
 *
 * `readEnv`, não a coalescência direta sobre `process.env`: um registro
 * definido-e-vazio (a forma que um env criado no import do projeto e nunca
 * preenchido produz, DBT-97) não pode virar string vazia no log.
 */
export interface DeploymentIdentity {
  deploymentId?: string;
  commitSha?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEPLOYMENT_ID_PATTERN = /^dpl_[A-Za-z0-9]{10,64}$/;
const COMMIT_SHA_PATTERN = /^[0-9a-f]{7,64}$/;

function patternOrUndefined(value: string | undefined, pattern: RegExp): string | undefined {
  if (value === undefined || !pattern.test(value)) return undefined;
  return value;
}

/** Identidade do deployment corrente; campos ausentes ficam fora do log. */
export function deploymentIdentity(): DeploymentIdentity {
  const identity: DeploymentIdentity = {};
  const deploymentId = patternOrUndefined(readEnv("VERCEL_DEPLOYMENT_ID"), DEPLOYMENT_ID_PATTERN);
  const commitSha = patternOrUndefined(readEnv("VERCEL_GIT_COMMIT_SHA"), COMMIT_SHA_PATTERN);
  if (deploymentId !== undefined) identity.deploymentId = deploymentId;
  if (commitSha !== undefined) identity.commitSha = commitSha;
  return identity;
}

/**
 * Correlação da requisição: o cabeçalho do chamador quando válido, ou um UUID
 * novo. Mesmo predicado de `src/server.ts:84-87`, para que o mesmo
 * `x-correlation-id` ligue a linha de readiness ao 500 da aplicação.
 */
export function requestCorrelationId(request: Request): string {
  const supplied = request.headers.get("x-correlation-id");
  return supplied !== null && UUID_PATTERN.test(supplied)
    ? supplied
    : (globalThis.crypto?.randomUUID?.() ?? `corr-${Math.random().toString(36).slice(2)}`);
}
