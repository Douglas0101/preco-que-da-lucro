/**
 * Contrato de saída das server functions do BFF (DBT-25, plano §6.1).
 *
 * Existe por causa de um vazio medido, não por especulação: as 35 server
 * functions de `src/lib/*.functions.ts` validavam a **entrada** e nenhuma
 * validava a **saída**. O tipo TypeScript de retorno não é verificado em runtime
 * — trocar o serviço, o mapeador ou o driver muda o que sai da fronteira sem
 * que nada no repositório perceba.
 *
 * `outputSchema` é o **mecanismo**, e nenhum schema mora aqui: o contrato de
 * cada função é um schema Zod declarado **inline, no arquivo da própria server
 * function**, como manda [`CONTRACT-POLICY.md`](../../docs/upgrades/CONTRACT-POLICY.md).
 * Um diretório paralelo de contratos (`src/server/bff/contracts/`) é proibido
 * pelo `AGENTS.md`: duas convenções divergem sozinhas.
 *
 * Canal de falha: o repo **não** devolve envelope de erro do handler, ele lança.
 * `ApplicationError("DEPENDENCY_ERROR")` é capturado por `requireDatabaseAuth`
 * (`src/middleware/request-context.ts`), que mapeia o código para a resposta 503
 * do §6.9 e registra `bff.request_failed`. **INV-013:** falha de parse nunca vira
 * lista vazia nem `null` — o sucesso vazio é exatamente o defeito que este
 * contrato existe para tornar impossível.
 *
 * Limite declarado: o schema **não** é `.strict()`. Chave desconhecida é
 * removida (comportamento padrão do Zod), não reprovada: derrubar uma resposta
 * legítima por um campo a mais seria trocar um defeito silencioso por uma
 * indisponibilidade de 503 no caminho do dinheiro.
 */
import type { z } from "zod";
import { ApplicationError, errorCodeFromUnknown } from "@/lib/api-error";
import { logJson } from "@/lib/structured-logger";

/**
 * Valida o valor que o handler devolve contra o schema de saída da função.
 *
 * @param schema  contrato de saída, declarado no arquivo da própria função.
 * @param subject identificador estável para log (`arquivo.função`).
 * @param value   o valor cru que o handler ia devolver.
 * @returns o valor **parseado** (transformações do schema aplicadas).
 * @throws ApplicationError `DEPENDENCY_ERROR` — nunca devolve vazio no lugar do erro.
 */
export function outputSchema<S extends z.ZodType>(
  schema: S,
  subject: string,
  value: unknown,
): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    logJson("error", "bff.output_contract_violation", {
      subject,
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      })),
    });
    throw new ApplicationError("DEPENDENCY_ERROR", {
      message: `Contrato de saída violado em ${subject}.`,
      cause: parsed.error,
    });
  }
  return parsed.data;
}

/**
 * Produz o valor que {@link outputSchema} vai validar, **dentro** de uma fronteira
 * classificada.
 *
 * ## O defeito que isto fecha (N-1, ciclo 3)
 *
 * `outputSchema(schema, subject, rows.map(mapExpense))` parece validar a saída,
 * mas não valida o que pode dar errado: o terceiro argumento é avaliado **antes**
 * de a função ser chamada. Se o mapeador lançar — uma linha com `created_at` nulo,
 * um `params` que não é JSON, um decimal inválido —, o `TypeError`/`SyntaxError`
 * escapa **antes** de o contrato existir, e a violação nunca é registrada como
 * violação. O `errorCodeFromUnknown` não reconhece aquele erro, devolve
 * `INTERNAL_ERROR`, e `requireDatabaseAuth` o remapeia para `DATABASE_ERROR`.
 *
 * Consequência medida, e ela é sobre **código**, não sobre número: o status final
 * é 503 nos dois caminhos, mas o código é `DATABASE_ERROR` ("não foi possível
 * acessar os dados") em vez do `DEPENDENCY_ERROR` que o contrato promete, o evento
 * de log é `bff.request_failed` em vez de `bff.output_contract_violation`, e a
 * violação de contrato fica **invisível** em log e métrica. A afirmação "retorno
 * malformado ⇒ `DEPENDENCY_ERROR`" era falsa para essas formas.
 *
 * ## Por que não reclassificar tudo como `DEPENDENCY_ERROR`
 *
 * Seria a correção ingênua e criaria um defeito pior, em caminho que hoje
 * funciona. `errorCodeFromUnknown` preserva códigos que já são intencionais —
 * `NOT_FOUND` de um loader vira 404, `ZodError` vira `VALIDATION_ERROR` 400,
 * `ApplicationError` carrega o próprio código. Só o **não classificado**
 * (`INTERNAL_ERROR`) é que é, de fato, falha de produção de saída. Por isso a
 * ordem aqui é: repassa o que já tem código, e reclassifica apenas o resto.
 *
 * Aceita produtor síncrono e assíncrono porque em `listProducts` os mapeadores
 * rodam **dentro** de `loadProductReadModels`, e não na projeção que o handler
 * escreve — envolver só a projeção deixaria o defeito de pé justamente ali.
 *
 * @throws ApplicationError com o código que já existia, quando existe.
 * @throws ApplicationError `DEPENDENCY_ERROR` quando o produtor lança algo que a
 *         taxonomia não classifica.
 */
export async function produceOutput<T>(
  subject: string,
  build: () => T | Promise<T>,
): Promise<Awaited<T>> {
  try {
    return await build();
  } catch (cause) {
    if (cause instanceof ApplicationError) throw cause;
    const code = errorCodeFromUnknown(cause);
    if (code !== "INTERNAL_ERROR") throw new ApplicationError(code, { cause });
    logJson("error", "bff.output_mapping_failed", { subject, error: cause });
    throw new ApplicationError("DEPENDENCY_ERROR", {
      message: `Falha ao produzir a saída de ${subject}.`,
      cause,
    });
  }
}
