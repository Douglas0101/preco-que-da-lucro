// Extraído de src/start.ts para quebrar um ciclo de módulos no SSR:
// src/server.ts importava deste arquivo, que executa createStart() no escopo do módulo,
// o que fazia o binding `ssr_exports` desaparecer em runtime (ver docs/evidence/p0-port-2026-09-13.md §7).
// §20.1 — canal de coleta das violações. `report-uri` é o canal legado
// (`application/csp-report`), aceito por todos os motores; `report-to` usa o
// grupo declarado em `reporting-endpoints` (Reporting API,
// `application/reports+json`). Nenhuma fonte (`*-src`) é afetada por eles.
const CSP_REPORT_PATH = "/api/csp-report";
const CSP_REPORT_GROUP = "csp-endpoint";

export function securityHeaders(): Record<string, string> {
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "style-src 'self'",
    "script-src 'self'",
    "connect-src 'self' https:",
    `report-uri ${CSP_REPORT_PATH}`,
    `report-to ${CSP_REPORT_GROUP}`,
  ].join("; ");
  const headers: Record<string, string> = {
    "content-security-policy-report-only": csp,
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-content-type-options": "nosniff",
    "reporting-endpoints": `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`,
  };
  if (process.env.CSP_ENFORCE === "true") {
    delete headers["content-security-policy-report-only"];
    headers["content-security-policy"] = csp;
  }
  if (process.env.NODE_ENV === "production") {
    headers["strict-transport-security"] = "max-age=31536000; includeSubDomains";
  }
  return headers;
}
