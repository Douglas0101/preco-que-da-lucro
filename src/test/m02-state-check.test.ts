import { describe, expect, it } from "vitest";
import {
  avaliarEstadoM02,
  ORCAMENTO_DE_FOLGA,
  type EntradaDaAvaliacao,
} from "../../scripts/m02-state-check";

/**
 * O núcleo de decisão é puro e injetável justamente para isto: exercitar os ramos
 * que a guarda **rejeita**. Uma guarda cuja decisão só se provou no caminho feliz
 * não se provou — e este check já ficou vermelho na maioria das execuções deste
 * repositório por exigir um re-pin por commit.
 */

const HEAD = "ffffffffffffffffffffffffffffffffffffffff";
const ANCESTRAL = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SECAO = "## Correção de estado M-02\n";

function entrada(over: Partial<EntradaDaAvaliacao> = {}): EntradaDaAvaliacao {
  return {
    ledger: `${SECAO}\nLatest state marker parent = \`${ANCESTRAL}\`,\n`,
    head: HEAD,
    raso: false,
    resolverCommit: (sha) => (sha === ANCESTRAL || sha === HEAD ? sha : undefined),
    ehAncestral: () => true,
    distancia: () => 0,
    ...over,
  };
}

describe("avaliarEstadoM02 — caminho feliz", () => {
  it("aceita marcador ancestral dentro do orçamento e reporta a folga", () => {
    const v = avaliarEstadoM02(entrada({ distancia: () => 7 }));
    expect(v.exit).toBe(0);
    if (v.exit !== 0) throw new Error("esperado 0");
    expect(v.tipo).toBe("ancestral");
    expect(v.distancia).toBe(7);
  });

  it("aceita o orçamento exatamente no limite (fronteira fechada à direita)", () => {
    expect(avaliarEstadoM02(entrada({ distancia: () => ORCAMENTO_DE_FOLGA })).exit).toBe(0);
  });

  it("aceita marcador `HEAD` = exato quando casa o HEAD", () => {
    const v = avaliarEstadoM02(entrada({ ledger: `${SECAO}\n\`HEAD\` = \`${HEAD}\`\n` }));
    expect(v.exit).toBe(0);
    if (v.exit !== 0) throw new Error("esperado 0");
    expect(v.tipo).toBe("exato");
  });
});

describe("avaliarEstadoM02 — as duas direções da fronteira", () => {
  it("reprova um commit além do orçamento, por um", () => {
    const v = avaliarEstadoM02(entrada({ distancia: () => ORCAMENTO_DE_FOLGA + 1 }));
    expect(v.exit).toBe(1);
    if (v.exit === 0) throw new Error("esperado violacao");
    expect(v.mensagem).toContain("orcamento");
  });

  it("reprova marcador que NÃO é ancestral, mesmo dentro do orçamento", () => {
    const v = avaliarEstadoM02(entrada({ ehAncestral: () => false, distancia: () => 1 }));
    expect(v.exit).toBe(1);
    if (v.exit === 0) throw new Error("esperado violacao");
    expect(v.mensagem).toContain("nao e ancestral");
  });

  it("reprova marcador irreconhecível (SHA fabricado) num clone completo", () => {
    const v = avaliarEstadoM02(entrada({ resolverCommit: () => undefined }));
    expect(v.exit).toBe(1);
    if (v.exit === 0) throw new Error("esperado violacao");
    expect(v.mensagem).toContain("nao resolve");
  });

  it("reprova marcador `HEAD` = exato que não é o HEAD corrente", () => {
    const v = avaliarEstadoM02(entrada({ ledger: `${SECAO}\n\`HEAD\` = \`${ANCESTRAL}\`\n` }));
    expect(v.exit).toBe(1);
    if (v.exit === 0) throw new Error("esperado violacao");
    expect(v.mensagem).toContain("nao e o HEAD atual");
  });

  it("reprova ledger sem a seção obrigatória", () => {
    const v = avaliarEstadoM02(
      entrada({ ledger: `Latest state marker parent = \`${ANCESTRAL}\`\n` }),
    );
    expect(v.exit).toBe(1);
    if (v.exit === 0) throw new Error("esperado violacao");
    expect(v.mensagem).toContain("secao obrigatoria");
  });

  it("reprova ledger sem marcador nenhum", () => {
    const v = avaliarEstadoM02(entrada({ ledger: SECAO }));
    expect(v.exit).toBe(1);
    if (v.exit === 0) throw new Error("esperado violacao");
    expect(v.mensagem).toContain("sem marcador");
  });
});

