/**
 * V6 — redação de capturas visuais antes de qualquer persistência.
 *
 * Fato gerador (incidente L239): `locator.ariaSnapshot()` devolve **texto**, e
 * esse texto carregava `DATABASE_URL`/`BETTER_AUTH_SECRET` vivos da página de
 * settings do hPanel. A regra deste módulo é fail-closed — a captura só pode ser
 * persistida depois de passar por aqui, e o consumidor (`visual-perception.ts`)
 * reprova se a varredura de resíduo ainda encontrar qualquer coisa.
 *
 * Módulo puro: recebe e devolve strings/bytes, sem I/O e sem importar
 * `@playwright/test` — é testável sem browser, sem rede e sem app.
 *
 * Limite declarado (ADR-033): a redação cobre texto estruturado (a11y YAML, DOM,
 * chunks de texto do PNG). Não há OCR de pixels; uma captura com a imagem de um
 * segredo pintada na tela não é detectada por este módulo.
 */

export interface RedactionResult<T> {
  value: T;
  applied: number;
}

/** Estrutura serializável de snapshot de DOM (subconjunto suficiente para evidência). */
export interface DomNodeSnapshot {
  tag: string;
  attributes: Record<string, string>;
  text?: string;
  children?: DomNodeSnapshot[];
}

export class VisualRedactionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VisualRedactionError";
  }
}

export class VisualRedactionLeakError extends Error {
  constructor(leaks: readonly string[]) {
    super(`captura visual contém resíduo não redigido: ${leaks.join(", ")}`);
    this.name = "VisualRedactionLeakError";
  }
}

type Env = Readonly<Record<string, string | undefined>>;

const ENV_SECRET_NAME =
  /(SECRET|PASSWORD|TOKEN|API_KEY|APIKEY|DATABASE_URL|CONNECTION|CREDENTIAL|PRIVATE)/i;
const MIN_ENV_SECRET_LENGTH = 8;
const MAX_DOM_DEPTH = 128;

/** Entradas de env cujo NOME parece segredo; maior valor primeiro para não sombrear. */
function envSecretEntries(env: Env): Array<{ name: string; value: string }> {
  const entries: Array<{ name: string; value: string }> = [];
  for (const [name, raw] of Object.entries(env)) {
    if (!ENV_SECRET_NAME.test(name)) continue;
    const value = raw?.trim();
    if (!value || value.length < MIN_ENV_SECRET_LENGTH) continue;
    entries.push({ name, value });
  }
  entries.sort((a, b) => b.value.length - a.value.length);
  return entries;
}

interface Detector {
  kind: string;
  pattern: RegExp;
  replacement: string;
}

/**
 * Catálogo de detectores. A ordem importa: strings de conexão antes de e-mail
 * (uma URL de banco contém algo com cara de e-mail no meio), atribuição depois
 * da URL (o valor já saiu), PII por último.
 */
