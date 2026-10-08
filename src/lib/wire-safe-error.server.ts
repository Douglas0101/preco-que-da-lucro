import { ApplicationError, apiErrorMessage } from "@/lib/api-error";
import { logJson } from "@/lib/structured-logger";

/**
 * Fronteira de saída dos server functions: o que pode cruzar a rede.
 *
 * O framework serializa `error.message` para o navegador e as telas de chat
 * renderizam esse texto como fala do consultor. Medido no preview
 * `dpl_CJydCmNNQYFoXELpbQd9d2w5s8m8`: o guard anti-SSRF entregou
 * `AI gateway endpoint recusado pelo guard (https público obrigatório):
 * URL inválida:` direto no log da conversa do usuário — diagnóstico interno
 * virou texto de produto. Aqui o que cruza é a mensagem da política
 * (`apiErrorMessage`), o detalhe fica no log do servidor com o `correlationId`
 * e o erro original segue como `cause` para quem capturar no servidor.
 *
 * Erros que não são `ApplicationError` passam intactos: `Response` (redirect de
 * auth) e falhas de framework não são reescritas.
 */
export function toWireSafeError(error: unknown, correlationId: string): unknown {
  if (!(error instanceof ApplicationError)) return error;
  if (error.message !== apiErrorMessage(error.code)) {
    logJson("error", "app.error_internal_detail", {
      correlationId,
      code: error.code,
      detail: error.message,
    });
  }
  return new ApplicationError(error.code, { cause: error });
}

/** Açúcar para o handler inteiro: roda e traduz a falha na fronteira. */
export async function withWireSafeErrors<T>(
  correlationId: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw toWireSafeError(error, correlationId);
  }
}
