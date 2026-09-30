import { describe, expect, it } from "vitest";
import { classificarAlvo, exigirAlvoDeBanco } from "../../scripts/lib/db-target";

/**
 * `scripts/lib/db-target.ts` — a política que substitui as quatro cópias de
 * `assertLoopback`. O valor deste arquivo está nos ramos de **recusa**, e é por
 * isso que `classificarAlvo` expõe a decisão e `exigirAlvoDeBanco` a transforma em
 * erro: são os ramos que podem falhar que precisam ser exercitados, não só o que
 * dá certo.
 */
const LOOPBACK = "postgres://u:p@127.0.0.1:5432/db";
const REMOTO = "postgres://u:p@ep-frosty-bread-ayi2pg4p.c-5.us-east-2.aws.neon.tech/db";
const PRODUCAO = "postgres://u:p@ep-long-violet-aye9g0bn.c-5.us-east-2.aws.neon.tech/db";
const MOTIVO = "CI Neon PR branch 49 — integração em branch efêmera (§26)";

describe("db-target — política de alvo", () => {
  it("loopback é aceito sem override", () => {
    expect(classificarAlvo(LOOPBACK, {})).toEqual({
      ok: true,
      modo: "loopback",
      host: "127.0.0.1",
    });
  });

  it("URL ausente passa — quem exige a URL é o chamador", () => {
    expect(classificarAlvo(undefined, {})).toEqual({ ok: true, modo: "ausente", host: null });
    expect(() => exigirAlvoDeBanco("DATABASE_URL", undefined, {})).not.toThrow();
  });

  it("as grafias que o libpq aceita contam como loopback (a cópia antiga recusava)", () => {
    // A divergência medida entre a cópia e `isLoopbackUrl`: `127.1` e `LOCALHOST`
    // são loopback para o libpq e eram recusados pelas quatro cópias.
    for (const url of [
      "postgres://u:p@127.1:5432/db",
      "postgres://u:p@LOCALHOST:5432/db",
      "postgres://u:p@127.0.0.1.:5432/db",
      "postgres://u:p@[::1]:5432/db",
    ]) {
      expect(classificarAlvo(url, {}).ok, url).toBe(true);
    }
  });

  it("remoto SEM motivo é recusado, nomeando o host", () => {
    expect(() => exigirAlvoDeBanco("DATABASE_ADMIN_URL", REMOTO, {})).toThrow(
      /aponta para "ep-frosty-bread-ayi2pg4p[^"]*", não para loopback/,
    );
  });

  it("remoto COM motivo é aceito — é o caso que o CI executa", () => {
    expect(classificarAlvo(REMOTO, { ALLOW_REMOTE_DB: MOTIVO }).modo).toBe("override");
    expect(() =>
      exigirAlvoDeBanco("DATABASE_ADMIN_URL", REMOTO, { ALLOW_REMOTE_DB: MOTIVO }),
    ).not.toThrow();
  });

  it('o predicado é motivo não-vazio, não `=== "true"`', () => {
    // O workflow grava uma frase. Um predicado booleano jamais casaria, e uma
    // concessão que não dispara é pior que nenhuma.
    expect(classificarAlvo(REMOTO, { ALLOW_REMOTE_DB: "true" }).modo).toBe("override");
    for (const vazio of ["", "   "]) {
      expect(classificarAlvo(REMOTO, { ALLOW_REMOTE_DB: vazio }).modo).toBe("remoto");
    }
  });

  it("PRODUÇÃO é recusada COM motivo — e este é o controle de não-vacuidade", () => {
    // Sem este caso, o teste anterior passaria também se o override fosse um
    // `return` incondicional, que é o buraco que ele não pode ser.
    expect(() =>
      exigirAlvoDeBanco("DATABASE_ADMIN_URL", PRODUCAO, { ALLOW_REMOTE_DB: MOTIVO }),
    ).toThrow(/ALLOW_REMOTE_DB não autoriza endpoint de produção/);
  });

  it("URL inválida é recusada como inválida, não como remota", () => {
    expect(classificarAlvo("nao-e-url", {}).modo).toBe("invalido");
    expect(() => exigirAlvoDeBanco("DATABASE_URL", "nao-e-url", {})).toThrow(
      /não é uma URL válida — recusando por segurança/,
    );
  });

  it("bind-wildcard `0.0.0.0` continua recusado: não é loopback", () => {
    expect(classificarAlvo("postgres://u:p@0.0.0.0:5432/db", {}).modo).toBe("remoto");
  });
});