const DETECTORS: readonly Detector[] = [
  {
    kind: "connection-string",
    pattern: /\b(?:postgres(?:ql)?|rediss?|mongodb(?:\+srv)?|amqps?):\/\/[^\s"'`<>|\\]+/gi,
    replacement: "[REDACTED:connection-string]",
  },
  {
    kind: "secret-assignment",
    pattern:
      /\b([A-Z][A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN|API_KEY|APIKEY|DATABASE_URL|CONNECTION|CREDENTIAL)[A-Z0-9_]*)\s*([:=])\s*(["']?)([^\s"',;)}\]]+)\3/g,
    replacement: "$1$2$3[REDACTED:secret]$3",
  },
  {
    kind: "bearer-token",
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/g,
    replacement: "Bearer [REDACTED]",
  },
  {
    kind: "jwt",
    pattern: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\b/g,
    replacement: "[REDACTED:jwt]",
  },
  {
    kind: "email",
    pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    replacement: "[REDACTED:email]",
  },
  {
    kind: "cpf",
    pattern: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
    replacement: "[REDACTED:cpf]",
  },
  {
    kind: "cnpj",
    pattern: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,
    replacement: "[REDACTED:cnpj]",
  },
  {
    kind: "phone",
    pattern: /(?:\+55\s*)?\(\d{2}\)\s*\d{4,5}[-.\s]?\d{4}\b/g,
    replacement: "[REDACTED:phone]",
  },
];

function matches(pattern: RegExp, text: string): boolean {
  pattern.lastIndex = 0;
  const found = pattern.test(text);
  pattern.lastIndex = 0;
  return found;
}

function applyPattern(
  text: string,
  pattern: RegExp,
  replacement: Detector["replacement"],
): RedactionResult<string> {
  pattern.lastIndex = 0;
  const matches = text.match(pattern);
  pattern.lastIndex = 0;
  const applied = matches ? matches.length : 0;
  // A expansão de `$1`/`$2` só acontece com reposição em string (não com função).
  return { value: applied > 0 ? text.replace(pattern, replacement) : text, applied };
}

/** Substitui cada valor vivo de env cujo nome parece segredo pelo rótulo do nome. */
function redactEnvValues(text: string, env: Env): RedactionResult<string> {
  let value = text;
  let applied = 0;
  for (const { name, value: secret } of envSecretEntries(env)) {
    const parts = value.split(secret);
    if (parts.length > 1) {
      applied += parts.length - 1;
      value = parts.join(`[REDACTED:env:${name}]`);
    }
  }
  return { value, applied };
}

/** Redige texto livre (a11y YAML, atributos, texto de nó). Idempotente por construção. */
export function redactText(text: string, env: Env = process.env): RedactionResult<string> {
  const fromEnv = redactEnvValues(text, env);
  let value = fromEnv.value;
  let applied = fromEnv.applied;
  for (const detector of DETECTORS) {
    const result = applyPattern(value, detector.pattern, detector.replacement);
    value = result.value;
    applied += result.applied;
  }
  return { value, applied };
}

/** O snapshot de acessibilidade é texto; a redação é a mesma de texto livre. */
export function redactA11ySnapshot(
  snapshot: string,
  env: Env = process.env,
): RedactionResult<string> {
  return redactText(snapshot, env);
}

/** Redige atributos e texto de um snapshot de DOM, recursivamente. */
export function redactDomSnapshot(
  dom: DomNodeSnapshot,
  env: Env = process.env,
): RedactionResult<DomNodeSnapshot> {
  let applied = 0;
  const walk = (node: DomNodeSnapshot, depth: number): DomNodeSnapshot => {
    if (depth > MAX_DOM_DEPTH) throw new VisualRedactionError("snapshot de DOM profundo demais");
    const attributes: Record<string, string> = {};
    for (const [name, value] of Object.entries(node.attributes)) {
      const result = redactText(value, env);
      applied += result.applied;
      attributes[name] = result.value;
    }
    let text = node.text;
    if (text !== undefined) {
      const result = redactText(text, env);
      applied += result.applied;
      text = result.value;
    }
    const children = node.children?.map((child) => walk(child, depth + 1));
    return {
      tag: node.tag,
      attributes,
      ...(text === undefined ? {} : { text }),
      ...(children ? { children } : {}),
    };
  };
  return { value: walk(dom, 0), applied };
}

/**
 * Varredura independente de resíduo: devolve os TIPOS encontrados, nunca os
 * valores. É o que autoriza a persistência — resíduo não vazio reprova.
 */
export function findSecretLeaks(text: string, env: Env = process.env): string[] {
  const leaks: string[] = [];
  for (const { name, value } of envSecretEntries(env)) {
    if (text.includes(value)) leaks.push(`env:${name}`);
  }
  for (const detector of DETECTORS) {
    if (matches(detector.pattern, text)) leaks.push(detector.kind);
  }
  return [...new Set(leaks)];
}

/** Falha fechado: qualquer resíduo interrompe a persistência. */
export function assertNoSecretLeaks(text: string, env: Env = process.env): void {
  const leaks = findSecretLeaks(text, env);
  if (leaks.length > 0) throw new VisualRedactionLeakError(leaks);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_TEXT_CHUNKS = new Set(["tEXt", "zTXt", "iTXt", "eXIf"]);

/**
 * Remove chunks de texto/metadados do PNG (tEXt/zTXt/iTXt/eXIf) preservando os
 * demais bytes — IDAT/IHDR/IEND saem byte a byte como entraram. Um arquivo que
 * não é PNG válido (ou truncado) reprova em vez de passar adiante.
 */
export function redactPng(buffer: Buffer): RedactionResult<Buffer> {
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new VisualRedactionError("payload não é um PNG válido");
  }
  const chunks: Buffer[] = [PNG_SIGNATURE];
  let offset = PNG_SIGNATURE.length;
  let applied = 0;
  while (offset < buffer.length) {
    if (offset + 8 > buffer.length)
      throw new VisualRedactionError("PNG truncado no cabeçalho do chunk");
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) throw new VisualRedactionError("PNG truncado no corpo do chunk");
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    if (PNG_TEXT_CHUNKS.has(type)) {
      applied += 1;
    } else {
      chunks.push(buffer.subarray(offset, end));
    }
    offset = end;
  }
  if (offset !== buffer.length) throw new VisualRedactionError("PNG com bytes residuais após IEND");
  return { value: Buffer.concat(chunks), applied };
}
