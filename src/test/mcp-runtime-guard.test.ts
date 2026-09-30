// Guarda do runtime de MCP: as regras que impedem o mecanismo do DBT-32
// (runner sem pin resolvendo o projeto dentro de um checkout) e a regra de
// contencao que impede a guarda de virar ela propria um vazamento.
//
// Por que este arquivo existe: o incidente de 2026-09-28/29 nao foi um bug de
// codigo — foi um PADRAO de linha de configuracao fora do repositorio. Um gate
// que so olha o que o repositorio ja continha nao pega isso. Os testes abaixo
// plantam o texto real do incidente e exigem que a guarda reprove, e plantam a
// correcao e exigem que ela aprove: medir, nao so aprovar.
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  REPO_CATALOG,
  auditJsonConfig,
  auditSites,
  auditYamlText,
  fingerprint,
  insideWorkTree,
  isPinned,
  looksLikeLiteralSecret,
  runnerSpecifier,
} from "../../scripts/mcp-runtime-guard";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Diretorio temporario proprio por teste: estado de repo nunca e compartilhado. */
function bench(): string {
  return mkdtempSync(join(tmpdir(), "mcp-runtime-guard-"));
}

function jsonConfig(mcpServers: unknown): string {
  return JSON.stringify({ mcpServers }, null, 2);
}

function run(raw: string, cwdGuard = true) {
  return auditJsonConfig({ label: "fixture.json", raw, cwdGuard });
}

describe("runnerSpecifier", () => {
  it("reconhece as formas de runner e ignora as que nao sao", () => {
    expect(runnerSpecifier("npx", ["-y", "@playwright/mcp@latest"])).toBe("@playwright/mcp@latest");
    expect(runnerSpecifier("npm", ["exec", "-y", "chrome-devtools-mcp@latest"])).toBe(
      "chrome-devtools-mcp@latest",
    );
    expect(runnerSpecifier("pnpm", ["dlx", "pkg@1.0.0"])).toBe("pkg@1.0.0");
    expect(runnerSpecifier("bun", ["x", "pkg@1.0.0"])).toBe("pkg@1.0.0");
    // Nao-runner: `null` (diferente de "runner sem especificador", que e "").
    expect(runnerSpecifier("docker", ["mcp", "gateway", "run"])).toBeNull();
    expect(runnerSpecifier("/usr/bin/mcp-remote", ["https://x/mcp"])).toBeNull();
    expect(runnerSpecifier(undefined)).toBeNull();
    // Runner sem especificador nenhum: string vazia, que nao e pin.
    expect(runnerSpecifier("npx", ["-y"])).toBe("");
  });
});

describe("isPinned", () => {
  it("so aceita versao exata", () => {
    expect(isPinned("pkg@1.2.3")).toBe(true);
    expect(isPinned("@scope/pkg@1.2.3")).toBe(true);
    expect(isPinned("pkg@1.2.3-beta.1")).toBe(true);
    // As quatro formas que NAO sao pin — cada uma por um motivo distinto.
    expect(isPinned("@playwright/mcp@latest")).toBe(false);
    expect(isPinned("pkg")).toBe(false); // sem versao
    expect(isPinned("@playwright/mcp")).toBe(false); // escopo sem versao
    expect(isPinned("pkg@^1.2.3")).toBe(false); // faixa
    expect(isPinned("pkg@1.2.*")).toBe(false); // curinga
    expect(isPinned("")).toBe(false);
  });
});

describe("insideWorkTree", () => {
  it("distingue dentro de fora de uma arvore de trabalho", () => {
    const base = bench();
    const repo = join(base, "checkout");
    const inside = join(repo, "sub");
    mkdirSync(inside, { recursive: true });
    expect(insideWorkTree(inside)).toBe(false); // ainda sem .git

    mkdirSync(join(inside, ".git"), { recursive: true });
    expect(insideWorkTree(inside)).toBe(true);
    // A subarvore herda: e exatamente por isso que um runtime colocado dentro
    // de qualquer checkout e o defeito.
    expect(insideWorkTree(join(inside, "deep", "deeper"))).toBe(true);
    expect(insideWorkTree(base)).toBe(false);
  });
});

