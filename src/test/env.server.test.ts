import { afterEach, describe, expect, it, vi } from "vitest";
import { readEnv } from "@/lib/env.server";

/**
 * Contrato direto de `readEnv` (DBT-97): "definida e vazia" conta como não
 * configurada, mas o valor devolvido nunca é aparado — quem valida credencial
 * continua rejeitando `" chave "`.
 *
 * O nome da sonda é propositalmente único: se a variável existisse no
 * `.env.local` do ambiente, a asserção de ausente passaria em falso.
 */
const PROBE = "DBT97_READ_ENV_PROBE";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readEnv: contrato de ausência", () => {
  it("devolve undefined quando a variável está ausente", () => {
    expect(process.env[PROBE]).toBeUndefined();
    expect(readEnv(PROBE)).toBeUndefined();
  });

  it("devolve undefined quando a variável está definida e vazia", () => {
    vi.stubEnv(PROBE, "");
    expect(process.env[PROBE]).toBe("");
    expect(readEnv(PROBE)).toBeUndefined();
  });

  it.each(["   ", "\t", "\n", " \t\n "])(
    "devolve undefined quando a variável só tem espaços: %j",
    (value) => {
      vi.stubEnv(PROBE, value);
      expect(readEnv(PROBE)).toBeUndefined();
    },
  );

  it("devolve o valor inalterado quando há conteúdo", () => {
    vi.stubEnv(PROBE, "chave-real");
    expect(readEnv(PROBE)).toBe("chave-real");
  });
});

describe("readEnv: controle negativo do valor aparado", () => {
  it("preserva os espaços das bordas — quem valida credencial precisa rejeitá-los", () => {
    vi.stubEnv(PROBE, " chave ");
    const value = readEnv(PROBE);
    expect(value).toBe(" chave ");
    expect(value).not.toBe("chave");
    expect(value?.length).toBe(7);
    expect(value?.startsWith(" ")).toBe(true);
    expect(value?.endsWith(" ")).toBe(true);
  });

  it("não aparar é o comportamento medido: '<vazio aparado>' continua utilizável", () => {
    vi.stubEnv(PROBE, "<vazio aparado>");
    expect(readEnv(PROBE)).toBe("<vazio aparado>");
  });
});

describe("readEnv: leitura de process.env", () => {
  it("acompanha a mutação do ambiente (valor novo, esvaziado e removido)", () => {
    vi.stubEnv(PROBE, "primeiro");
    expect(readEnv(PROBE)).toBe("primeiro");
    vi.stubEnv(PROBE, "segundo");
    expect(readEnv(PROBE)).toBe("segundo");
    vi.stubEnv(PROBE, "");
    expect(readEnv(PROBE)).toBeUndefined();
    vi.stubEnv(PROBE, undefined);
    expect(process.env[PROBE]).toBeUndefined();
    expect(readEnv(PROBE)).toBeUndefined();
  });

  it("não confunde ausência com vazio para dois nomes distintos", () => {
    vi.stubEnv(PROBE, "");
    const other = `${PROBE}_OTHER`;
    expect(process.env[other]).toBeUndefined();
    expect(readEnv(PROBE)).toBeUndefined();
    expect(readEnv(other)).toBeUndefined();
    vi.stubEnv(PROBE, "valor");
    expect(readEnv(PROBE)).toBe("valor");
    expect(readEnv(other)).toBeUndefined();
  });
});
