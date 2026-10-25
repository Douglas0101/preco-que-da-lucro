import { describe, expect, it } from "vitest";
import {
  CSP_NONCE_PATTERN,
  currentCspNonce,
  isValidCspNonce,
  mintCspNonce,
  withCspNonce,
} from "@/lib/csp/nonce.server";

/**
 * Épico A — ADR-048 §Decisão 1 e §Decisão 8.
 *
 * U1, U4 e U5 da spec (`docs/evidence/csp-spec-2026-10-25/SPEC.md`) cobrem o módulo de
 * nonce isoladamente. U2/U3 (threading em `getRouter`) entram no PR de wiring, quando o
 * WIP alheio liberar `security-headers.ts`/`start.ts`.
 */
describe("nonce de CSP por requisição", () => {
  it("U1: 22 caracteres base64url, 128 bits, sem repetição em 1000 amostras", () => {
    const amostras = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      const nonce = mintCspNonce();
      expect(nonce).toMatch(CSP_NONCE_PATTERN);
      expect(nonce).toHaveLength(22);
      amostras.add(nonce);
    }
    expect(amostras.size).toBe(1000);
  });

  it("U1b: contexto aninhado restaura o nonce externo ao sair", () => {
    const externo = mintCspNonce();
    const interno = mintCspNonce();

    withCspNonce(externo, () => {
      expect(currentCspNonce()).toBe(externo);
      withCspNonce(interno, () => {
        expect(currentCspNonce()).toBe(interno);
      });
      expect(currentCspNonce()).toBe(externo);
    });
  });

  it("U3 (premissa): fora de contexto não existe nonce residual", () => {
    expect(currentCspNonce()).toBeUndefined();
    withCspNonce(mintCspNonce(), () => undefined);
    expect(currentCspNonce()).toBeUndefined();
  });

  it("U4: dois contextos concorrentes não vazam nonce entre si", async () => {
    const a = mintCspNonce();
    const b = mintCspNonce();
    const espera = () => new Promise((resolve) => setTimeout(resolve, 5));

    const ler = (nonce: string, atraso: number) =>
      withCspNonce(nonce, async () => {
        await espera();
        const primeira = currentCspNonce();
        await new Promise((resolve) => setTimeout(resolve, atraso));
        return [primeira, currentCspNonce()];
      });

    const [leiturasA, leiturasB] = await Promise.all([ler(a, 1), ler(b, 12)]);

    expect(leiturasA).toEqual([a, a]);
    expect(leiturasB).toEqual([b, b]);
    expect(a).not.toBe(b);
  });

  it("U4b: devolve o valor do callback e propaga exceção sem vazar o contexto", () => {
    const nonce = mintCspNonce();
    expect(withCspNonce(nonce, () => "resultado")).toBe("resultado");

    const erro = new Error("falha");
    expect(() =>
      withCspNonce(nonce, () => {
        throw erro;
      }),
    ).toThrow(erro);
    expect(currentCspNonce()).toBeUndefined();
  });

  it("U5: nonce fora do formato é recusado e não estabelece contexto (fail-closed)", () => {
    const invalidos: unknown[] = [
      "",
      "x",
      "a".repeat(21),
      "a".repeat(23),
      "a b c d e f g h i j k l",
      "<script>alert(1)</script>",
      "AAAAAAAAAAAAAAAAAAAAA=",
      "á".repeat(22),
      undefined,
      null,
      42,
      {},
    ];

    for (const invalido of invalidos) {
      expect(isValidCspNonce(invalido), `aceitou ${JSON.stringify(invalido)}`).toBe(false);
      const observado = withCspNonce(invalido as string, () => currentCspNonce());
      expect(observado, `estabeleceu contexto com ${JSON.stringify(invalido)}`).toBeUndefined();
    }

    expect(isValidCspNonce(mintCspNonce())).toBe(true);
  });

  it("U5c: dentro de um escopo válido, a recusa não herda o nonce do pai", () => {
    const externo = mintCspNonce();
    const observados: Array<string | undefined> = [];

    withCspNonce(externo, () => {
      expect(currentCspNonce()).toBe(externo);
      for (const invalido of [undefined, "x", "a b c d e f g h i j k l"]) {
        withCspNonce(invalido, () => observados.push(currentCspNonce()));
      }
      expect(currentCspNonce()).toBe(externo);
    });

    expect(observados).toEqual([undefined, undefined, undefined]);
    expect(currentCspNonce()).toBeUndefined();
  });

  it("U5b: recusa registra código fixo e nunca serializa o valor recebido", () => {
    const registros: string[] = [];
    const espiao = (linha: unknown) => registros.push(String(linha));
    const original = { log: console.log, warn: console.warn, error: console.error };
    console.log = espiao;
    console.warn = espiao;
    console.error = espiao;

    try {
      const hostil = "nao-e-nonce-<script>alert(1)</script>";
      withCspNonce(hostil, () => undefined);
      withCspNonce(undefined, () => undefined);
    } finally {
      console.log = original.log;
      console.warn = original.warn;
      console.error = original.error;
    }

    expect(registros).toHaveLength(1);
    expect(registros[0]).toContain("csp.nonce_rejected");
    expect(registros[0]).toContain('"reason":"format"');
    expect(registros[0]).not.toContain("nao-e-nonce");
  });
});
