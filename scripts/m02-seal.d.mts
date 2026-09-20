export interface SealClaim {
  ancestor: string;
  descendant: string;
}

export interface SealRun {
  databaseId?: number;
  headSha?: string;
  conclusion?: string;
  jobs?: Array<{ steps?: Array<{ name?: string; conclusion?: string }> }>;
}

export interface SealArgs {
  error?: string;
  dir?: string;
  write?: boolean;
  ancestry?: string;
  run?: string;
}

export declare function sha256(contents: string | Uint8Array): string;

export declare function parseArgs(argv: string[]): SealArgs;

export declare function discoverFiles(dir: string): string[];

export declare function scanSelo(dir: string): { files: string[]; problemas: string[] };

export declare function parseManifest(text: string): {
  entries: Map<string, string>;
  falhas: string[];
};

export declare function auditManifest(input: {
  discovered: string[];
  hashes: Map<string, string>;
  manifestText: string;
  required?: string[];
}): string[];

export declare function extractAncestryClaims(text: string): SealClaim[];

export declare function auditAncestry(
  text: string,
  opts: { runAncestor: (ancestor: string, descendant: string) => number },
): string[];

export declare function countApplicableSteps(run: SealRun): number;

export declare function auditRun(
  run: SealRun | null,
  opts: { commit: string; isAncestor: (ancestor: string, descendant: string) => boolean },
): string[];

export declare const MANIFEST: string;
export declare const REQUIRED_FILES: string[];
