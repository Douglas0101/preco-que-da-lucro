import { describe, expect, it } from "vitest";
import { classificarAlvo, exigirAlvoDeBanco } from "../../scripts/lib/db-target";
import {
  corpoVazio,
  exigirAlvoDaBranch,
  exigirAlvoDoBaseline,
  julgarSchemaDiff,
  validarHashes,
  type EntradaSchemaDiff,
  type LeituraJournal,
} from "../../scripts/db/schema-diff-verdict";

/**
 * `scripts/db/schema-diff-verdict.ts` — o predicado de §12.5 (DBT-56).
 *
 * O defeito medido: o passo classificava por "o PR mexe em `drizzle/**`?" × "o
 * diff saiu vazio?", e com a ordem sancionada *expand antes de promover* o diff
 * vazio é o estado CORRETO (produção já recebeu as migrations) — o CI pintou um
 * estado certo de vermelho. O predicado novo é de nível de migration: o que
 * separa "produção já migrada" de "a migration não aplicou" é o conjunto de
 * hashes de `drizzle.__drizzle_migrations` nos dois lados.
 *
 * Estes testes existem nos dois sentidos de propósito. O (a) é o verde que conserta
 * o falso vermelho; (b)–(d) são os vermelhos que **precisam continuar** vermelhos,
 * senão a correção virou "aceitar tudo".
 */

/** Hashes determinísticos e com cara de sha256 — só a forma importa aqui. */
function hashes(n: number, prefixo = ""): string[] {
  return Array.from({ length: n }, (_, i) =>
    (prefixo + i.toString(16).padStart(4, "0")).padEnd(64, "0"),
  );
}

const PRODUCAO_20 = hashes(20);
const PRODUCAO_12 = hashes(12);
const MIGRATIONS_NO_REPO = 20;

function entrada(over: Partial<EntradaSchemaDiff> = {}): EntradaSchemaDiff {
  return {
    vazio: true,
    bytes: 2,
    drizzleTocado: "yes",
    branch: { ok: true, hashes: PRODUCAO_20 },
    producao: { ok: true, hashes: PRODUCAO_20 },
    migrationsNoRepo: MIGRATIONS_NO_REPO,
    headBranch: "br-crimson-breeze-ay19r2ys",
    baseBranch: "production",
    baseBranchId: "br-long-violet-aye9g0bn",
    dbName: "neondb",
    ...over,
  };
}
describe("schema-diff §12.5 — (a) produção já migrada: o caso que reprovava", () => {
  it("(a) journals IGUAIS + diff vazio + PR tocando drizzle/** ⇒ consistente", () => {
    // O estado medido no run 36776521098: 0012–0019 já aplicadas em produção,
    // então a branch do PR (que aplicou o mesmo journal) é idêntica à baseline e
    // `compare_schema` não tem o que reportar. Isto era `INCONSISTENTE`.
    const resultado = julgarSchemaDiff(entrada());
    expect(resultado.veredito).toBe("consistente");
    expect(resultado.leitura).toMatch(/consistente: produção já migrada/);
    expect(resultado.resumo).toMatch(/journals iguais/);
  });

  it("(a) o predicado antigo reprovava exatamente esta entrada — a regressão está provada", () => {
    // Forma do predicado removido de neon-pr-branch.yml:196-268 (`const reading
    // = touched === "yes" ? empty ? "INCONSISTENTE: ..." : "..." : ...`).
    const predicadoAntigo = (touched: string, empty: boolean): string =>
      touched === "yes"
        ? empty
          ? "INCONSISTENTE: o PR mexe em drizzle/** mas o diff saiu vazio — checar journal/migrations da branch"
          : "consistente: mudança de schema do PR visível contra produção"
        : touched === "no"
          ? empty
            ? "consistente: diff vazio (PR não mexe em drizzle/**)"
            : "diff não vazio em PR sem drizzle/**"
          : "indeterminado: lista de arquivos do PR indisponível";

    // Mesma entrada, os dois predicados: o antigo diz INCONSISTENTE, o novo verde.
    expect(predicadoAntigo("yes", true)).toMatch(/^INCONSISTENTE/);
    expect(julgarSchemaDiff(entrada()).leitura).not.toMatch(/^INCONSISTENTE/);
  });

  it("(a) o rótulo DRIZZLE_TOUCHED qualifica a mensagem mas não decide o veredito", () => {
    // `unknown` (sem permissão de pull-requests:read) não pode reintroduzir o
    // "indeterminado" como veredito: os journals são a evidência.
    for (const touched of ["yes", "no", "unknown"] as const) {
      const resultado = julgarSchemaDiff(entrada({ drizzleTocado: touched }));
      expect(resultado.veredito, touched).toBe("consistente");
      expect(resultado.leitura, touched).toMatch(/produção já migrada/);
    }
  });
});

