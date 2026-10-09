export interface MainUnit {
  file: string;
  line: number;
  branch?: string;
  covered: boolean;
}
export interface MainSnapshot {
  mainSha: string;
  analysisId: string;
  observedAt: string;
  instrumentation: string;
  total: number;
  covered: number;
  floor: number;
  sourceHashes: Record<string, string>;
  units: MainUnit[];
}
export interface CandidateIdentity {
  mainSha: string;
  analysisId: string;
  instrumentation: string;
  sourceHashes: Record<string, string>;
  now: string;
}
export const unitId = (u: MainUnit) => `${u.file}:${u.line}:${u.branch ?? "line"}`;
const integer = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0;

export function authoritativeUnits(metrics: Record<string, number | null>) {
  const names = [
    "new_lines_to_cover",
    "new_uncovered_lines",
    "new_conditions_to_cover",
    "new_uncovered_conditions",
  ];
  for (const name of names)
    if (!integer(metrics[name])) throw new Error(`missing unit metric: ${name}`);
  const lines = metrics.new_lines_to_cover!;
  const branches = metrics.new_conditions_to_cover!;
  if (
    metrics.new_uncovered_lines! > lines ||
    metrics.new_uncovered_conditions! > branches ||
    lines + branches === 0
  )
    throw new Error("empty/inconsistent unit denominator");
  const total = lines + branches;
  const covered = total - metrics.new_uncovered_lines! - metrics.new_uncovered_conditions!;
  const exactCoverage = (100 * covered) / total;
  if (metrics.new_coverage == null || Math.abs(metrics.new_coverage - exactCoverage) > 0.11)
    throw new Error("Sonar percentage differs from the authoritative unit count");
  return {
    total,
    covered,
    coverage: exactCoverage,
    gap: Math.max(0, Math.ceil(0.8 * total) - covered),
    floor: Math.ceil(0.5 * total),
  };
}

export function lcovUnits(lcov: string): Map<string, boolean | null> {
  if (!lcov.trim()) throw new Error("empty LCOV");
  const units = new Map<string, boolean | null>();
  let file: string | undefined;
  let completed = 0;
  const add = (id: string, value: boolean | null) => {
    if (units.has(id)) throw new Error("duplicate LCOV unit");
    units.set(id, value);
  };
  for (const row of lcov.trim().split(/\r?\n/)) {
    if (row.startsWith("SF:")) {
      if (file) throw new Error("unterminated LCOV record");
      file = row.slice(3);
    } else if (row === "end_of_record") {
      if (!file) throw new Error("LCOV record has no source");
      file = undefined;
      completed++;
    } else if (row.startsWith("DA:") || row.startsWith("BRDA:")) {
      if (!file) throw new Error("LCOV unit has no source");
      const parts = row.slice(row.indexOf(":") + 1).split(",");
      const line = Number(parts[0]);
      if (!Number.isInteger(line) || line < 1) throw new Error("invalid LCOV line");
      if (row.startsWith("DA:")) {
        if (parts.length < 2 || !/^\d+$/.test(parts[1])) throw new Error("invalid line hit count");
        add(`${file}:${line}:line`, Number(parts[1]) > 0);
      } else {
        if (
          parts.length !== 4 ||
          !/^\d+$/.test(parts[1]) ||
          !/^\d+$/.test(parts[2]) ||
          !/^(\d+|-)$/.test(parts[3])
        )
          throw new Error("invalid branch identity/hit count");
        add(
          `${file}:${line}:${parts[1]},${parts[2]}`,
          parts[3] === "-" ? null : Number(parts[3]) > 0,
        );
      }
    }
  }
  if (file || completed === 0 || units.size === 0) throw new Error("incomplete LCOV");
  return units;
}

/**
 * Estado do LCOV para uma unidade de LINHA sob a regra medida do importador
 * (AGENTS.md/DBT-101): o valor do DA existente prevalece e a contribuição de branch
 * é fallback apenas para linha sem DA (teste oficial
 * conditions_on_non_executable_lines + audit.repository.ts 28-30 no provedor).
 * `undefined` = a linha não tem nenhuma identidade no LCOV.
 */
