import { createHash } from "node:crypto";

/**
 * Segredos **comprometidos conhecidos**, por hash SHA-256.
 *
 * ## Por que esta lista existe
 *
 * `requireAuthSecret` exige pelo menos 32 caracteres, e um valor vazado de 61
 * caracteres passa nessa validação: "tem 32 caracteres" nunca foi suficiente para
 * dizer que o segredo serve. O valor abaixo está no **histórico publicado** de um
 * repositório que hoje é público, recuperável por qualquer pessoa. A correção real
 * é rotacionar, e rotação é ação de console, não de código — enquanto ela não
 * acontece, o que o código pode fazer é **recusar o uso**.
 *
 * **Alcance exato da recusa, medido e não presumido — porque o alcance importa.**
 * `requireAuthSecret` é chamado por `createAuthInstance` (`auth.server.ts:22`), e
 * `getAuth` é **preguiçoso** (memoizado no primeiro uso, `auth.server.ts:121-124`).
 * Logo o guard **não** impede o processo de subir: ele impede que a instância de
 * autenticação seja **construída**. O efeito é fail-closed na prática — nenhuma
 * sessão é criada nem verificada com o segredo comprometido, e todo caminho que
 * toca auth falha alto em vez de servir — mas o momento é o primeiro toque em auth,
 * não o start. Uma versão anterior deste comentário dizia "a aplicação não sobe",
 * que é mais do que o código garante; a frase foi corrigida em vez de o código ser
 * esticado para caber nela.
 *
 * ## Por que hashes e nunca valores
 *
 * Guardar o valor seria reintroduzir a doença no remédio: recriaria o segredo no
 * arquivo que existe para neutralizá-lo, e num lugar a mais sem tratamento. O
 * `sha256` de um segredo de alta entropia não é reversível, e o confronto é
 * **exato** — sem prefixo e sem busca parcial, de propósito: um prefixo curto
 * transformaria esta lista num oráculo de confirmação para quem quisesse testar
 * candidatos.
 *
 * ## Como adicionar uma entrada
 *
 * Toda entrada carrega a origem e a data do vazamento. Ninguém deve precisar
 * perguntar de onde veio, e ninguém deve conseguir remover a entrada sem apagar a
 * razão dela.
 */
export const COMPROMISED_SECRET_SHA256: ReadonlySet<string> = new Set([
  // 61 caracteres, em `scripts/check-hostinger-runtime.mjs`; introduzido em
  // 26a2fdd, removido por ede2c89, e ainda recuperável no histórico público de
  // todas as refs. Rotação pendente (SEC-01): o valor segue válido como
  // credencial até que o emissor o troque, e é exatamente por isso que ele não
  // pode subir. Remover esta entrada exige rotação comprovada no emissor, não
  // edição de código.
  "71361bc1653d5ccb6279aa4cef29839f6f80bfbd1ee07c7bb8a24810d7bbf689",
]);

/** `sha256` em hex minúsculo — a forma canônica das chaves desta lista. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Devolve o hash comprometido que casa com o valor, ou `undefined` se ele não
 * estiver na lista. O conjunto é injetável para que o teste exercite o
 * **mecanismo** com hashes sintéticos, separado do teste que pina a **lista de
 * produção** — nenhum valor de segredo real precisa entrar em teste nenhum.
 */
export function findCompromisedSecretHash(
  secret: string,
  compromised: ReadonlySet<string> = COMPROMISED_SECRET_SHA256,
): string | undefined {
  const digest = sha256Hex(secret);
  return compromised.has(digest) ? digest : undefined;
}

/**
 * Mensagem única da recusa, sem o valor e sem o hash: quem lê o log precisa
 * saber **o que fazer** (rotacionar), e não ganhar um oráculo de qual hash casou.
 */
export const COMPROMISED_SECRET_MESSAGE =
  "BETTER_AUTH_SECRET é um valor comprometido conhecido (publicado no histórico do " +
  "repositório) e não pode ser usado: rotacione o segredo no emissor e configure o " +
  "valor novo";

/**
 * Lança se o valor estiver comprometido; devolve o valor quando não estiver.
 * Fail-closed por construção: não existe ramo que devolva um valor comprometido.
 */
export function assertSecretNotCompromised(secret: string): string {
  if (findCompromisedSecretHash(secret)) {
    throw new Error(COMPROMISED_SECRET_MESSAGE);
  }
  return secret;
}