describe("schema-diff §12.5 — (b) produção atrás: o diff vazio é contradição", () => {
  it("(b) branch tem 20, produção tem 12, diff VAZIO ⇒ INCONSISTENTE", () => {
    const resultado = julgarSchemaDiff(
      entrada({
        branch: { ok: true, hashes: PRODUCAO_20 },
        producao: { ok: true, hashes: PRODUCAO_12 },
      }),
    );
    expect(resultado.veredito).toBe("inconsistente");
    expect(resultado.leitura).toMatch(/produção está atrás \(12 de 20 migrations\)/);
    expect(resultado.linhas.join("\n")).toMatch(/produção ATRÁS/);
  });

  it("(b) o mesmo estado com diff NÃO vazio continua consistente (a mudança apareceu)", () => {
    const resultado = julgarSchemaDiff(
      entrada({
        vazio: false,
        bytes: 4096,
        branch: { ok: true, hashes: PRODUCAO_20 },
        producao: { ok: true, hashes: PRODUCAO_12 },
      }),
    );
    expect(resultado.veredito).toBe("consistente");
    expect(resultado.leitura).toMatch(/visível contra produção/);
  });

  it("(b) a branch ATRÁS de produção é INCONSISTENTE mesmo com diff vazio", () => {
    // Simétrico e igualmente defeituoso: a branch não entrega o estado do PR.
    // O caso que o job produz de verdade: a branch nasce de `develop` (§12.4) e
    // produção já tem migrations que `develop` ainda não carrega — a chain da
    // branch casa com o repo, e mesmo assim ela está atrás da baseline.
    const resultado = julgarSchemaDiff(
      entrada({
        branch: { ok: true, hashes: PRODUCAO_20 },
        producao: { ok: true, hashes: hashes(22) },
      }),
    );
    expect(resultado.veredito).toBe("inconsistente");
    expect(resultado.leitura).toMatch(/a branch do PR está atrás de produção/);
    expect(resultado.linhas.join("\n")).toMatch(/branch ATRÁS/);
  });

  it("(b) branch com chain incompleta é INCONSISTENTE pelojournal, não pela comparação", () => {
    // O mesmo par (12, 20) invertido: aqui o journal da branch é que não casa com
    // `_journal.json`, e o nome do motivo importa para quem lê o artefato.
    const resultado = julgarSchemaDiff(
      entrada({
        branch: { ok: true, hashes: PRODUCAO_12 },
        producao: { ok: true, hashes: PRODUCAO_20 },
      }),
    );
    expect(resultado.veredito).toBe("inconsistente");
    expect(resultado.leitura).toMatch(/12 migration\(s\) aplicadas e o repositório declara 20/);
  });

  it("(b) journals divergentes sem subconjunto são INCONSISTENTES", () => {
    const resultado = julgarSchemaDiff(
      entrada({
        branch: { ok: true, hashes: hashes(20, "a") },
        producao: { ok: true, hashes: hashes(20, "b") },
      }),
    );
    expect(resultado.veredito).toBe("inconsistente");
    expect(resultado.linhas.join("\n")).toMatch(/DIVERGENTES/);
  });
});

