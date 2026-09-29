import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  auditRunbookLedger,
  extractSection,
  firstLabelledParagraph,
  issuersOf,
  keyNamesOf,
  lastLedgerVerdict,
  verdictOf,
} from "../../scripts/lib/m02-runbook-ledger";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const runbookPath = resolve(root, "docs/runbooks/acoes-manuais-pendentes.md");
const ledgerPath = resolve(root, "EXECUTION-STATE-PROGRAM.md");
const hygienePath = resolve(root, "docs/evidence/pre-a4-2026-09-05/secrets-hygiene.md");

const runbookReal = readFileSync(runbookPath, "utf8");
const ledgerReal = readFileSync(ledgerPath, "utf8");
const hygieneReal = readFileSync(hygienePath, "utf8");

/**
 * DBT-30 — o closure test que faltava.
 *
 * O registry pedia "um teste que leia os dois documentos e reprove quando o
 * runbook afirmar pendência que o ledger declara fechada e quando o provedor
 * citado não for o emissor das chaves". Até aqui a contradição só se resolvia
 * por leitura humana, e o runbook **mais novo** era o errado.
 *
 * O controle que dá valor a este arquivo não é o caso verde: é o corpus
 * pré-correção, transcrito verbatim do git, que **tem de reprovar**. Um gate que
 * só sabe dizer "ok" ao texto que já está no repositório não mede nada.
 */

/** §3 como estava antes da errata de 2026-09-29 — verbatim de `git show HEAD:`. */
const RUNBOOK_SECAO_3_PRE_CORRECAO = `## 3. Revogação de \`neon-storage.env\` (SEC-01, pendente desde a auditoria)

**Estado:** um blob **órfão** (\`25393aac\`) contém cinco credenciais com prefixo
\`_live_\` (\`nak_live_\`, \`nsk_live_\`, \`nt_live_\`). Provado por quatro vias
independentes que **não está em nenhuma ref publicada** — logo não foi exposto
pela virada. O que falta é a prova de que foram **revogadas na origem**; o
próprio ledger registra "revogação não comprovada".

**O que fazer:**

1. No console do Neon, localizar as chaves de API com prefixo \`_live_\` e
   **revogá-las** (ou confirmar que já foram)
2. Registrar a confirmação com **data e autor**, não com o valor
3. \`git gc --prune=now\` no clone local, para que o blob órfão deixe de existir
   em disco — é higiene, **não** é o que torna a revogação verdadeira
`;

function auditWith(overrides: {
  runbook?: string;
  ledger?: string;
  hygiene?: string;
}): ReturnType<typeof auditRunbookLedger> {
  return auditRunbookLedger({
    runbook: overrides.runbook ?? runbookReal,
    ledger: overrides.ledger ?? ledgerReal,
    hygiene: overrides.hygiene ?? hygieneReal,
  });
}

/** Quantos achados acusam um provedor específico de ser o emissor. */
function citacoesDe(findings: string[], provider: string): number {
  return findings.filter((f) => f.includes(`cita \`${provider}\` como provedor`)).length;
}

describe("DBT-30 — runbook × ledger, os documentos reais", () => {
  it("os três documentos reais passam: zero violação e zero precondição", () => {
    const { findings, preconditions } = auditWith({});
    expect({ findings, preconditions }).toEqual({ findings: [], preconditions: [] });
  });

  it("a descoberta não é vazia — a seção existe e a âncora é encontrada", () => {
    const section = extractSection(runbookReal, "neon-storage.env");
    expect(section).not.toBeNull();
    expect(section!.heading).toContain("neon-storage.env");
  });

  it("os nomes de chave reais são os cinco, e os emissores derivados são AWS e OpenAI", () => {
    const names = keyNamesOf(hygieneReal);
    expect(names).toEqual([
      "AWS_ACCESS_KEY_ID",
      "AWS_ENDPOINT_URL_S3",
      "AWS_REGION",
      "AWS_SECRET_ACCESS_KEY",
      "OPENAI_API_KEY",
    ]);
    expect(issuersOf(names)).toEqual({ issuers: ["aws", "openai"], unknown: [] });
  });
});

describe("DBT-30 — o corpus pré-correção REPROVA (prova de que o gate mede)", () => {
  it("o runbook como estava afirma pendência que o ledger declara fechada", () => {
    const { findings } = auditWith({ runbook: RUNBOOK_SECAO_3_PRE_CORRECAO });
    expect(findings.join("\n")).toContain("runbook afirma `SEC-01` aberta");
    expect(findings.join("\n")).toContain("ledger registra fechada");
  });

  it("e cita como provedor um console que não emitiu as chaves", () => {
    const { findings } = auditWith({ runbook: RUNBOOK_SECAO_3_PRE_CORRECAO });
    expect(findings.join("\n")).toContain("cita `neon` como provedor");
    expect(findings.join("\n")).toContain("o emissor é aws/openai");
  });

  it("o texto corrigido sobre os mesmos documentos não gera achado nenhum", () => {
    expect(auditWith({}).findings).toEqual([]);
  });
});