describe("linhas de config MCP — runner sem pin", () => {
  it("reprova a linha real do incidente: npx @latest sem cwd", () => {
    const { findings } = run(
      jsonConfig({
        playwright: {
          command: "npx",
          args: ["-y", "@playwright/mcp@latest", "--isolated"],
        },
      }),
    );
    expect(findings).toHaveLength(2);
    expect(findings[0]).toContain("sem pin (@playwright/mcp@latest)");
    expect(findings[1]).toContain("sem `cwd`");
  });

  it("aprova a mesma linha quando ela e pinada e tem runtime fora de checkout", () => {
    const runtime = join(bench(), "runtime");
    mkdirSync(runtime, { recursive: true });
    const { findings, preconditions } = run(
      jsonConfig({
        playwright: {
          command: "npx",
          args: ["-y", "@playwright/mcp@0.0.83", "--isolated"],
          cwd: runtime,
        },
      }),
    );
    expect(findings).toEqual([]);
    expect(preconditions).toEqual([]);
  });

  it("reprova cwd apontando para dentro de uma arvore de trabalho git", () => {
    const checkout = join(bench(), "repo");
    const runtime = join(checkout, "node_modules", ".runtime");
    mkdirSync(runtime, { recursive: true });
    mkdirSync(join(checkout, ".git"), { recursive: true });
    const { findings } = run(
      jsonConfig({ svc: { command: "npx", args: ["-y", "pkg@1.0.0"], cwd: runtime } }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain("dentro de uma arvore de trabalho git");
  });

  it("reprova caminho relativo como comando", () => {
    const { findings } = run(jsonConfig({ svc: { command: "./bin/mcp-server", args: [] } }));
    expect(findings).toEqual([
      "fixture.json: linha `svc` usa caminho relativo como comando (./bin/mcp-server)",
    ]);
  });

  it("nao audita o que nao executa processo local", () => {
    const { findings, preconditions } = run(
      jsonConfig({
        context7: { url: "https://mcp.context7.com/mcp" },
        neon: { transport: "http", url: "https://mcp.neon.tech/mcp", auth: "oauth" },
      }),
    );
    expect(findings).toEqual([]);
    expect(preconditions).toEqual([]);
  });

  it("reprova linha que nao e objeto, sem virar excecao", () => {
    const { findings } = run(jsonConfig({ quebrada: "npx -y pkg@latest" }));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain("nao e um objeto");
  });
});

describe("contencao: nenhum valor de segredo sai no achado", () => {
  const SECRET = "github_pat_11ABCDEFG0abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOP";

  it("acusa o segredo literal citando so nome, tamanho e fingerprint", () => {
    const { findings } = run(
      jsonConfig({
        github: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github@latest"],
          cwd: bench(),
          env: { GITHUB_PERSONAL_ACCESS_TOKEN: SECRET },
        },
      }),
    );
    const texto = findings.join("\n");
    expect(texto).toContain("GITHUB_PERSONAL_ACCESS_TOKEN");
    expect(texto).toContain(`${SECRET.length} bytes`);
    expect(texto).toContain(`sha256:`);
    // A propriedade que faz desta guarda uma guarda e nao um vetor: o valor
    // nunca aparece na saida — nem inteiro, nem recortado.
    expect(texto).not.toContain(SECRET);
    expect(texto).not.toContain(SECRET.slice(0, 12));
    expect(texto).toContain(fingerprint(SECRET));
  });

  it("nao acusa placeholder de ambiente, valor curto nem URL", () => {
    const { findings } = run(
      jsonConfig({
        a: { command: "/bin/true", env: { TOKEN: "${GITHUB_TOKEN}" } },
        b: { command: "/bin/true", env: { TOKEN: "curto" } },
        c: { command: "/bin/true", env: { BASE: "https://mcp.example.com/mcp" } },
      }),
    );
    expect(findings).toEqual([]);
  });

  it("a heuristica de segredo decide pelos casos que importam", () => {
    expect(looksLikeLiteralSecret(SECRET)).toBe(true);
    expect(looksLikeLiteralSecret("github_pat_x")).toBe(true); // prefixo conhecido vence o tamanho
    expect(looksLikeLiteralSecret("sk-abc")).toBe(true);
    expect(looksLikeLiteralSecret(`${"Ab3".repeat(10)}`)).toBe(true); // 30 chars, 3 classes
    expect(looksLikeLiteralSecret("somente-minusculas-mas-bem-comprido")).toBe(false);
    expect(looksLikeLiteralSecret("${VAR}")).toBe(false);
    expect(looksLikeLiteralSecret(null)).toBe(false);
  });
});

describe("fail-closed: precondicao nao e aprovacao", () => {
  it("mcpServers vazio vira precondicao, nunca 'limpo'", () => {
    const { findings, preconditions } = run(jsonConfig({}));
    expect(findings).toEqual([]);
    expect(preconditions).toHaveLength(1);
    expect(preconditions[0]).toContain("nada a auditar");
  });

  it("sem o mapa mcpServers vira precondicao", () => {
    const { preconditions } = run(JSON.stringify({ servidores: {} }));
    expect(preconditions).toHaveLength(1);
    expect(preconditions[0]).toContain("sem o mapa");
  });

  it("JSON ilegivel vira precondicao, nao excecao", () => {
    const { findings, preconditions } = run("{ isso nao e json");
    expect(findings).toEqual([]);
    expect(preconditions).toHaveLength(1);
    expect(preconditions[0]).toContain("JSON ilegivel");
  });
});

describe("lancador YAML", () => {
  it("reprova runner com @latest e sem cwd — e para de reprovar quando o ciclo 13 corrige", () => {
    const antes = [
      "servers:",
      "  - name: Vercel",
      "    command: npx",
      "    args: [-y, mcp-remote@latest, https://mcp.vercel.com]",
    ].join("\n");
    const achadosAntes = auditYamlText({ label: "cordis.patch.yml", raw: antes }).findings;
    expect(achadosAntes).toHaveLength(2);
    expect(achadosAntes[0]).toContain("`@latest`");
    expect(achadosAntes[1]).toContain("nao declara `cwd`");

    // A correcao de verdade do ciclo 13: runner pinado por caminho absoluto e
    // com cwd. Mesmo arquivo, mesmo formato, veredito oposto.
    const depois = [
      "servers:",
      "  - name: Vercel",
      "    command: /home/u/.mcp-runtime/node_modules/.bin/mcp-remote",
      "    args: [https://mcp.vercel.com]",
      "    cwd: /home/u/.mcp-runtime",
    ].join("\n");
    expect(auditYamlText({ label: "cordis.patch.yml", raw: depois }).findings).toEqual([]);
  });
});

describe("descoberta multi-sitio", () => {
  it("audita todos os sitios e localiza o achado no arquivo certo", () => {
    const cwd = bench();
    mkdirSync(join(cwd, ".pi"), { recursive: true });
    writeFileSync(
      join(cwd, ".mcp.json"),
      jsonConfig({ limpo: { command: "/bin/true", args: [] } }),
    );
    writeFileSync(
      join(cwd, ".pi", "mcp-adapter.json"),
      jsonConfig({ sujo: { command: "npx", args: ["-y", "pkg@latest"] } }),
    );

    const result = auditSites({ cwd, sites: REPO_CATALOG });
    expect(result.audited.map((s) => s.path)).toEqual([
      ".mcp.json",
      join(".pi", "mcp-adapter.json"),
    ]);
    expect(result.missing).toEqual([]);
    // Sítio novo nao passa por omissao: o achado aponta o arquivo, e so um dos
    // dois esta sujo.
    expect(result.findings.every((f) => f.startsWith(join(".pi", "mcp-adapter.json")))).toBe(true);
    expect(result.findings).toHaveLength(2);
  });

  it("reporta sitio ausente em vez de sumir com ele", () => {
    const result = auditSites({ cwd: bench(), sites: REPO_CATALOG });
    expect(result.audited).toEqual([]);
    expect(result.missing.map((s) => s.path)).toEqual(REPO_CATALOG.map((s) => s.path));
    expect(result.findings).toEqual([]);
  });
});

describe("o proprio repositorio", () => {
  it("nao versiona config MCP sujo — e se passar a versionar, ele nao pode estar sujo", () => {
    const result = auditSites({ cwd: root, sites: REPO_CATALOG });
    expect(result.findings).toEqual([]);
    expect(result.preconditions).toEqual([]);
  });
});

describe("o incidente real, reproduzido", () => {
  it("a forma medida em ~/.config/mcp/mcp.json rende as 7 violacoes do DBT-32", () => {
    // Transcricao da forma medida em 2026-09-29 (valores de env substituidos por
    // sentinelas: o achado que importa e ESTRUTURAL — runner sem pin, sem cwd,
    // e um valor literal em env).
    const { findings } = run(
      jsonConfig({
        MCP_DOCKER: {
          command: "docker",
          args: ["mcp", "gateway", "run", "--profile", "vitruviano-essential"],
          lifecycle: "lazy",
        },
        playwright: {
          command: "npx",
          args: ["-y", "@playwright/mcp@latest", "--allow-unrestricted-file-access", "--isolated"],
        },
        context7: { url: "https://mcp.context7.com/mcp" },
        github: {
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-github@latest"],
          env: { GITHUB_PERSONAL_ACCESS_TOKEN: "github_pat_SENTINELA_NAO_E_UM_SEGREDO_REAL" },
        },
        "chrome-devtools": {
          command: "npx",
          args: ["-y", "chrome-devtools-mcp@latest"],
          env: { SOME_VAR: "value" },
        },
        neon: { transport: "http", url: "https://mcp.neon.tech/mcp", auth: "oauth" },
      }),
    );
    expect(findings).toHaveLength(7);
    // 3 runners sem pin, 3 sem cwd, 1 segredo literal — e nenhum para as linhas
    // que nao executam processo local (docker pinado, context7, neon).
    expect(findings.filter((f) => f.includes("sem pin"))).toHaveLength(3);
    expect(findings.filter((f) => f.includes("sem `cwd`"))).toHaveLength(3);
    expect(findings.filter((f) => f.includes("valor literal"))).toHaveLength(1);
    expect(findings.join("\n")).not.toContain("MCP_DOCKER");
    expect(findings.join("\n")).not.toContain("SOME_VAR");
  });
});
