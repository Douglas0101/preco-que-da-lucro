import { describe, expect, it } from "vitest";
import { DB_ENV_KEYS, dbPrecondition, isLoopbackUrl, skipLabel } from "./helpers/db-precondition";

const LOOPBACK = "postgres://u:p@127.0.0.1:5432/db";
const REMOTO = "postgres://u:p@remote.example.com:5432/db";

function env(parcial: Partial<Record<(typeof DB_ENV_KEYS)[number], string>>): NodeJS.ProcessEnv {
  return { ...parcial } as NodeJS.ProcessEnv;
}

describe("precondição de banco — tudo ou nada, falha alta (WP-R6)", () => {
  it("sem nenhuma URL: desabilitado, com motivo nomeado", () => {
    const gate = dbPrecondition(env({}));
    expect(gate.enabled).toBe(false);
    expect(gate.enabled === false && gate.motivo).toContain("N/A-sem-DB");
    expect(skipLabel("x")).toBe("db-precondition: x");
  });

  it("as três URLs em loopback: habilitado", () => {
    const gate = dbPrecondition({
      DATABASE_ADMIN_URL: LOOPBACK,
      DATABASE_URL: LOOPBACK,
      DATABASE_URL_UNPOOLED: LOOPBACK,
    });
    expect(gate.enabled).toBe(true);
  });

  it("uma URL remota reprova em vez de pular em silêncio (o fail-open do WP-R6)", () => {
    expect(() =>
      dbPrecondition({
        DATABASE_ADMIN_URL: LOOPBACK,
        DATABASE_URL: REMOTO,
        DATABASE_URL_UNPOOLED: LOOPBACK,
      }),
    ).toThrow(/nao aponta para loopback/);
  });

  it("configuração parcial reprova nomeando a chave ausente", () => {
    expect(() => dbPrecondition({ DATABASE_ADMIN_URL: LOOPBACK })).toThrow(/DATABASE_URL ausente/);
    expect(() => dbPrecondition({ DATABASE_URL: REMOTO })).toThrow(/DATABASE_ADMIN_URL ausente/);
  });

  it("o motivo nomeia as chaves declaradas e o problema, não só um booleano", () => {
    try {
      dbPrecondition({ DATABASE_URL: REMOTO });
      throw new Error("deveria ter lançado");
    } catch (error) {
      const mensagem = (error as Error).message;
      expect(mensagem).toContain("DATABASE_URL");
      expect(mensagem).toContain("nao aponta para loopback");
      expect(mensagem).toContain("ou nenhuma");
    }
  });

  it("isLoopbackUrl distingue ausente de loopback (o booleano invertido do defeito)", () => {
    // A versão anterior devolvia `true` para `undefined`, o que fazia a expressão
    // `Boolean(admin) && isLoopback(admin) && isLoopback(undefined) && ...` valer `true`
    // com duas URLs ausentes.
    expect(isLoopbackUrl(undefined)).toBe(false);
    expect(isLoopbackUrl("")).toBe(false);
    expect(isLoopbackUrl(LOOPBACK)).toBe(true);
    expect(isLoopbackUrl("postgres://u:p@localhost:5432/db")).toBe(true);
    expect(isLoopbackUrl("postgres://u:p@[::1]:5432/db")).toBe(true);
    expect(isLoopbackUrl(REMOTO)).toBe(false);
    expect(isLoopbackUrl("nao-e-url")).toBe(false);
  });

  it("o conjunto de chaves exigidas é o das três URLs, sem lista implícita", () => {
    expect([...DB_ENV_KEYS]).toEqual([
      "DATABASE_ADMIN_URL",
      "DATABASE_URL",
      "DATABASE_URL_UNPOOLED",
    ]);
  });
});
