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
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  REPO_CATALOG,
  auditJsonConfig,
  auditOpencodeConfig,
  auditSites,
  auditYamlText,
  bearerCredential,
  fingerprint,
  homeCatalog,
  insideWorkTree,
  isCredentialField,
  isEnvPlaceholder,
  isNpxCachePath,
  isPinned,
  looksLikeLiteralSecret,
  npxCacheManifestMissing,
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

// ─────────────────────────────────────────────────────────────────────────────
// 2026-10-17 — o reparo dos MCPs que nao carregavam.
//
// Medido no log do cliente vivo (`~/.cline/data/logs/cline.log`,
// 2026-10-17T05:17Z): `aikido` foi *skipped* com `code=254` e
// `npm error ENOENT ... /home/douglas/.npm/_npx/9a60de26ed7bbd1b/package.json`.
// A linha real estava ANINHADA em `transport` e a guarda so lia a forma plana —
// ou seja: mesmo com o sitio no catalogo, o defeito teria passado. Os testes
// abaixo plantam a forma real e exigem o veredito; os que vieram antes continuam
// valendo, porque uma regra nova que silencia a antiga nao e uma regra.
// ─────────────────────────────────────────────────────────────────────────────

describe("linha aninhada em `transport` (a forma do Cline)", () => {
  it("audita a forma aninhada com o defeito real: pinada, mas sem `cwd`", () => {
    const { findings } = run(
      jsonConfig({
        aikido: {
          transport: { type: "stdio", command: "npx", args: ["-y", "@aikidosec/mcp@1.0.9"] },
        },
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain("sem `cwd`");
  });

  it("e reprova runner sem pin na mesma forma — a leitura nao e parcial", () => {
    const { findings } = run(
      jsonConfig({
        aikido: {
          transport: { type: "stdio", command: "npx", args: ["-y", "@aikidosec/mcp@latest"] },
        },
      }),
    );
    expect(findings).toHaveLength(2);
    expect(findings[0]).toContain("sem pin");
    expect(findings[1]).toContain("sem `cwd`");
  });

  it("o nivel de fora vence quando os dois declaram `cwd`", () => {
    const runtime = join(bench(), "runtime");
    const checkout = join(bench(), "repo");
    mkdirSync(runtime, { recursive: true });
    mkdirSync(join(checkout, ".git"), { recursive: true });
    const { findings } = run(
      jsonConfig({
        svc: {
          cwd: runtime,
          transport: { type: "stdio", command: "npx", args: ["-y", "pkg@1.0.0"], cwd: checkout },
        },
      }),
    );
    expect(findings).toEqual([]);
  });
});

describe("credencial fora de `env`: `headers` e `metadata`", () => {
  // Forma do token do gateway Docker medido na config viva (64 hex: minusculas +
  // digitos). A entropia sozinha NAO acusaria — o nome do campo acusa.
  const TOKEN = "83c3541ab96220d9ea6e0f6cc1ba706b2d518f1fc637211329e33fc5faf1e18a";

  it("acusa `Bearer <valor>` citando o VALOR, nunca o cabecalho", () => {
    const { findings } = run(
      jsonConfig({
        MCP_DOCKER: {
          type: "streamableHttp",
          url: "http://127.0.0.1:8811/mcp",
          headers: { Authorization: `Bearer ${TOKEN}` },
        },
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain("`headers.Authorization`");
    expect(findings[0]).toContain(`${TOKEN.length} bytes`);
    expect(findings[0]).toContain(fingerprint(TOKEN));
    // A propriedade que separa guarda de vetor: nada do valor na saida — nem o
    // cabecalho inteiro, nem o token, nem um recorte dele.
    expect(findings[0]).not.toContain(TOKEN);
    expect(findings[0]).not.toContain(`Bearer ${TOKEN}`);
    expect(findings[0]).not.toContain(TOKEN.slice(0, 12));
  });

  it("acusa valor sob nome de credencial sem entropia (o caso context7 medido)", () => {
    const chave = "ctx7sk" + "a".repeat(37);
    const { findings } = run(
      jsonConfig({
        context7: {
          transport: { type: "streamableHttp", url: "https://mcp.context7.com/mcp" },
          metadata: { key: chave },
        },
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain("`metadata.key`");
    expect(findings[0]).not.toContain(chave);
  });

  it("placeholder, valor curto e nome nao-credential nao viram achado", () => {
    const { findings } = run(
      jsonConfig({
        a: { url: "https://x/mcp", headers: { Authorization: "Bearer ${GATEWAY_TOKEN}" } },
        b: { url: "https://x/mcp", metadata: { key: "curto" } },
        c: { url: "https://x/mcp", headers: { "X-Trace-Id": "32c190d0b7f26b6bba5d1b6a34ee92ee" } },
      }),
    );
    // `X-Trace-Id` nao tem nome de credencial e o valor tem duas classes de
    // caractere: o limite declarado e nao confundir identificador com token.
    expect(findings).toEqual([]);
  });

  it("as regras puras decidem pelos casos que importam", () => {
    expect(bearerCredential(`Bearer ${TOKEN}`)).toBe(TOKEN);
    expect(bearerCredential("basic dXNlcjpzZW5oYQ==")).toBe("dXNlcjpzZW5oYQ==");
    expect(bearerCredential("sem prefixo")).toBeNull();
    expect(bearerCredential(42)).toBeNull();
    expect(isCredentialField("Authorization")).toBe(true);
    expect(isCredentialField("api_key")).toBe(true);
    expect(isCredentialField("DOCKER_HOST")).toBe(false);
    expect(isEnvPlaceholder("${VAR}")).toBe(true);
    expect(isEnvPlaceholder("$VAR")).toBe(true);
    // O `$` e obrigatorio: sem ele um token em snake_case passaria por placeholder.
    expect(isEnvPlaceholder("github_pat_11ABCDEFG0abcdefghijklmnop")).toBe(false);
  });
});

describe("esquema do opencode (`mcp.servers`, `command` em array)", () => {
  it("reprova runner sem pin no formato de array", () => {
    const { findings, preconditions } = auditOpencodeConfig({
      label: "opencode.json",
      raw: JSON.stringify({
        mcp: { servers: { svc: { type: "local", command: ["npx", "-y", "pkg@latest"] } } },
      }),
    });
    expect(preconditions).toEqual([]);
    expect(findings).toHaveLength(2);
    expect(findings[0]).toContain("sem pin");
    expect(findings[1]).toContain("sem `cwd`");
  });

  it("aprova a config real medida em 2026-10-17", () => {
    const { findings, preconditions } = auditOpencodeConfig({
      label: "opencode.json",
      raw: JSON.stringify({
        mcp: {
          servers: {
            MCP_DOCKER: {
              type: "local",
              command: ["docker", "mcp", "gateway", "run", "--profile", "p1"],
              environment: { DOCKER_HOST: "unix:///home/u/.docker/desktop/docker.sock" },
            },
            vercel: { type: "remote", url: "https://mcp.vercel.com" },
          },
        },
      }),
    });
    expect(findings).toEqual([]);
    expect(preconditions).toEqual([]);
  });

  it("config sem `mcp.servers` e precondicao, nunca aprovacao por vacuidade", () => {
    const { findings, preconditions } = auditOpencodeConfig({
      label: "opencode.json",
      raw: JSON.stringify({ mcpServers: {} }),
    });
    expect(findings).toEqual([]);
    expect(preconditions).toHaveLength(1);
    expect(preconditions[0]).toContain("mcp.servers");
  });
});

describe("catalogo de sitios da maquina", () => {
  // Este bloco e PURO de proposito: ele julga a FORMA do catalogo, nunca o
  // estado do HOME de quem roda a suite. `npm run test` nao pode virar um gate
  // que depende da maquina do contribuidor — o defeito que a guarda combate
  // (config viva fora do repositorio) nao pode virar dependencia da suite.
  it("cobre o cliente que de fato carrega MCP nesta maquina, com papel e formato", () => {
    const sites = homeCatalog();
    const paths = sites.map((s) => s.path);
    expect(paths).toContain(
      join(homedir(), ".cline", "data", "settings", "cline_mcp_settings.json"),
    );
    expect(paths).toContain(join(homedir(), ".pi", "agent", "mcp-adapter.json"));
    // Formato desconhecido cairia no parser de YAML por omissao — que e o jeito
    // silencioso de nao auditar nada. Todo sitio declara formato conhecido.
    for (const site of sites) {
      expect(["json", "opencode-json", "yaml-text"]).toContain(site.format);
      expect((site.role ?? "").length).toBeGreaterThan(0);
    }
  });

  // Igualdade de CONJUNTO, nao "pelo menos N": a auditoria mediu que
  // `expect(sites.length).toBeGreaterThanOrEqual(8)` permitia remover ate
  // TRES sitios sem reprovar — exatamente o modo de falha que o catalogo
  // explicito existe para impedir (o cliente que de fato carregava MCP nao
  // era nenhum dos sitios de 2026-10-17).
  // Remover ou renomear um sitio agora reprova; adicionar um sitio exige
  // atualizar esta lista DE PROPONITO.
  it("o catalogo de maquina e exatamente o conjunto esperado (11 sitios)", () => {
    const esperado = [
      join(homedir(), ".config", "mcp", "mcp.json"),
      join(homedir(), ".agents", "mcp.json"),
      join(homedir(), ".agents", "mcp", "mcp.json"),
      join(homedir(), ".cline", "data", "settings", "cline_mcp_settings.json"),
      join(homedir(), ".pi", "agent", "mcp-adapter.json"),
      join(homedir(), ".pi", "agent", "mcp.json"),
      join(homedir(), ".cache", "plugins", "github.com-vercel-vercel-plugin", ".mcp.json"),
      join(homedir(), ".config", "Codex", "executor-plugins", "codex-app-tools", ".mcp.json"),
      join(homedir(), ".config", "opencode", "opencode.json"),
      join(homedir(), ".gemini", "config", "mcp_config.json"),
      join(homedir(), ".dsh", "bundles", "kimi-mcp", "cordis.patch.yml"),
    ];
    const paths = homeCatalog().map((s) => s.path);
    expect(paths).toHaveLength(11);
    expect([...paths].sort()).toEqual([...esperado].sort());
  });

  it("o catalogo de repositorio e exatamente o conjunto esperado (2 sitios)", () => {
    expect(REPO_CATALOG.map((s) => s.path)).toEqual([".mcp.json", join(".pi", "mcp-adapter.json")]);
    expect(REPO_CATALOG).toHaveLength(2);
  });
});

describe("cache do npx sem manifesto (o que a guarda ve e o que ela nao ve)", () => {
  it("reconhece o cache do npx pelo par de segmentos, sem presumir hash", () => {
    expect(isNpxCachePath("/home/u/.npm/_npx/9a60de26ed7bbd1b")).toBe(true);
    expect(isNpxCachePath("/home/u/.npm/_npx/9a60de26ed7bbd1b/node_modules/pkg")).toBe(true);
    expect(isNpxCachePath("/home/u/.mcp-runtime")).toBe(false);
    expect(isNpxCachePath("/home/u/.npm/_cacache")).toBe(false);
  });

  it("so reports cache quebrado quando o diretorio existe e nao tem manifesto", () => {
    const base = bench();
    const cache = join(base, ".npm", "_npx", "9a60de26ed7bbd1b");
    // Diretorio inexistente: cache ainda nao criado nao e cache quebrado.
    expect(npxCacheManifestMissing(cache)).toBe(false);
    mkdirSync(cache, { recursive: true });
    expect(npxCacheManifestMissing(cache)).toBe(true);
    writeFileSync(join(cache, "package.json"), "{}");
    expect(npxCacheManifestMissing(cache)).toBe(false);
  });

  it("reprova a linha cujo `cwd` aponta para o cache do npx sem manifesto", () => {
    const cache = join(bench(), ".npm", "_npx", "9a60de26ed7bbd1b");
    mkdirSync(cache, { recursive: true });
    const { findings } = run(
      jsonConfig({
        aikido: { command: "npx", args: ["-y", "@aikidosec/mcp@1.0.9"], cwd: cache },
      }),
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toContain("cache do npx");
    expect(findings[0]).toContain("package.json");
  });

  it("aprova a mesma linha quando o cache tem manifesto", () => {
    const cache = join(bench(), ".npm", "_npx", "9a60de26ed7bbd1b");
    mkdirSync(cache, { recursive: true });
    writeFileSync(join(cache, "package.json"), "{}");
    const { findings } = run(
      jsonConfig({
        aikido: { command: "npx", args: ["-y", "@aikidosec/mcp@1.0.9"], cwd: cache },
      }),
    );
    expect(findings).toEqual([]);
  });
});
