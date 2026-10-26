import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const script = resolve(root, "scripts/m02-work-package-guard.mjs");
const templatePath = resolve(root, "docs/evidence/_templates/work-package.md");
const realTemplate = readFileSync(templatePath, "utf8");

const tmp = mkdtempSync(join(tmpdir(), "wp-guard-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function fixture(name: string, content: string): string {
  const file = join(tmp, name);
  writeFileSync(file, content);
  return file;
}

function run(template?: string) {
  const args = template === undefined ? [] : ["--template", template];
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  });
}

/** Arvore de evidencia isolada: nada do `docs/evidence/` real e tocado. */
function arvoreEvidencia(nome: string): string {
  const base = join(tmp, nome);
  mkdirSync(base, { recursive: true });
  return base;
}

function pacote(base: string, nome: string, arquivos: Record<string, string>): string {
  const dir = join(base, nome);
  mkdirSync(dir, { recursive: true });
  for (const [arquivo, conteudo] of Object.entries(arquivos)) {
    const destino = join(dir, arquivo);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, conteudo);
  }
  return dir;
}

function runComEvidencia(base: string, extra: string[] = []) {
  return spawnSync(process.execPath, [script, "--evidence", base, ...extra], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  });
}

/** Relatorio JSON do guard (canal auditavel das listas declaradas). */
interface RelatorioGuard {
  check: string;
  result: string;
  findings: string[];
  notes: string[];
  legacyExceptions: Record<string, string>;
  inFlightSeals: Record<string, string>;
  declaredDsnFiles: Record<string, string>;
}

let relatorioReal: RelatorioGuard | undefined;

function relatorio(base?: string): RelatorioGuard {
  if (base === undefined) {
    // O relatorio do repositorio real e o mesmo em todas as assercoes: uma
    // varredura por teste custaria segundos sem acrescentar informacao.
    relatorioReal ??= executarRelatorio(["--json"]);
    return relatorioReal;
  }
  return executarRelatorio(["--json", "--evidence", base]);
}

function executarRelatorio(args: string[]): RelatorioGuard {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
  });
  return JSON.parse(result.stdout) as RelatorioGuard;
}

/** Substitui a célula "como demonstrar" (3ª) da linha do item 17 do template real. */
function comDemonstracao(valor: string): string {
  const linha = realTemplate.split("\n").find((l) => /^\|\s*17\s*\|/.test(l));
  if (linha === undefined) throw new Error("linha do item 17 ausente no template real");
  const partes = linha.split("|");
  partes[3] = ` ${valor} `;
  return realTemplate.replace(linha, partes.join("|"));
}