describe("schema-diff §12.5 — (c) bancos não migrados não passam por vacuidade", () => {
  it("(c) journal VAZIO dos dois lados ⇒ INCONSISTENTE, não 'iguais portanto consistente'", () => {
    // Dois bancos recém-criados são iguais por construção. Tratar isso como
    // consistência faria o gate passar sem ter medido nada.
    const resultado = julgarSchemaDiff(
      entrada({ branch: { ok: true, hashes: [] }, producao: { ok: true, hashes: [] } }),
    );
    expect(resultado.veredito).toBe("inconsistente");
    expect(resultado.leitura).toMatch(/journal vazio/);
    expect(resultado.leitura).toMatch(/igualdade por construção não é consistência/);
  });

  it("(c) journal vazio só na branch ⇒ INCONSISTENTE nomeando o db:migrate", () => {
    const resultado = julgarSchemaDiff(
      entrada({ branch: { ok: true, hashes: [] }, producao: { ok: true, hashes: PRODUCAO_20 } }),
    );
    expect(resultado.veredito).toBe("inconsistente");
    expect(resultado.linhas.join("\n")).toMatch(/db:migrate não rodou/);
  });

  it("(c) journal vazio só em produção ⇒ INCONSISTENTE (a base não é a base migrada)", () => {
    const resultado = julgarSchemaDiff(
      entrada({ branch: { ok: true, hashes: PRODUCAO_20 }, producao: { ok: true, hashes: [] } }),
    );
    expect(resultado.veredito).toBe("inconsistente");
    expect(resultado.leitura).toMatch(/journal de produção está vazio/);
  });

  it("(c) chain da branch ≠ _journal.json é INCONSISTENTE mesmo com journals iguais entre si", () => {
    const resultado = julgarSchemaDiff(
      entrada({
        branch: { ok: true, hashes: PRODUCAO_12 },
        producao: { ok: true, hashes: PRODUCAO_12 },
        migrationsNoRepo: MIGRATIONS_NO_REPO,
      }),
    );
    expect(resultado.veredito).toBe("inconsistente");
    expect(resultado.leitura).toMatch(/12 migration\(s\) aplicadas e o repositório declara 20/);
  });
});

describe("schema-diff §12.5 — (d) falha de leitura fecha o portão", () => {
  const falha = (motivo: string): LeituraJournal => ({ ok: false, motivo });

  it("(d) erro ao ler o journal da branch ⇒ INCONSISTENTE, distinguível de (a)", () => {
    const resultado = julgarSchemaDiff(
      entrada({ branch: falha("branch do PR (br-x): Connection terminated unexpectedly") }),
    );
    expect(resultado.veredito).toBe("inconsistente");
    expect(resultado.leitura).toMatch(
      /não foi possível ler drizzle.__drizzle_migrations na branch do PR/,
    );
    expect(resultado.leitura).toMatch(/Connection terminated unexpectedly/);
    // Distinguível de (a): o motivo da falha está nomeado e a semântica declarada.
    expect(resultado.leitura).not.toMatch(/produção já migrada/);
    expect(resultado.linhas.join("\n")).toMatch(/NÃO VERIFICADA/);
  });

  it("(d) erro ao ler o journal de produção ⇒ INCONSISTENTE, distinguível de (a)", () => {
    const resultado = julgarSchemaDiff(
      entrada({ producao: falha("produção (production): 28P01") }),
    );
    expect(resultado.veredito).toBe("inconsistente");
    expect(resultado.leitura).toMatch(
      /não foi possível ler drizzle.__drizzle_migrations em produção/,
    );
    expect(resultado.leitura).not.toMatch(/produção já migrada/);
  });

  it("(d) a leitura real devolve falha, não vazio: shape inválida vira LeituraJournal falho", () => {
    expect(validarHashes(["não-é-hex"])).toEqual({
      ok: false,
      motivo: expect.stringContaining("fora do formato sha256"),
    });
    expect(validarHashes([PRODUCAO_20[0]])).toEqual({ ok: true, hashes: [PRODUCAO_20[0]] });
  });

  it("(d) leitura falhada NUNCA vira 'conjuntos iguais' — nem quando os dois lados falham", () => {
    const resultado = julgarSchemaDiff(
      entrada({ branch: falha("timeout"), producao: falha("timeout") }),
    );
    expect(resultado.veredito).toBe("inconsistente");
    expect(resultado.linhas.join("\n")).not.toMatch(/IGUAIS/);
  });
});

