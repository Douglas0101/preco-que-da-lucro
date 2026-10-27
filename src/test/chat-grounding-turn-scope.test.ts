// Escopo de TURNO do fallback de grounding financeiro.
//
// POR QUE ESTE ARQUIVO EXISTE
// `src/lib/ai/financial-output-grounding.ts` decide o que o fallback afirma
// olhando as mensagens que LHE SÃO ENTREGUES (`registeredLabels`, linhas
// 59-73). Quem entrega é `src/lib/chat-execution.server.ts`: o histórico vem
// de `buildInitialMessages` (linhas 213-227) e o grounding é aplicado sobre o
// MESMO array (linha 416).
//
// A auditoria mediu dois riscos que nenhuma prova cobria:
//   (A) o que vira rótulo: só tool `ok:true` com nome na allowlist;
//   (B) o escopo: uma tool message de TURNO ANTERIOR não pode aparecer no
//        fallback do turno corrente — se aparecesse, o fallback affirmaria
//        "o registro foi feito" por causa de um registro que não foi deste
//        turno.
//
// (A) e (B) são UM contrato só: um fallback que diz a verdade sobre o turno
// precisa saber o que o turno registrou, e só o turno. Este arquivo prova os
// dois ao mesmo tempo.
//
// A prova de (B) é ancorada na FONTE de produção: o filtro de replay é lido
// do arquivo real e aplicado ao fixture. Se a produção passar a reproduzir
// mensagens de tool (ou `tool_calls`) do histórico, o filtro muda, a
// asserção de igualdade de conjunto quebra e o teste reprova — em vez de um
// teste que continua verde porque reimplementa a regra antiga.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  UNGROUNDED_FINANCIAL_REPLY,
  groundFinancialOutput,
  ungroundedFinancialReply,
} from "@/lib/ai/financial-output-grounding";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = readFileSync(resolve(root, "src/lib/chat-execution.server.ts"), "utf8");

/** Corpo da função que monta as mensagens iniciais (histórico + system). */
function buildInitialMessagesBody(): string {
  const inicio = source.indexOf("function buildInitialMessages");
  const fim = source.indexOf("function persistAssistantMessage");
  if (inicio === -1 || fim === -1 || fim <= inicio) {
    throw new Error("buildInitialMessages não localizado em chat-execution.server.ts");
  }
  return source.slice(inicio, fim);
}

const corpoBuild = buildInitialMessagesBody();

/** Papéis que a produção replaya do histórico (lido da fonte, não reescrito). */
const papeisReplayados: string[] = [...corpoBuild.matchAll(/message\.role === "([a-z]+)"/g)].map(
  (m) => m[1] as string,
);

interface HistoricoMessage {
  role: string;
  content: string;
  tool_calls?: Array<{ id: string; function: { name: string } }>;
  tool_call_id?: string;
}

/**
 * Reproduz o replay do histórico aplicando o filtro LIDO da produção.
 *
 * Não é uma reimplementação da regra: o conjunto de papéis vem do arquivo
 * real. Se a produção mudar o filtro, esta função muda junto — e a
 * asserção de igualdade abaixo é que reprova.
 */
function replayDoHistorico(
  historico: HistoricoMessage[],
): Array<{ role: string; content: string }> {
  return historico
    .filter((mensagem) => papeisReplayados.includes(mensagem.role))
    .map((mensagem) => ({ role: mensagem.role, content: mensagem.content }));
}

const user = (content: string) => ({ role: "user", content });
const assistantComCalls = (calls: Array<[string, string]>) => ({
  role: "assistant",
  content: "",
  tool_calls: calls.map(([id, name]) => ({ id, function: { name } })),
});
const tool = (id: string, value: unknown) => ({
  role: "tool",
  tool_call_id: id,
  content: JSON.stringify(value),
});

describe("fallback financeiro — o que vira rótulo (invariante A)", () => {
  it("tool `ok:true` com nome na allowlist vira rótulo", () => {
    const reply = ungroundedFinancialReply([
      assistantComCalls([["call-1", "create_product"]]),
      tool("call-1", { ok: true, result: { id: "00000000-0000-4000-8000-000000000010" } }),
    ]);
    expect(reply).toContain("o produto");
    expect(reply).not.toMatch(/Nenhum dado foi registrado/i);
  });

  it("tool `ok:false` não vira rótulo", () => {
    expect(
      ungroundedFinancialReply([
        assistantComCalls([["call-1", "create_product"]]),
        tool("call-1", { ok: false, error: { code: "VALIDATION_ERROR" } }),
      ]),
    ).toBe(UNGROUNDED_FINANCIAL_REPLY);
  });

  it("tool com nome FORA da allowlist não vira rótulo", () => {
    expect(
      ungroundedFinancialReply([
        assistantComCalls([["call-1", "search_products"]]),
        tool("call-1", { ok: true, result: { id: "x" } }),
      ]),
    ).toBe(UNGROUNDED_FINANCIAL_REPLY);
  });

  it("payload inválido (JSON ilegível) não vira rótulo", () => {
    expect(
      ungroundedFinancialReply([
        assistantComCalls([["call-1", "create_product"]]),
        { role: "tool", tool_call_id: "call-1", content: "isto não é json" },
      ]),
    ).toBe(UNGROUNDED_FINANCIAL_REPLY);
  });

  it("tool message sem `tool_call_id` (ou sem call correspondente) não vira rótulo", () => {
    expect(
      ungroundedFinancialReply([
        assistantComCalls([["call-1", "create_product"]]),
        { role: "tool", content: JSON.stringify({ ok: true, result: { id: "x" } }) },
      ]),
    ).toBe(UNGROUNDED_FINANCIAL_REPLY);
    expect(
      ungroundedFinancialReply([
        assistantComCalls([["call-1", "create_product"]]),
        tool("outro-id", { ok: true, result: { id: "x" } }),
      ]),
    ).toBe(UNGROUNDED_FINANCIAL_REPLY);
  });
});