describe("guard do contrato de work package (falsificação em CI)", () => {
  it("o template real passa com 17 itens", () => {
    const result = run();
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("OK (17 itens");
    expect(result.status).toBe(0);
  });

  it("item 17 removido reprova por contagem", () => {
    const semItem17 = realTemplate.replace(/\n\| 17\s+\|[^\n]*/, "");
    const result = run(fixture("sem-item17.md", semItem17));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("esperado 17");
  });

  it("demonstração vazia no item 17 reprova (S6 N4 do WP-R5)", () => {
    const vazia = comDemonstracao("");
    expect(vazia).not.toBe(realTemplate);
    const result = run(fixture("demo-vazia.md", vazia));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("demonstracao degenerada ou vazia");
  });

  it("demonstração de fachada (`aaaa`) no item 17 reprova", () => {
    const result = run(fixture("demo-fachada.md", comDemonstracao("aaaa")));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("demonstracao degenerada ou vazia");
  });

  it("origem degenerada reprova nomeando o item", () => {
    const degenerate = realTemplate.replace("WP3 C5/N1; WP5 C2/N1", "N/A");
    const result = run(fixture("origem-na.md", degenerate));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("origem degenerada");
  });

  it("origem degenerada de 5 caracteres reprova (pino do DEGENERATE, não do length)", () => {
    const degenerate = realTemplate.replace("WP3 C5/N1; WP5 C2/N1", "?????");
    const result = run(fixture("origem-interrogacoes.md", degenerate));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("origem degenerada");
  });

  it("coluna extra no checklist reprova pela contagem de colunas", () => {
    const extra = realTemplate.replace(/(\| origem \(S6\)[^|]*\|)/, "$1 extra |");
    const result = run(fixture("coluna-extra.md", extra));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("5 colunas");
  });

  it("campo de auto-verificação pré-S6 ausente reprova (KPI)", () => {
    const semKpi = realTemplate.replace("Auto-verificação pré-S6", "KPIs");
    const result = run(fixture("sem-kpi.md", semKpi));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("auto-verificacao pre-S6");
  });

  it("template inexistente sai com erro nomeado (exit 1)", () => {
    const result = run(join(tmp, "nao-existe.md"));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("template ilegivel");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pacotes REAIS: o guard antes só olhava o template, e um pacote novo nascia
// sem selo sem que nada reprovasse. Aqui a regra é fail-closed para o futuro
// (pacote novo sem MANIFEST e sem SPEC reprova) com uma lista NOMEADA de
// exceções legadas — o padrão de `scripts/lib/m02-ci-coverage.ts` (DBT-62).
// ─────────────────────────────────────────────────────────────────────────────

describe("selagem dos pacotes reais", () => {
  it("pacote novo sem MANIFEST e sem SPEC reprova", () => {
    const base = arvoreEvidencia("selagem-novo");
    pacote(base, "pacote-novo-2026-10-21", { "README.md": "# pacote novo\n" });
    const result = runComEvidencia(base);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("pacote-novo-2026-10-21");
    expect(result.stderr).toContain("MANIFEST.sha256");
  });

  it("pacote com MANIFEST.sha256 passa mesmo sem SPEC.md", () => {
    const base = arvoreEvidencia("selagem-manifest");
    pacote(base, "pacote-com-selo", {
      "README.md": "# pacote selado\n",
      "MANIFEST.sha256": "aaaa  README.md\n",
    });
    const result = runComEvidencia(base);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("pacote sem manifesto mas na lista de excecao legada NAO reprova", () => {
    const base = arvoreEvidencia("selagem-legacy");
    const legado = Object.keys(relatorio().legacyExceptions)[0]!;
    pacote(base, legado, { "README.md": "# pacote legado\n" });
    const result = runComEvidencia(base);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("pacote sem manifesto e FORA da lista de excecao reprova (o guard e fail-closed)", () => {
    const base = arvoreEvidencia("selagem-fora");
    pacote(base, "pacote-fora-da-lista", { "README.md": "# fora\n" });
    const result = runComEvidencia(base);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("pacote-fora-da-lista");
  });

  it("diretorio sem documento de pacote nao e pacote: nao reprova", () => {
    const base = arvoreEvidencia("selagem-sem-doc");
    mkdirSync(join(base, "coisas-varias"), { recursive: true });
    const result = runComEvidencia(base);
    expect(result.status).toBe(0);
  });

  it("a lista de excecoes legadas tem os 14 pacotes com motivo uniforme", () => {
    const legado = relatorio().legacyExceptions;
    const nomes = Object.keys(legado);
    expect(nomes).toHaveLength(14);
    const motivos = new Set(Object.values(legado));
    expect(motivos.size).toBe(1);
    for (const nome of nomes) {
      expect(legado[nome]).toMatch(/pacote histórico/i);
    }
  });

  it("os 5 pacotes novos foram selados: a lista de selagem em curso ficou vazia", () => {
    const emCurso = relatorio().inFlightSeals;
    const legado = relatorio().legacyExceptions;
    const nomes = [
      "cu-interativo-2026-10-19",
      "cu-primeiro-cliente-2026-10-19",
      "depuracao-visual-2026-10-19",
      "fase2a-2026-10-18",
      "reconciliacao-2026-10-19",
    ];
    // A selagem em curso foi concluída: nenhum pacote novo fica fora do contrato.
    expect(Object.keys(emCurso)).toHaveLength(0);
    for (const nome of nomes) {
      // Selo publicado no disco...
      expect(existsSync(join(root, "docs/evidence", nome, "MANIFEST.sha256"))).toBe(true);
      expect(existsSync(join(root, "docs/evidence", nome, "SPEC.md"))).toBe(true);
      // ...e fora de qualquer exceção, inclusive a legada.
      expect(legado).not.toHaveProperty(nome);
      expect(emCurso).not.toHaveProperty(nome);
    }
    // Nenhum desses pacotes gera finding de selagem.
    const findings = relatorio().findings.filter((f) => nomes.some((n) => f.includes(n)));
    expect(findings).toEqual([]);
  });

  it("a auditoria concorda com o CLI (mesmo veredito, sem I/O de repo)", () => {
    const base = arvoreEvidencia("selagem-unitario");
    pacote(base, "pacote-novo-2026-10-21", { "README.md": "# pacote novo\n" });
    const r = relatorio(base);
    expect(r.result).toBe("FAILED");
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toContain("pacote-novo-2026-10-21");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Varredura de segredo nas capturas: DSN com senha LITERAL reprova; placeholder
// e senha vazia passam. A senha nunca é ecoada na saída.
// ─────────────────────────────────────────────────────────────────────────────

describe("varredura de DSN com senha literal", () => {
  it("DSN com senha literal reprova", () => {
    const base = arvoreEvidencia("dsn-literal");
    pacote(base, "pacote-novo", {
      "README.md": "# pacote\n",
      "MANIFEST.sha256": "aaaa  README.md\n",
      "captures/env.txt":
        'export DATABASE_URL="postgresql://app_runtime:SenhaLiteral123@db.exemplo-real.com:5432/prod"\n',
    });
    const result = runComEvidencia(base);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("dsn com senha literal");
    expect(result.stderr).toContain("pacote-novo/captures/env.txt");
    // A senha NÃO é ecoada: a guarda nomeia o arquivo e a linha.
    expect(result.stderr).not.toContain("SenhaLiteral123");
  });

  it("DSN redigido, placeholder e senha vazia NAO reprovam", () => {
    const base = arvoreEvidencia("dsn-redigido");
    pacote(base, "pacote-novo", {
      "README.md": "# pacote\n",
      "MANIFEST.sha256": "aaaa  README.md\n",
      "captures/env.txt": [
        'export A="postgresql://app_runtime:${E2E_DB_RUNTIME_PASSWORD}@db.exemplo-real.com:5432/prod"',
        'export B="postgresql://app_runtime:$RUNTIME_PASSWORD@db.exemplo-real.com:5432/prod"',
        'export C="postgresql://app_runtime:<REDACTED>@db.exemplo-real.com:5432/prod"',
        'export D="postgresql://app_runtime:***@db.exemplo-real.com:5432/prod"',
        'export E="postgresql://app_runtime:@db.exemplo-real.com:5432/prod"',
      ].join("\n"),
    });
    const result = runComEvidencia(base);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("fixture local (loopback literal) nao e credencial: nao reprova", () => {
    const base = arvoreEvidencia("dsn-loopback");
    pacote(base, "pacote-novo", {
      "README.md": "# pacote\n",
      "MANIFEST.sha256": "aaaa  README.md\n",
      "captures/env.txt":
        'export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/preco_que_da_lucro_test"\n',
    });
    const result = runComEvidencia(base);
    expect(result.status).toBe(0);
  });

  it("host com variavel nao e provado local: reprova (fail-closed)", () => {
    const base = arvoreEvidencia("dsn-variavel");
    pacote(base, "pacote-novo", {
      "README.md": "# pacote\n",
      "MANIFEST.sha256": "aaaa  README.md\n",
      "captures/env.txt":
        'export DATABASE_URL="postgresql://app_runtime:SenhaLiteral123@${DB_HOST}"\n',
    });
    const result = runComEvidencia(base);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("dsn com senha literal");
  });

  it("`host=` na query move o destino: loopback na autoridade nao salva o DSN", () => {
    const base = arvoreEvidencia("dsn-host-override");
    pacote(base, "pacote-novo", {
      "README.md": "# pacote\n",
      "MANIFEST.sha256": "aaaa  README.md\n",
      "captures/env.txt":
        'export DATABASE_URL="postgresql://app_runtime:SenhaLiteral123@127.0.0.1:5432/db?host=db.exemplo-real.com"\n',
    });
    const result = runComEvidencia(base);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("dsn com senha literal");
  });

  it("as regras puras decidem pelos casos que importam", () => {
    // Cada caso e um DSN no arquivo, e o veredito e o do guard.
    const base = arvoreEvidencia("dsn-regras");
    pacote(base, "pacote-novo", {
      "README.md": "# pacote\n",
      "MANIFEST.sha256": "aaaa  README.md\n",
      "captures/env.txt": [
        'export A="postgresql://app_runtime:${VAR}@db.exemplo-real.com:5432/prod"',
        'export B="postgresql://app_runtime:$VAR@db.exemplo-real.com:5432/prod"',
        'export C="postgresql://app_runtime:<REDACTED>@db.exemplo-real.com:5432/prod"',
        'export D="postgresql://app_runtime:***@db.exemplo-real.com:5432/prod"',
        'export E="postgresql://app_runtime:@db.exemplo-real.com:5432/prod"',
        'export F="postgresql://app_runtime:SenhaLiteral123@db.exemplo.invalid:5432/prod"',
        'export G="postgresql://app_runtime:SenhaLiteral123@db.example.com:5432/prod"',
        'export H="postgresql://app_runtime:SenhaLiteral123@203.0.113.7:5432/prod"',
        'export I="postgresql://app_runtime:SenhaLiteral123@h/prod"',
        'export J="postgresql://app_runtime:SenhaLiteral123@ep-fake.neon.tech/db"',
        'export K="postgresql://app_runtime:SenhaLiteral123@db.exemplo-real.com:5432/prod"',
      ].join("\n"),
    });
    const r = relatorio(base);
    // Só a linha K (host real, senha literal) é achado; as demais são
    // placeholder, espaço reservado, rótulo único ou host declarado sintético.
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toContain("captures/env.txt:11");
    expect(r.findings[0]).not.toContain("SenhaLiteral123");
  });

  it("a varredura nomeia arquivo e linha, e nunca a senha", () => {
    const base = arvoreEvidencia("dsn-unitaria");
    pacote(base, "pacote-novo", {
      "README.md": "# pacote\n",
      "MANIFEST.sha256": "aaaa  README.md\n",
      "captures/env.txt": [
        "primeira linha",
        'export DATABASE_URL="postgresql://app_runtime:SenhaLiteral123@db.exemplo-real.com:5432/prod"',
      ].join("\n"),
    });
    const r = relatorio(base);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toContain("pacote-novo/captures/env.txt:2");
    expect(r.findings[0]).not.toContain("SenhaLiteral123");
  });

  it("os arquivos declarados fora do contrato tem motivo nomeado", () => {
    for (const [arquivo, motivo] of Object.entries(relatorio().declaredDsnFiles)) {
      expect(motivo.length).toBeGreaterThan(10);
      expect(arquivo.length).toBeGreaterThan(0);
    }
  });
});
