/** Coupled dependencies are checked from resolved lock entries, including nested copies. */
export interface LockedPackage {
  version?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function version(entry: unknown): string | null {
  const value = object(entry)?.version;
  return typeof value === "string" && /^\d+\.\d+\.\d+(?:[-+].*)?$/.test(value) ? value : null;
}

/** Missing or unreadable input is a finding; package ranges do not establish pair compatibility. */
export function auditDependencyFamilies(
  lock: unknown,
  declaredSpecs: Readonly<Record<string, string>> = {},
): string[] {
  const packages = object(object(lock)?.packages);
  if (packages === null || Object.keys(packages).length === 0)
    return ["dependency families: lock packages ausentes ou vazios"];
  const findings: string[] = [];
  const get = (name: string) => version(packages[`node_modules/${name}`]);
  const required = (name: string): string | null => {
    const value = get(name);
    if (value === null) findings.push(`${name}: versão resolvida ausente ou ilegível`);
    return value;
  };
  const applies = (names: string[]) =>
    names.some(
      (name) =>
        Object.hasOwn(declaredSpecs, name) || Object.hasOwn(packages, `node_modules/${name}`),
    );

  if (applies(["react", "react-dom", "@types/react", "@types/react-dom"])) {
    const react = required("react");
    const dom = required("react-dom");
    if (react !== null && dom !== null && react !== dom)
      findings.push(`react ${react} != react-dom ${dom}: runtimes exigem versão exata igual`);
    const types = [required("@types/react"), required("@types/react-dom")];
    if (react !== null) {
      const line = react.split(".").slice(0, 2).join(".");
      for (const [index, value] of types.entries()) {
        if (value !== null && value.split(".").slice(0, 2).join(".") !== line)
          findings.push(
            `${index === 0 ? "@types/react" : "@types/react-dom"} ${value}: linha major.minor difere do runtime react ${react}`,
          );
      }
    }
  }

  const tanstackRoots = [
    "@tanstack/react-router",
    "@tanstack/react-start",
    "@tanstack/router-plugin",
    "@tanstack/router-core",
  ];
  if (applies(tanstackRoots)) {
    const resolved = new Map(tanstackRoots.map((name) => [name, required(name)]));
    const shared = ["@tanstack/react-router", "@tanstack/router-core"];
    for (const [path, raw] of Object.entries(packages)) {
      const entry = object(raw);
      for (const name of shared) {
        const rootVersion = resolved.get(name);
        if (!rootVersion) continue;
        if (path.endsWith(`/node_modules/${name}`) && path !== `node_modules/${name}`) {
          const nested = version(raw);
          if (nested !== rootVersion)
            findings.push(`${path}: cópia ${nested ?? "ilegível"} diverge da raiz ${rootVersion}`);
        }
        if (!path.includes("node_modules/@tanstack/")) continue;
        const declared = object(entry?.dependencies)?.[name];
        // Published TanStack packages pin these two shared contracts exactly. Broader peer
        // ranges are not equated with exact pins; all actual nested resolutions are still checked.
        if (
          typeof declared === "string" &&
          /^\d+\.\d+\.\d+$/.test(declared) &&
          declared !== rootVersion
        )
          findings.push(`${path} exige ${name} ${declared}, raiz resolve ${rootVersion}`);
      }
    }
    const startDeps = object(object(packages["node_modules/@tanstack/react-start"])?.dependencies);
    const pluginDeps = object(
      object(packages["node_modules/@tanstack/router-plugin"])?.dependencies,
    );
    if (typeof startDeps?.["@tanstack/react-router"] !== "string")
      findings.push("react-start: contrato declarado com react-router ausente");
    if (typeof pluginDeps?.["@tanstack/router-core"] !== "string")
      findings.push("router-plugin: contrato declarado com router-core ausente");
  }
  return findings;
}
