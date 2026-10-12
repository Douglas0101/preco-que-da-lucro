/**
 * Política de warnings do build (`fail-closed`) — lógica pura extraída de
 * `scripts/build.mjs` para ser testável sem spawnar o vite.
 *
 * Regras preservadas (nada foi afrouxado):
 *  - toda linha não vazia de stderr do vite é candidata a warning; do stdout,
 *    apenas linhas com WARN/warning, `(!)` ou `deprecated`;
 *  - uma linha só é aceita com assinatura EXATA na allowlist, não expirada e
 *    com o canal de release permitido;
 *  - qualquer pendência (exit code != 0 ou warning não aceito) reprova o build.
 *
 * Incidente 2026-10-12 (DBT-109): o diagnóstico dinâmico `[PLUGIN_TIMINGS]` do
 * rolldown (tempos/contagens variam por build, irregistrável por assinatura
 * exata) derrubou a publicação de produção no cache frio. A correção foi na
 * origem — `checks.pluginTimings: false` em `vite.config.ts` — e este gate
 * permanece byte a byte o mesmo na sua semântica.
 */

export const stripAnsi = (value) => value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");

/**
 * Allowlist de warnings aceitos no build. Contrato por entrada:
 * `{ id, signature, owner, releaseChannels, expiresOn, recheckedAt }`.
 *
 * Vazia desde 2026-10-12: a única entrada (WARN-NITRO-001,
 * "inlineDynamicImports option is ignored because the codeSplitting option is
 * specified.") expirou em 2026-10-06 e o warning não se reproduz em nenhum
 * canal observado (build local de cache frio, CI e builds Vercel de
 * 2026-10-12) — re-verificada e removida conforme a política de expiração
 * (`docs/runbooks/cutover-A4.md:491`; emenda env-guard 2026-09-07).
 * Um warning novo exige entrada nova com dono, canal e expiração.
 */
export const warningAllowlist = [];

export function collectWarningLines({ stdout = "", stderr = "" } = {}) {
  const stderrLines = stripAnsi(stderr)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const stdoutWarningLines = stripAnsi(stdout)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        /(^|\s)WARN(?:ING)?(?:\s|$)/i.test(line) ||
        line.includes("(!)") ||
        /\bdeprecated\b/i.test(line),
    );
  return [...new Set([...stderrLines, ...stdoutWarningLines])];
}

export function classifyBuildWarnings(
  lines,
  { today, releaseChannel, allowlist = warningAllowlist },
) {
  return lines.map((line) => {
    const normalizedLine = line
      .replace(/^(?:\[(?:warn|warning)\]|WARN(?:ING)?|\(!\))\s*/i, "")
      .replaceAll("`", "")
      .trim();
    const exception = allowlist.find(({ signature }) => normalizedLine === signature);
    const expired = exception ? today > exception.expiresOn : false;
    const releaseAllowed = exception?.releaseChannels.includes(releaseChannel) ?? false;
    return {
      line,
      exceptionId: exception?.id ?? null,
      expired,
      releaseAllowed,
      accepted: Boolean(exception) && !expired && releaseAllowed,
    };
  });
}

export function evaluateBuild({
  exitCode,
  stdout = "",
  stderr = "",
  today = new Date().toISOString().slice(0, 10),
  releaseChannel = process.env.BUILD_RELEASE_CHANNEL ??
    (process.env.CI ? "unclassified-ci" : "local"),
  allowlist,
} = {}) {
  const observedWarnings = classifyBuildWarnings(collectWarningLines({ stdout, stderr }), {
    today,
    releaseChannel,
    ...(allowlist === undefined ? {} : { allowlist }),
  });
  const unexpectedWarnings = observedWarnings.filter(({ accepted }) => !accepted);
  return {
    today,
    releaseChannel,
    observedWarnings,
    unexpectedWarnings,
    passed: exitCode === 0 && unexpectedWarnings.length === 0,
  };
}