describe("fallback financeiro — escopo de turno (invariante B)", () => {
  it("a produção replaya do histórico apenas `user`, `assistant` e `system`", () => {
    // Igualdade de conjunto: um papel novo no replay (em especial `tool`)
    // reprova aqui — é o filtro que segura a invariante de turno.
    expect([...papeisReplayados].sort()).toEqual(["assistant", "system", "user"]);
    // E o replay copia só role + content: `tool_calls` do histórico não viaja.
    expect(corpoBuild).toContain("messages.push({ role: message.role, content: message.content })");
    expect(corpoBuild).not.toContain("tool_calls");
  });

  it("o grounding é aplicado sobre o MESMO array montado pelo replay do histórico", () => {
    expect(source).toContain("const messages = buildInitialMessages(state);");
    expect(source).toContain("groundFinancialOutput(sanitized, messages)");
  });

  it("CONTROLE: as tool messages de um turno anterior SERIAM rótulo se entrassem no array", () => {
    // Sem este controle, o teste seguinte passaria por vacuidade: bastaria
    // que as tool messages nunca produzissem rótulo. Elas produzem — o que
    // torna o filtro de replay a única coisa que segura a invariante.
    const turnoAnterior = [
      user("O produto é Bolo de Cenoura"),
      assistantComCalls([["call-1", "create_product"]]),
      tool("call-1", { ok: true, result: { id: "00000000-0000-4000-8000-000000000010" } }),
    ];
    expect(ungroundedFinancialReply(turnoAnterior)).toContain("o produto");
  });

  it("tool message de turno anterior NÃO é reproduzida nem vira registro do turno corrente", () => {
    const historico: HistoricoMessage[] = [
      user("O produto é Bolo de Cenoura"),
      assistantComCalls([["call-1", "create_product"]]),
      tool("call-1", { ok: true, result: { id: "00000000-0000-4000-8000-000000000010" } }),
    ];
    const replay = replayDoHistorico(historico);
    // A tool message do turno anterior não sobrevive ao replay...
    expect(replay.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(replay.some((m) => m.role === "tool")).toBe(false);
    // ...e por isso o fallback do turno corrente não afirma registro algum.
    expect(ungroundedFinancialReply(replay)).toBe(UNGROUNDED_FINANCIAL_REPLY);
  });

  it("o turno corrente só afirma o que ELE registrou", () => {
    const historico: HistoricoMessage[] = [
      user("O produto é Bolo de Cenoura"),
      assistantComCalls([["call-1", "create_product"]]),
      tool("call-1", { ok: true, result: { id: "00000000-0000-4000-8000-000000000010" } }),
    ];
    const replay = replayDoHistorico(historico);
    // Turno corrente: a tool do turno anterior foi removida; a tool DELE
    // (set_yield) é a única que pode virar rótulo.
    const turnoCorrente = [
      ...replay,
      assistantComCalls([["call-2", "set_yield"]]),
      tool("call-2", { ok: true, result: { yieldQty: "12" } }),
    ];
    const reply = ungroundedFinancialReply(turnoCorrente);
    expect(reply).toContain("o registro foi feito: o rendimento");
    expect(reply).not.toMatch(/o registro foi feito: o produto/);
  });

  it("a resposta do grounding bloqueia a figura e o fallback não herda o registro anterior", () => {
    const historico: HistoricoMessage[] = [
      user("O produto é Bolo de Cenoura"),
      assistantComCalls([["call-1", "create_product"]]),
      tool("call-1", { ok: true, result: { id: "00000000-0000-4000-8000-000000000010" } }),
    ];
    const grounded = groundFinancialOutput("A margem fica em 30%.", replayDoHistorico(historico));
    expect(grounded.blocked).toBe(true);
    expect(grounded.content).toBe(UNGROUNDED_FINANCIAL_REPLY);
    // O fallback NÃO afirma registro (a frase "nome do produto" do texto
    // substituto é orientação de entrada de dado, não afirmação de registro).
    expect(grounded.content).toMatch(/Nenhum dado foi registrado/i);
    expect(grounded.content).not.toMatch(/o registro foi feito/i);
    // O bloqueio continua: figura sem lastro não passa mesmo com histórico.
    expect(grounded.unsupportedCount).toBeGreaterThan(0);
  });
});
