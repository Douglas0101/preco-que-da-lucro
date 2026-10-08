import { describe, expect, it, vi } from "vitest";
import { ApplicationError } from "@/lib/api-error";
import { toWireSafeError, withWireSafeErrors } from "@/lib/wire-safe-error.server";

const INTERNAL_DETAIL =
  "AI gateway endpoint recusado pelo guard (https público obrigatório): URL inválida: ";

describe("fronteira de erro dos server functions de chat", () => {
  it("troca o detalhe interno pela mensagem de política e preserva código e causa", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const original = new ApplicationError("DEPENDENCY_ERROR", { message: INTERNAL_DETAIL });

    const wire = toWireSafeError(original, "corr-1");

    expect(wire).toBeInstanceOf(ApplicationError);
    const appError = wire as ApplicationError;
    expect(appError.code).toBe("DEPENDENCY_ERROR");
    expect(appError.message).toBe("Um serviço necessário está indisponível.");
    expect(appError.message).not.toContain("guard");
    expect(appError.cause).toBe(original);

    // O detalhe não se perde: ele sai no log do servidor com o correlationId.
    const logged = errorSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).toContain("app.error_internal_detail");
    expect(logged).toContain("corr-1");
    expect(logged).toContain("URL inválida");
    errorSpy.mockRestore();
  });

  it("não reescreve o que não é ApplicationError", () => {
    // Limite declarado (DBT-97): erro genérico não é mascarado aqui porque o
    // controle de fluxo do framework (redirect/notFound) também lança valores
    // não-ApplicationError, e reescrevê-los trocaria a página renderizada.
    const redirect = new Response(null, { status: 307 });
    expect(toWireSafeError(redirect, "corr-2")).toBe(redirect);
    const generic = new Error('Failed query: insert into "rate_limits"');
    expect(toWireSafeError(generic, "corr-3")).toBe(generic);
  });

  it("withWireSafeErrors devolve sucesso e traduz a falha na fronteira", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(withWireSafeErrors("corr-4", async () => "ok")).resolves.toBe("ok");
    await expect(
      withWireSafeErrors("corr-5", async () => {
        throw new ApplicationError("AI_TIMEOUT", { message: "ct_1: abortado na rodada 2" });
      }),
    ).rejects.toMatchObject({
      code: "AI_TIMEOUT",
      message: "A IA demorou mais que o permitido.",
    });
    errorSpy.mockRestore();
  });

  it("não registra nada quando a mensagem já é a de política", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const wire = toWireSafeError(new ApplicationError("DEPENDENCY_ERROR"), "corr-6");
    expect((wire as ApplicationError).message).toBe("Um serviço necessário está indisponível.");
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
