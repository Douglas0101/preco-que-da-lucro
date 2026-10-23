/**
 * §20.1 — contrato do endpoint de coleta de violações de CSP.
 *
 * Dois formatos chegam de fato ao endpoint:
 *  - `application/csp-report` (canal legado `report-uri`): `{ "csp-report": { "blocked-uri": … } }`
 *  - `application/reports+json` (Reporting API, `report-to`/`Reporting-Endpoints`):
 *    `[{ "type": "csp-violation", "body": { "blockedURL": … } }]`
 *
 * O parse é deliberadamente leniente com os campos (relatório com campo
 * desconhecido continua sendo coletado) e estrito com a forma, porque a coleta
 * é best-effort: nada aqui pode lançar exceção.
 */

export const CSP_REPORT_MAX_PAYLOAD_BYTES = 8_192;
export const CSP_REPORTS_PER_REQUEST_LIMIT = 10;

/** URLs de bloqueio (`data:`, blob) podem ser longas; o log não precisa delas inteiras. */
const MAX_FIELD_LENGTH = 500;

export type CspReportShape = "csp-report" | "reports+json";

export type CspViolation = {
  effectiveDirective: string | null;
  violatedDirective: string | null;
  blockedUri: string | null;
  documentUri: string | null;
  sourceFile: string | null;
  lineNumber: number | null;
  columnNumber: number | null;
  disposition: string | null;
  sample: string | null;
};

export type CspReportRejectionReason =
  | "unsupported_media_type"
  | "payload_too_large"
  | "invalid_json"
  | "invalid_payload"
  | "unexpected_error";

export type CspReportParseResult =
  | { ok: true; violations: CspViolation[]; suppressed: number }
  | { ok: false; reason: "invalid_json" | "invalid_payload" };

/** `null` para qualquer media type que não seja um dos dois canais de relatório de CSP. */
export function cspReportShape(contentType: string | null): CspReportShape | null {
  const mediaType = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (mediaType === "application/csp-report") return "csp-report";
  if (mediaType === "application/reports+json") return "reports+json";
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed.slice(0, MAX_FIELD_LENGTH);
}

function asInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/** Aceita as chaves hifenizadas do `report-uri` e as camelCase do Reporting API. */
function normalize(record: Record<string, unknown>): CspViolation {
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      if (key in record) return record[key];
    }
    return undefined;
  };
  return {
    effectiveDirective: asText(pick("effective-directive", "effectiveDirective")),
    violatedDirective: asText(pick("violated-directive", "violatedDirective")),
    blockedUri: asText(pick("blocked-uri", "blockedURL")),
    documentUri: asText(pick("document-uri", "documentURL")),
    sourceFile: asText(pick("source-file", "sourceFile")),
    lineNumber: asInteger(pick("line-number", "lineNumber")),
    columnNumber: asInteger(pick("column-number", "columnNumber")),
    disposition: asText(pick("disposition")),
    sample: asText(pick("script-sample", "sample")),
  };
}

/** Sem diretiva nem URL bloqueada não há violação a triar. */
function isViolation(violation: CspViolation): boolean {
  return Boolean(
    violation.effectiveDirective ?? violation.violatedDirective ?? violation.blockedUri,
  );
}

function reportingViolations(payload: unknown): Record<string, unknown>[] | null {
  // O Reporting API chega como array; o WebKit 26.5 envia um único objeto.
  const entries = Array.isArray(payload) ? payload : isRecord(payload) ? [payload] : null;
  if (!entries) return null;
  const violations: Record<string, unknown>[] = [];
  for (const entry of entries) {
    if (!isRecord(entry) || entry["type"] !== "csp-violation") continue;
    if (isRecord(entry["body"])) violations.push(entry["body"]);
  }
  return violations;
}

function recordsOf(payload: unknown): Record<string, unknown>[] | null {
  // A forma vence o media type: o WebKit envia o objeto do Reporting API sob
  // `application/csp-report` (o tipo legado), e recusá-lo fazia todo relatório
  // real do WebKit virar 400 e a coleta de DBT-112 ficar cega nessa engine.
  if (isRecord(payload)) {
    const legacy = payload["csp-report"];
    if (isRecord(legacy)) return [legacy];
  }
  return reportingViolations(payload);
}

export function parseCspReport(shape: CspReportShape, raw: string): CspReportParseResult {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }

  const records = recordsOf(payload);
  if (!records) return { ok: false, reason: "invalid_payload" };

  const violations = records.map(normalize).filter(isViolation);
  if (violations.length === 0) return { ok: false, reason: "invalid_payload" };

  return {
    ok: true,
    violations: violations.slice(0, CSP_REPORTS_PER_REQUEST_LIMIT),
    suppressed: Math.max(0, violations.length - CSP_REPORTS_PER_REQUEST_LIMIT),
  };
}
