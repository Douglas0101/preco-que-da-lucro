export declare const stripAnsi: (value: string) => string;

export interface BuildWarningAllowlistEntry {
  id: string;
  signature: string;
  owner: string;
  releaseChannels: string[];
  expiresOn: string;
  recheckedAt: string;
}

export interface ObservedBuildWarning {
  line: string;
  exceptionId: string | null;
  expired: boolean;
  releaseAllowed: boolean;
  accepted: boolean;
}

export interface BuildEvaluation {
  today: string;
  releaseChannel: string;
  observedWarnings: ObservedBuildWarning[];
  unexpectedWarnings: ObservedBuildWarning[];
  passed: boolean;
}

export declare const warningAllowlist: BuildWarningAllowlistEntry[];

export declare function collectWarningLines(input?: { stdout?: string; stderr?: string }): string[];

export declare function classifyBuildWarnings(
  lines: string[],
  options: { today: string; releaseChannel: string; allowlist?: BuildWarningAllowlistEntry[] },
): ObservedBuildWarning[];

export declare function evaluateBuild(input: {
  exitCode: number;
  stdout?: string;
  stderr?: string;
  today?: string;
  releaseChannel?: string;
  allowlist?: BuildWarningAllowlistEntry[];
}): BuildEvaluation;