describe("DBT-30 — fronteira nas duas direções", () => {
  it("runbook fechado × ledger aberto também reprova", () => {
    const ledgerAberto = ledgerReal.replace(
      /SEC-01\b[^\n]{0,40}?\bFECHAD[AO]S?\b/g,
      "SEC-01 segue ABERTA",
    );
    expect(lastLedgerVerdict(ledgerAberto, "SEC-01")).toBe("aberta");
    const { findings } = auditWith({ ledger: ledgerAberto });
    expect(findings.join("\n")).toContain("runbook afirma `SEC-01` fechada");
    expect(findings.join("\n")).toContain("ledger registra aberta");
  });

  it("ler o PRIMEIRO veredicto inverteria a verdade — o ledger é append-only", () => {
    // O ledger real contém os dois: "SEC-01 segue ABERTA" (2026-09-05) e
    // "SEC-01 FECHADA" (2026-09-12). Só o último é o veredicto vivo.
    expect(lastLedgerVerdict(ledgerReal, "SEC-01")).toBe("fechada");
    const invertido = ["SEC-01 FECHADA", "SEC-01 segue ABERTA"].join("\n");
    expect(lastLedgerVerdict(invertido, "SEC-01")).toBe("aberta");
    const naOrdemReal = ["SEC-01 segue ABERTA", "SEC-01 FECHADA"].join("\n");
    expect(lastLedgerVerdict(naOrdemReal, "SEC-01")).toBe("fechada");
  });
});

describe("DBT-30 — fail-closed: o que não dá para verificar não vira verde", () => {
  it("runbook sem a seção vira precondição, nunca aprovação", () => {
    const semSecao = runbookReal
      .split("\n")
      .filter((line) => !line.includes("neon-storage.env"))
      .join("\n");
    const { findings, preconditions } = auditWith({ runbook: semSecao });
    expect(findings).toEqual([]);
    expect(preconditions.join("\n")).toContain("runbook sem seção");
  });

  it("higiene sem a lista de nomes de chave vira precondição (emissor indeterminável)", () => {
    const semLista = hygieneReal.replace(
      /chaves \(nomes apenas[^)]*\):\s*[^\n]+/,
      "chaves: (omitidas)",
    );
    expect(keyNamesOf(semLista)).toEqual([]);
    const { preconditions } = auditWith({ hygiene: semLista });
    expect(preconditions.join("\n")).toContain("emissor indeterminável");
  });

  it("nome de chave sem regra de emissor vira precondição, não silêncio", () => {
    const comChaveDesconhecida = hygieneReal.replace("OPENAI_API_KEY", "MISTERY_API_KEY");
    const { preconditions } = auditWith({ hygiene: comChaveDesconhecida });
    expect(preconditions.join("\n")).toContain(
      "sem regra de emissor para 1 chave(s): MISTERY_API_KEY",
    );
  });

  it("seção que não nomeia provedor nenhum vira precondição", () => {
    const semProvedor = runbookReal
      .replace(
        "**O emissor nunca foi o Neon.**",
        "**O emissor é o que está no documento de higiene.**",
      )
      .replace(/\bAWS\b/g, "o primeiro")
      .replace(/\bOpenAI\b/g, "o segundo");
    const section = extractSection(semProvedor, "neon-storage.env");
    expect(section).not.toBeNull();
    const { preconditions } = auditWith({ runbook: semProvedor });
    expect(preconditions.join("\n")).toContain("não nomeia provedor nenhum");
  });

  it("citar SÓ o provedor errado vira precondição além do achado", () => {
    const { findings, preconditions } = auditWith({ runbook: RUNBOOK_SECAO_3_PRE_CORRECAO });
    expect(findings.length).toBeGreaterThan(0);
    expect(preconditions.join("\n")).toContain("citação só do provedor errado");
  });
});

describe("DBT-30 — a negação é o que permite documentar o erro", () => {
  it("negar o provedor errado na mesma frase absolve; afirmá-lo acrescenta um achado", () => {
    // O corpus pré-correção já cita o Neon uma vez ("No console do Neon"); o
    // que se mede aqui é o EFEITO DA NEGAÇÃO sobre a frase acrescentada, não a
    // ausência total de achado — por isso a contagem, e não o `not.toContain`.
    const base = auditWith({ runbook: RUNBOOK_SECAO_3_PRE_CORRECAO }).findings;
    expect(citacoesDe(base, "neon")).toBe(1);

    const negado = auditWith({
      runbook: `${RUNBOOK_SECAO_3_PRE_CORRECAO}\nO emissor nunca foi o Neon.\n`,
    }).findings;
    expect(citacoesDe(negado, "neon")).toBe(1);

    const afirmado = auditWith({
      runbook: `${RUNBOOK_SECAO_3_PRE_CORRECAO}\nO emissor é o Neon.\n`,
    }).findings;
    expect(citacoesDe(afirmado, "neon")).toBe(2);
  });

  it("veredicto ambíguo (fechada e aberta no mesmo trecho) é indistinguível de nenhum", () => {
    expect(verdictOf("SEC-01 FECHADA")).toBe("fechada");
    expect(verdictOf("SEC-01 pendente")).toBe("aberta");
    expect(verdictOf("fechada, mas antes pendente")).toBeNull();
    expect(verdictOf("sem veredicto")).toBeNull();
  });

  it("o parágrafo rotulado é lido após o cabeçalho, não em vez dele", () => {
    const section = extractSection(runbookReal, "neon-storage.env")!;
    expect(verdictOf(section.heading)).toBe("fechada");
    const labelled = firstLabelledParagraph(section.body);
    expect(labelled).not.toBeNull();
    expect(labelled).toContain("SEC-01 FECHADA em 2026-09-12");
  });
});