describe("avaliarEstadoM02 — pré-condição é exit 2, nunca 1", () => {
  it("clone raso é pré-condição: a ancestralidade é inverificável de princípio", () => {
    const v = avaliarEstadoM02(entrada({ raso: true }));
    expect(v.exit).toBe(2);
    if (v.exit === 0) throw new Error("esperado precondicao");
    expect(v.mensagem).toContain("clone raso");
  });

  it("clone raso vence até um marcador que seria violação: a causa é outra", () => {
    // Sem isto, um clone raso acusaria "SHA fabricado" — mentindo sobre a causa.
    const v = avaliarEstadoM02(
      entrada({ raso: true, resolverCommit: () => undefined, ehAncestral: () => false }),
    );
    expect(v.exit).toBe(2);
  });
});

describe("avaliarEstadoM02 — o último marcador é o que vale", () => {
  it("REGRESSÃO: citação histórica de `HEAD` em prosa datada não reprova o estado atual", () => {
    // Defeito real da primeira versão desta reescrita: o ledger guarda registros
    // de operador datados que citam `HEAD` = <sha> de meses atrás. Procurar cada
    // forma em separado tomava essa citação por afirmação de estado e produzia
    // uma violação FALSA. O marcador do fim é o que descreve o estado corrente.
    const ledger = [
      SECAO,
      "## Registro de operador — 2026-09-12",
      "",
      "`HEAD` = `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`",
      "",
      "## Bloco aditivo — ciclo 10",
      "",
      `Latest state marker parent = \`${ANCESTRAL}\`,`,
      "",
    ].join("\n");
    expect(avaliarEstadoM02(entrada({ ledger, distancia: () => 3 })).exit).toBe(0);
  });

  it("citação histórica sendo o ÚLTIMO marcador continua reprovando", () => {
    // A correção acima não pode virar porta dos fundos.
    const ledger = [SECAO, `\`HEAD\` = \`${ANCESTRAL}\``, ""].join("\n");
    expect(avaliarEstadoM02(entrada({ ledger })).exit).toBe(1);
  });

  it("um marcador antigo e válido NÃO resgata um recente e vencido", () => {
    const ledger = [
      SECAO,
      `Latest state marker parent = \`${ANCESTRAL}\`,`,
      "",
      "## Bloco mais recente",
      "",
      "Latest state marker parent = `cccccccccccccccccccccccccccccccccccccccc`,",
      "",
    ].join("\n");
    const v = avaliarEstadoM02(
      entrada({
        ledger,
        resolverCommit: (sha) => sha,
        ehAncestral: () => true,
        distancia: () => ORCAMENTO_DE_FOLGA + 5,
      }),
    );
    expect(v.exit).toBe(1);
    if (v.exit === 0) throw new Error("esperado violacao");
    expect(v.mensagem).toContain("cccccccc");
  });
});

describe("avaliarEstadoM02 — o orçamento é o contrato", () => {
  it("pina o orçamento declarado: mudá-lo muda o que a guarda cobra", () => {
    // Se alguém afrouxar o orçamento para forçar verde, este teste cai e obriga a
    // mudança a vir com a medição correspondente no comentário do script.
    expect(ORCAMENTO_DE_FOLGA).toBe(13);
  });

  it("aceita orçamento injetado, para que o teste não dependa do valor de produção", () => {
    expect(avaliarEstadoM02(entrada({ distancia: () => 4, orcamento: 3 })).exit).toBe(1);
    expect(avaliarEstadoM02(entrada({ distancia: () => 3, orcamento: 3 })).exit).toBe(0);
  });
});