export function lineState(
  units: Map<string, boolean | null>,
  file: string,
  line: number,
): boolean | undefined {
  const lineId = `${file}:${line}:line`;
  if (units.has(lineId)) return units.get(lineId) === true;
  const prefix = `${file}:${line}:`;
  let declared = false,
    covered = false;
  for (const [id, value] of units)
    if (id !== lineId && id.startsWith(prefix)) {
      declared = true;
      if (value === true) covered = true;
    }
  return declared ? covered : undefined;
}

export function mirror(
  snapshot: MainSnapshot,
  baseline: string,
  candidate: string,
  current: CandidateIdentity,
) {
  if (!/^[a-f0-9]{40}$/.test(snapshot.mainSha) || !snapshot.analysisId || !snapshot.instrumentation)
    throw new Error("missing snapshot identity");
  for (const key of ["mainSha", "analysisId", "instrumentation"] as const)
    if (snapshot[key] !== current[key]) throw new Error(`snapshot identity changed: ${key}`);
  const age = Date.parse(current.now) - Date.parse(snapshot.observedAt);
  if (!Number.isFinite(age) || age < 0 || age > 30 * 60 * 1000)
    throw new Error("stale/unreadable snapshot time");
  if (
    !integer(snapshot.total) ||
    snapshot.total === 0 ||
    !integer(snapshot.covered) ||
    snapshot.covered > snapshot.total ||
    !integer(snapshot.floor) ||
    snapshot.floor === 0 ||
    snapshot.total < snapshot.floor
  )
    throw new Error("invalid denominator/anti-empty-window floor");
  if (!Array.isArray(snapshot.units) || snapshot.units.length !== snapshot.total)
    throw new Error("unit discovery differs from the authoritative denominator");
  const before = lcovUnits(baseline),
    after = lcovUnits(candidate);
  const seen = new Set<string>();
  const paid: string[] = [],
    lost: string[] = [];
  let baselineCovered = 0;
  for (const unit of snapshot.units) {
    if (
      !new RegExp("^src/(?!test/)[A-Za-z0-9_$./-]+\\.(?:ts|tsx|js|jsx)$").test(unit.file) ||
      unit.file.includes("..") ||
      !Number.isInteger(unit.line) ||
      unit.line < 1 ||
      typeof unit.covered !== "boolean" ||
      (unit.branch !== undefined && !/^\d+,\d+$/.test(unit.branch))
    )
      throw new Error("invalid/unmapped eligible unit");
    const sourceHash = snapshot.sourceHashes[unit.file];
    if (!/^[a-f0-9]{64}$/.test(sourceHash ?? "") || sourceHash !== current.sourceHashes[unit.file])
      throw new Error(`source mapping unavailable: ${unit.file}`);
    const id = unitId(unit);
    if (seen.has(id)) throw new Error("duplicated eligible unit");
    seen.add(id);
    // Medido no lcov real (auth-policy.ts 116/117/192): o v8 emite BRDA sem DA para
    // linhas que o Sonar conta como executáveis — para unidade já não coberta, ausência
    // de DA é estado natural (sem crédito). Perda medida (false) contabiliza como lost;
    // dados ausentes em unidade coberta e branch desconhecido ('-') continuam reprovando.
    const uncoveredLine = unit.branch === undefined && !unit.covered;
    const beforeState =
        unit.branch === undefined ? lineState(before, unit.file, unit.line) : before.get(id),
      afterState =
        unit.branch === undefined ? lineState(after, unit.file, unit.line) : after.get(id);
    if (
      (beforeState !== unit.covered && !(uncoveredLine && beforeState === undefined)) ||
      (typeof afterState !== "boolean" && !(uncoveredLine && afterState === undefined))
    )
      throw new Error(`coverage mapping unavailable: ${id}`);
    baselineCovered += Number(unit.covered);
    if (!unit.covered && afterState === true) paid.push(id);
    if (unit.covered && afterState === false) lost.push(id);
  }
  if (baselineCovered !== snapshot.covered)
    throw new Error("baseline numerator disagrees with Sonar");
  const covered = snapshot.covered + paid.length - lost.length;
  return {
    total: snapshot.total,
    covered,
    paid,
    lost,
    coverage: (100 * covered) / snapshot.total,
    gap: Math.max(0, Math.ceil(0.8 * snapshot.total) - covered),
    pass: 5 * covered >= 4 * snapshot.total,
  };
}
