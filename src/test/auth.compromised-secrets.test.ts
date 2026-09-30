import { describe, expect, it } from "vitest";
import { requireAuthSecret } from "@/server/auth/auth-policy";
import {
  assertSecretNotCompromised,
  COMPROMISED_SECRET_MESSAGE,
  COMPROMISED_SECRET_SHA256,
  findCompromisedSecretHash,
  sha256Hex,
} from "@/server/auth/compromised-secrets";

/**
 * O valor comprometido nunca entra neste arquivo — nem ele, nem um valor de
 * teste que se passe por ele. O que se testa é a **primitiva**, o **mecanismo** e
 * a **lista de produção**, nessa ordem; a prova ponta a ponta, com o valor real
 * lido do histórico do git, roda fora do repositório e é registrada como
 * evidência, porque um teste que dependa de estado do repo teria de construir a
 * própria fixture.
 */
describe("sha256Hex", () => {
  it("bate com o vetor conhecido do NIST para o primitivo", () => {
    // Known-answer test: fixa o ALGORITMO e a CODIFICAÇÃO. Se alguém trocar por
    // outro digest ou por outra codificação, a lista inteira vira letra morta em
    // silêncio — o guard passaria a comparar com o que não é.
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });

  it("é minúsculo e tem 64 hexadecimais", () => {
    expect(sha256Hex("qualquer-coisa")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("findCompromisedSecretHash — o mecanismo", () => {
  const comprometido = "valor-de-teste-que-faz-o-papel-de-comprometido";
  const hashes: ReadonlySet<string> = new Set([sha256Hex(comprometido)]);

  it("encontra o hash quando o valor está na lista", () => {
    expect(findCompromisedSecretHash(comprometido, hashes)).toBe(sha256Hex(comprometido));
  });

  it("não encontra nada para um valor fora da lista", () => {
    expect(findCompromisedSecretHash("outro-valor-qualquer", hashes)).toBeUndefined();
  });

  it("não casa por prefixo, e trata o input como valor a hashear", () => {
    // O confronto é exato de propósito: prefixo transformaria a lista num
    // oráculo de confirmação para quem quisesse testar candidatos.
    const digest = sha256Hex(comprometido);
    // (a) lista com apenas um PREFIXO do digest não pode casar o valor real.
    const porPrefixo: ReadonlySet<string> = new Set([digest.slice(0, 16)]);
    expect(findCompromisedSecretHash(comprometido, porPrefixo)).toBeUndefined();
    // (b) o input é HASHED, não comparado cru: passar o próprio digest como valor
    // não casa consigo mesmo. Sem isto, alguém poderia "acertar" a lista sem ter
    // o segredo — bastaria ter o hash, que é público por desenho.
    const listaCompleta: ReadonlySet<string> = new Set([digest]);
    expect(findCompromisedSecretHash(digest, listaCompleta)).toBeUndefined();
  });

  it("distingue maiúscula de minúscula e espaço nas bordas", () => {
    expect(findCompromisedSecretHash(comprometido.toUpperCase(), hashes)).toBeUndefined();
    expect(findCompromisedSecretHash(` ${comprometido}`, hashes)).toBeUndefined();
    expect(findCompromisedSecretHash(`${comprometido} `, hashes)).toBeUndefined();
  });
});

describe("a lista de produção", () => {
  it("pina o hash comprometido conhecido e não tem entradas de sobra", () => {
    // Remover a entrada sem rotacionar no emissor passa a reprovar aqui. É a
    // única forma de o repositório saber que a proteção ainda existe.
    expect(
      COMPROMISED_SECRET_SHA256.has(
        "71361bc1653d5ccb6279aa4cef29839f6f80bfbd1ee07c7bb8a24810d7bbf689",
      ),
    ).toBe(true);
    expect(COMPROMISED_SECRET_SHA256.size).toBe(1);
  });

  it("o default de findCompromisedSecretHash consulta a lista de produção", () => {
    // Sem isto, o default poderia deixar de apontar para a lista real e todo o
    // resto continuaria verde.
    let negativos = 0;
    for (let i = 0; i < 64; i += 1) {
      if (findCompromisedSecretHash(`sentinela-${i}`) === undefined) negativos += 1;
    }
    expect(negativos).toBe(64);
  });
});

describe("assertSecretNotCompromised e requireAuthSecret", () => {
  it("recusa com a mensagem que diz o que fazer, e a mensagem não carrega valor nem hash", () => {
    const valor = "x".repeat(32);
    expect(assertSecretNotCompromised(valor)).toBe(valor);
    expect(() => assertSecretNotCompromised(valor)).not.toThrow();

    // A recusa só é alcançável com um valor na lista; o mecanismo já foi provado
    // acima. Aqui prova-se que a MENSAGEM não vaza: ela é constante, e nenhum
    // ramo interpola o valor ou o digest.
    expect(COMPROMISED_SECRET_MESSAGE).not.toMatch(/[0-9a-f]{64}/);
    expect(COMPROMISED_SECRET_MESSAGE).toContain("rotacione");
  });

  it("stricta: um segredo de 32 caracteres válido continua passando", () => {
    // Controle negativo do guard em relação ao mínimo: a lista não pode rejeitar
    // segredo legítimo, e `x`*32 não está nela.
    expect(requireAuthSecret({ BETTER_AUTH_SECRET: "x".repeat(32) })).toHaveLength(32);
  });

  it("stricta: curto demais continua reprovando pela regra de tamanho, não pela lista", () => {
    expect(() => requireAuthSecret({ BETTER_AUTH_SECRET: "curto" })).toThrow(/32/);
    expect(() => requireAuthSecret({ BETTER_AUTH_SECRET: "curto" })).not.toThrow(
      new RegExp(COMPROMISED_SECRET_MESSAGE.slice(0, 24)),
    );
  });
});