describe("schema-diff §12.5 — (e) regressão: schema genuinamente divergente", () => {
  it("(e) produção atrás + diff não vazio ⇒ 'consistente: mudança visível', como antes", () => {
    // A forma exata do texto do predicado antigo para este caminho — quem lê o
    // artefato de um PR com migration nova reconhece a mesma frase.
    const resultado = julgarSchemaDiff(
      entrada({
        vazio: false,
        branch: { ok: true, hashes: PRODUCAO_20 },
        producao: { ok: true, hashes: PRODUCAO_12 },
      }),
    );
    expect(resultado.veredito).toBe("consistente");
    expect(resultado.leitura).toMatch(
      /^consistente: mudança de schema do PR visível contra produção/,
    );
    expect(resultado.resumo).toBe("consistente (diff não vazio · produção atrás)");
  });

  it("(e) journals iguais + diff NÃO vazio ⇒ drift nomeado, sem esconder o paradoxo", () => {
    const resultado = julgarSchemaDiff(entrada({ vazio: false, bytes: 120 }));
    expect(resultado.veredito).toBe("consistente");
    expect(resultado.leitura).toMatch(/drift fora de drizzle/);
  });

  it("(e) o resumo do passo mantém 'nao-vazio' com bytes, como o output antigo", () => {
    const resultado = julgarSchemaDiff(
      entrada({
        vazio: false,
        bytes: 2048,
        branch: { ok: true, hashes: PRODUCAO_20 },
        producao: { ok: true, hashes: PRODUCAO_12 },
      }),
    );
    expect(resultado.resumo).toBe("consistente (diff não vazio · produção atrás)");
    expect(resultado.resumo).not.toMatch(/^vazio/);
  });
});

describe("schema-diff §12.5 — reconhecimento de corpo vazio", () => {
  it("reconhece o vazio por contenção recursiva, como o predicado antigo", () => {
    for (const vazio of [null, undefined, "", "  ", "{}", "[]", { a: null }, { a: [], b: {} }]) {
      expect(corpoVazio(vazio), JSON.stringify(vazio)).toBe(true);
    }
    for (const cheio of ["x", { a: 1 }, [{ a: null }, 2], { a: [], b: 0 }]) {
      expect(corpoVazio(cheio), JSON.stringify(cheio)).toBe(false);
    }
  });
});

describe("schema-diff §12.5 — política de alvo (scripts/lib/db-target.ts)", () => {
  const REMOTO = "postgres://u:p@ep-frosty-bread-ayi2pg4p.c-5.us-east-2.aws.neon.tech/neondb";
  const PRODUCAO = "postgres://u:p@ep-long-violet-aye9g0bn.c-5.us-east-2.aws.neon.tech/neondb";
  const MOTIVO = "CI Neon PR branch 50 — schema diff read-only (§12.5)";

  it("a branch da comparação nunca é produção, com ou sem motivo", () => {
    expect(() => exigirAlvoDaBranch(PRODUCAO, { ALLOW_REMOTE_DB: MOTIVO })).toThrow(
      /ALLOW_REMOTE_DB não autoriza endpoint de produção/,
    );
    expect(() => exigirAlvoDaBranch(REMOTO, {})).toThrow(/não para loopback/);
    expect(() => exigirAlvoDaBranch(REMOTO, { ALLOW_REMOTE_DB: MOTIVO })).not.toThrow();
  });

  it("o baseline aceita produção (leitura) mas recusa remoto sem motivo e URL inválida", () => {
    expect(() => exigirAlvoDoBaseline("PRODUCTION_READ_URL", PRODUCAO, {})).not.toThrow();
    expect(() => exigirAlvoDoBaseline("PRODUCTION_READ_URL", REMOTO, {})).toThrow(
      /não para loopback/,
    );
    expect(() =>
      exigirAlvoDoBaseline("PRODUCTION_READ_URL", REMOTO, { ALLOW_REMOTE_DB: MOTIVO }),
    ).not.toThrow();
    expect(() => exigirAlvoDoBaseline("PRODUCTION_READ_URL", "nao-e-url", {})).toThrow(
      /não é uma URL válida/,
    );
    expect(() => exigirAlvoDoBaseline("PRODUCTION_READ_URL", undefined, {})).toThrow(
      /é obrigatória/,
    );
  });

  it("o leitor do baseline reaproveita a política única, sem check ad-hoc de host", () => {
    // Se `exigirAlvoDoBaseline` reimplementasse a lista de produção em vez de
    // chamar `classificarAlvo`, trocar o prefixo no módulo de política deixaria de
    // valer para este reader — e este teste passaria ainda assim. Ancoramos o
    // reader no contrato compartilhado.
    expect(classificarAlvo(PRODUCAO, {}).modo).toBe("producao");
    expect(classificarAlvo(PRODUCAO, { ALLOW_REMOTE_DB: MOTIVO }).modo).toBe("producao");
    // E o outro lado segue com a recusa total de produção, que é a garantia de
    // que a branch do PR nunca é a baseline.
    expect(() =>
      exigirAlvoDeBanco("BRANCH_DIRECT_URL", PRODUCAO, { ALLOW_REMOTE_DB: MOTIVO }),
    ).toThrow();
  });
});
