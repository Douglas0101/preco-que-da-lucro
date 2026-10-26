// Paridade comportamental de `cn` e trava contra a volta silenciosa da
// combinação pesada.
//
// POR QUE ESTE ARQUIVO EXISTE
// `src/lib/utils.ts:1` reexporta `cn` do pacote externo `shadcn-ui/cn@0.4.0`
// (MIT). A medição de 2026-10 (commit `5a5f1b2`) trocou `clsx` + `tailwind-merge`
// por esse pacote e mediu **apenas tamanho** (chunk do botão 38.710 → 39.786 B).
// Tamanho é um proxy de custo, não de comportamento: nada no repositório
// provava que a troca preservou a semântica de classes que a UI consome.
//
// Este arquivo fecha os dois lados:
//   1. CARACTERIZAÇÃO — fixa o comportamento observável do `cn` real (a
//      dependência instalada), sem reimplementar o algoritmo: o que é fixado
//      é a saída observada, e uma mudança no pacote que a altere reprova.
//   2. TRAVA DE REGRESSÃO — reprova se `clsx` ou `tailwind-merge` voltarem a
//      ser dependências DIRETAS (que é como a combinação pesada voltaria), e
//      confirma que `cn` está presente e reprodutível (lockfile com versão
//      exata e `integrity`).
//
// A trava olha `dependencies`/`devDependencies` do `package.json`, NÃO o mapa de
// pacotes do lockfile: `clsx` continua no lockfile como dependência TRANSITIVA
// de `class-variance-authority` (`node_modules/class-variance-authority` ->
// `clsx: ^2.1.1`) e essa presença é legítima e não é o que a auditoria mediu.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

interface PackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface LockManifest {
  lockfileVersion?: number;
  packages?: Record<string, { version?: string; integrity?: string; resolved?: string }>;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(resolve(root, relativePath), "utf8")) as T;
}

const pkg = readJson<PackageManifest>("package.json");
const lock = readJson<LockManifest>("package-lock.json");

/** Um pacote é dependência DIRETA se está em qualquer mapa do `package.json`. */
function directDependencies(manifest: PackageManifest): Record<string, string> {
  return {
    ...(manifest.dependencies ?? {}),
    ...(manifest.devDependencies ?? {}),
    ...(manifest.peerDependencies ?? {}),
    ...(manifest.optionalDependencies ?? {}),
  };
}

describe("cn — contrato observável que a UI consome", () => {
  it("resolve conflito Tailwind: o último vence e a ordem do restante é preservada", () => {
    // A ordem importa: a classe sobrevivente continua na posição em que a
    // sobrescrita substituiu a anterior, e as não conflitantes ficam onde
    // estavam. Um merge que reordenasse classes mudaria a especificidade
    // herdada do Tailwind e o resultado visual.
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("block", "inline-block")).toBe("inline-block");
    expect(cn("m-1", "m-2", "m-3")).toBe("m-3");
  });

  it("resolve conflito de cor e de display mantendo a classe vencedora uma vez só", () => {
    const resultado = cn("bg-red-500 text-white", "bg-blue-500");
    expect(resultado).toBe("text-white bg-blue-500");
    expect(resultado).toContain("bg-blue-500");
    expect(resultado).not.toContain("bg-red-500");
  });

  it("preserva a hierarquia de especificidade entre prefixos e eixos", () => {
    // `px-2` e `p-4` não são o mesmo eixo: `p-4` remove `px-2`, mas `px-4`
    // convive com `p-2` (o eixo mais específico sobrevive ao mais largo).
    // Se a combinação pesada fosse restaurada com semântica diferente, estas
    // duas asserções mudariam de resultado.
    expect(cn("px-2", "p-4")).toBe("p-4");
    expect(cn("p-2", "px-4")).toBe("p-2 px-4");
  });

  it("descarta valores falsos, vazios e indefinidos sem deixar resíduo", () => {
    expect(cn("foo", false)).toBe("foo");
    expect(cn("foo", undefined)).toBe("foo");
    expect(cn("foo", null)).toBe("foo");
    expect(cn("foo", "")).toBe("foo");
    expect(cn("foo", [])).toBe("foo");
    expect(cn(undefined, null, false, "")).toBe("");
    expect(cn()).toBe("");
  });

  it("achata arrays e emite chaves de objeto (semântica herdada de `clsx`)", () => {
    expect(cn("foo", ["bar", "baz"])).toBe("foo bar baz");
    expect(cn(["a", ["b", ["c"]]])).toBe("a b c");
    expect(cn({ a: "b" })).toBe("a");
  });

  it("não deduplica classes iguais", () => {
    // Deduplicação mudaria a string de classes emitida (e portanto o HTML
    // renderizado). Ficar explícito evita que alguém "otimize" isso sem
    // perceber que alterou a saída.
    expect(cn("a", "a")).toBe("a a");
  });

  it("aplica o merge também em variantes com prefixo", () => {
    expect(cn("hover:px-2", "hover:px-4")).toBe("hover:px-4");
  });
});

describe("trava de regressão: a combinação pesada não volta", () => {
  it("`clsx` e `tailwind-merge` não são dependências diretas", () => {
    const diretas = directDependencies(pkg);
    expect(diretas).not.toHaveProperty("clsx");
    expect(diretas).not.toHaveProperty("tailwind-merge");
  });

  it("`cn` é dependência direta de produção", () => {
    expect(pkg.dependencies).toHaveProperty("cn");
    expect(pkg.dependencies?.["cn"]).toBeTypeOf("string");
  });

  it("`cn` está reprodutível: faixa coerente no manifesto e versão exata no lockfile", () => {
    const range = pkg.dependencies?.["cn"] ?? "";
    // A faixa declarada tem de permitir a versão que o lockfile fixa — sem
    // isto, `npm ci` instalaria uma versão que a faixa não descreve.
    const fixada = lock.packages?.["node_modules/cn"]?.version ?? "";
    expect(fixada).not.toBe("");
    expect(range).not.toBe("");
    const piso = range.replace(/^[\^~]/, "").split(".")[0] ?? "";
    expect(fixada.split(".")[0]).toBe(piso);
    // Reprodutibilidade: o lockfile carrega `integrity` (sha512) e `resolved`.
    const entrada = lock.packages?.["node_modules/cn"];
    expect(entrada?.integrity).toMatch(/^sha512-/);
    expect(entrada?.resolved).toMatch(/registry\.npmjs\.org\/cn\//);
  });

  it("o `cn` instalado é o pacote externo real (não uma reimplementação local)", () => {
    // `src/lib/utils.ts` reexporta o pacote; se um dia alguém escrever a
    // própria implementação local, o comportamento deixaria de ser o do
    // `shadcn-ui/cn` e a caracterização acima passaria a medir outra coisa.
    const utils = readFileSync(resolve(root, "src/lib/utils.ts"), "utf8");
    expect(utils).toContain('from "cn"');
    expect(utils).not.toContain("clsx");
    expect(utils).not.toContain("tailwind-merge");
  });
});
