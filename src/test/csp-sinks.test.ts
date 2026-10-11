import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderErrorPage } from "@/lib/error-page";

/**
 * Os três sinks de CSP observados em produção em 2026-10-08
 * (`docs/evidence/production-runtime-incident-2026-10-08/captures/browser-csp-report-only-violations.txt`),
 * sem tocar na política (`src/lib/security-headers.ts` continua congelada e
 * `src/test/security-headers.test.ts` é o contrato que prova isso).
 *
 * Cada teste abaixo falha se o sink voltar: são controle de regressão, não
 * verificação de que a violação some do relatório do browser — isso é medição
 * de soak em ambiente real.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

describe("sink 3 — página de erro catastrófica sem style/script inline", () => {
  it("T1: o HTML não contém bloco `<style>`", () => {
    const html = renderErrorPage();
    // `style-src 'self'`: um `<style>` no documento é `blockedURI: inline` e não
    // pode receber nonce nem hash (§20.1 não usa nonce).
    expect(html).not.toContain("<style");
    expect(html).not.toContain("</style>");
  });

  it("T2: o HTML não contém atributo de evento inline (`onclick=`)", () => {
    const html = renderErrorPage();
    // `script-src-attr`: um handler inline nunca pode ser nonced nem hasheado.
    expect(html).not.toContain("onclick=");
    expect(html).not.toMatch(/\son[a-z]+\s*=/);
    // Nenhum `<script>`: a página precisa funcionar mesmo se o bundle falhou.
    expect(html).not.toContain("<script");
  });

  it("T3: a aparência vem de folha estática servida pela própria origem", () => {
    const html = renderErrorPage();
    expect(html).toContain('<link rel="stylesheet" href="/error-page.css" />');
    // A folha anunciada existe de fato — um `href` órfão deixaria a página sem
    // estilo sem violar nada, que é o pior dos dois mundos.
    expect(existsSync(resolve(root, "public/error-page.css"))).toBe(true);
    const css = read("public/error-page.css");
    expect(css).toContain(".card");
    expect(css).not.toContain("<style");
  });

  it("T4: 'try again' recarrega sem JavaScript — `href` vazio resolve para o documento atual", () => {
    const html = renderErrorPage();
    expect(html).toContain('<a class="primary" href="">Try again</a>');
    expect(html).toContain('<a class="secondary" href="/">Go home</a>');
  });
});

describe("sink 1 — zod em modo jitless", () => {
  it("T5: o módulo de entrada aplica `z.config({ jitless: true })`", async () => {
    await import("@/lib/csp/zod-jitless");
    const { z } = await import("zod");
    // Observável público: `z.config()` devolve o `globalConfig` compartilhado.
    // Sem a chamada, `jitless` é `undefined` — o teste falha.
    expect(z.config().jitless).toBe(true);
  });

  it("T6: o router entry importa o módulo ANTES da árvore de rotas", () => {
    const source = read("src/router.tsx");
    const jitless = source.indexOf('from "./lib/csp/zod-jitless"');
    expect(jitless).toBeGreaterThanOrEqual(0);
    // `allowsEval` é um `cached(...)` lido no `init` do primeiro `z.object()`:
    // se o route tree for avaliado antes, a sonda de `new Function("")` já
    // aconteceu e a flag não tem efeito.
    expect(jitless).toBeLessThan(source.indexOf('from "./routeTree.gen"'));
    // O binding precisa ser *usado*: a raiz declara `sideEffects: false`, e uma
    // importação por efeito colateral pura é derrubada pelo bundler — a chamada
    // sumiria do grafo sem erro de build.
    expect(source).toContain("disableZodJitForCsp();");
  });

  it("T7: o servidor carrega o router entry antes de servir qualquer resposta", () => {
    // O ponto de entrada do servidor monta o handler do Start sob demanda; o
    // handler carrega `#tanstack-router-entry` (= `src/router.tsx`, onde a flag
    // é aplicada) em `loadEntries()`, antes da primeira resposta. A flag é
    // global (`globalThis.__zod_globalConfig`), então vale para as validações
    // de request — inclusive nos server functions.
    const source = read("src/server.ts");
    expect(source).toContain('import("@tanstack/react-start/server-entry")');
    expect(source).toContain('from "./lib/security-headers"');
  });
});

describe("sink 2 — folha estática do sonner", () => {
  it("T8: a folha do app importa o CSS público do sonner", () => {
    const styles = read("src/styles.css");
    expect(styles).toContain('@import "sonner/dist/styles.css"');
  });

  it("T9: o caminho importado existe no disco e é o CSS real do sonner", () => {
    const sonnerCss = resolve(root, "node_modules/sonner/dist/styles.css");
    expect(existsSync(sonnerCss)).toBe(true);
    const css = readFileSync(sonnerCss, "utf8");
    // O seletor que dá identidade ao componente: um stub vazio passaria pelo
    // teste T8 mas não estilizaria nada.
    expect(css).toContain("[data-sonner-toaster]");
  });

  it("T10: o CSS estático declara as MESMAS regras que o runtime injeta", () => {
    // A promessa da opção (a) só se sustenta se as duas listas coincidirem: se o
    // pacote publicasse um stylesheet divergente, a injeção deixaria de ser
    // redundante e os toasts mudariam de aparência quando a política passar a
    // bloquear o `<style>` inline.
    const mjs = readFileSync(resolve(root, "node_modules/sonner/dist/index.mjs"), "utf8");
    const match = mjs.match(/__insertCSS\("([\s\S]*?)"\);/);
    expect(match).not.toBeNull();
    const injected = (match as RegExpMatchArray)[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\\\/g, "\\");
    const published = readFileSync(resolve(root, "node_modules/sonner/dist/styles.css"), "utf8");

    /**
     * O stylesheet publicado é formatado e o payload injetado sai minificado:
     * a comparação normaliza o que é só sintaxe (espaço, aspas de valor de
     * atributo) e as reescritas equivalentes do minificador
     * (`:first-child` ≡ `:nth-child(1)`).
     */
    const normalizeSelector = (selector: string): string =>
      selector
        .trim()
        .replace(/\s+/g, "")
        .replace(/'/g, "")
        .replace(/:first-child/g, ":nth-child(1)")
        .replace(/:last-child/g, ":nth-last-child(1)");

    /** `seletor (normalizado) → declarações (normalizadas)`, uma entrada por seletor. */
    const rulesOf = (css: string): Map<string, string> => {
      const out = new Map<string, string>();
      const block = /([^{}]+)\{([^{}]*)\}/g;
      let found: RegExpExecArray | null;
      while ((found = block.exec(css)) !== null) {
        const prelude = found[1].trim();
        if (prelude.startsWith("@")) continue; // @media/@keyframes: prelúdio, não seletor
        const declarations = found[2]
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/\s+/g, "")
          .replace(/;$/, "");
        for (const selector of prelude.split(",")) {
          out.set(normalizeSelector(selector), declarations);
        }
      }
      return out;
    };

    const injectedRules = rulesOf(injected);
    const publishedRules = rulesOf(published);
    expect(publishedRules.size).toBeGreaterThan(0);
    expect(injectedRules.size).toBeGreaterThan(0);
    // Mesmo conjunto de regras…
    expect([...publishedRules.keys()].sort()).toEqual([...injectedRules.keys()].sort());
    // …e, dentro de cada regra, as mesmas propriedades declaradas. A igualdade
    // é de CONTEÚDO, não de bytes: o payload injetado sai do build do pacote
    // minificado, então valores equivalentes aparecem com outra grafia
    // (`-.1s` × `-0.1s`, `.5s` × `500ms`) e o minificador reescreve
    // `:first-child` como `:nth-child(1)`.
    for (const [selector, declarations] of publishedRules) {
      expect(injectedRules.get(selector)).toBeDefined();
      const propertiesOf = (block: string): string[] =>
        block
          .split(";")
          .map((declaration) => declaration.split(":")[0])
          .filter((property) => property.length > 0)
          .sort();
      expect(propertiesOf(declarations)).toEqual(propertiesOf(injectedRules.get(selector) ?? ""));
    }
  });
});
