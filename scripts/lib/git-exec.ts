/**
 * Resolução do binário `git` para caminho absoluto, com pré-condição verificada em
 * runtime. Este módulo é o motivo de `S4036` ("Make sure the PATH variable only
 * contains fixed, unwriteable directories") ter uma resposta real neste repo.
 *
 * **O que a regra aponta, medido.** Em `contract-guard.ts:776` o `textRange` é
 * `startOffset 29 → endOffset 34` — cinco caracteres, exatamente o literal
 * `"git"`. O ponto marcado é o **nome do programa**, não a variável `PATH`. Por
 * isso o precedente `fdc0a17` (fixar `PATH` no `env` do `execFileSync`, como
 * `m02-state-check.ts` faz) **não satisfaz** esta versão da regra: as quatro
 * ocorrências continuaram abertas depois daquele conserto, e `upgrade-guard.ts`
 * até deslocou de `:573` para `:575` — o deslocamento das duas linhas do próprio
 * `env`, com a issue permanecendo no mesmo sítio. Fixar `PATH` é não responder.
 *
 * **Por que o nome literal é o problema.** `execFileSync("git", …)` resolve o
 * programa pelo `PATH` **ambiente**. Um diretório gravável por outros, à frente
 * do real, passa a fornecer o binário — e estas guardas decidem se a cadeia de
 * verificação roda. Passar um caminho absoluto elimina a resolução por `PATH`.
 *
 * **O contrato, e ele é fail-closed:**
 *   - só diretórios fixos do sistema, em lista literal (`DIRETORIOS_FIXOS`);
 *   - cada candidato é conferido: é arquivo, é executável, e o diretório que o
 *     contém **não é gravável por outros** (`o+w`);
 *   - o vencedor é canonicalizado com `realpathSync`, então um link simbólico
 *     apontando para fora não passa despercebido;
 *   - se nenhum servir, **lança**. Nunca cai no `PATH` ambiente: um guarda que
 *     degrada para o caminho que tentava eliminar é pior do que o original.
 *
 * `gravável por grupo` não desqualifica o candidato: o vetor de ataque é outro
 * usuário na máquina, não um colega de grupo, e `/usr/local/bin` é
 * `root:wheel 755` em qualquer instalação normal. Desqualificá-lo produziria
 * erro de pré-condição em máquinas legítimas para ganho zero.
 */

import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import { accessSync, constants, realpathSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Lista literal e versionada: é o contrato, não uma constante a deriving de
 * `process.env.PATH`. Acrescentar um diretório aqui é uma decisão de segurança
 * que precisa de revisão — e o motivo vai no comentário, ao lado.
 */
const DIRETORIOS_FIXOS = ["/usr/local/bin", "/usr/bin", "/bin"] as const;

/** `o+w` — gravável por qualquer usuário do sistema. */
const GRAVAVEL_POR_OUTROS = 0o002;

function gravavelPorOutros(dir: string): boolean {
  return (statSync(dir).mode & GRAVAVEL_POR_OUTROS) !== 0;
}

let resolvido: string | undefined;

/**
 * A tabela de decisão, isolada e injetável, para que os controles negativos sejam
 * verificáveis: dado um conjunto de diretórios, devolve o `git` aceitável ou
 * lança. `gitExecutable` é esta função com a lista real e memoização.
 *
 * A lista entra por parâmetro **por causa dos testes**, e isso é deliberado: uma
 * guarda cuja decisão não pode ser exercitada nos ramos que rejeita é uma guarda
 * que só se provou no caminho feliz.
 */
export function resolverGit(diretorios: readonly string[] = DIRETORIOS_FIXOS): string {
  const recusados: string[] = [];
  for (const dir of diretorios) {
    const candidato = join(dir, "git");
    try {
      if (!statSync(candidato).isFile()) {
        recusados.push(`${candidato} (não é arquivo)`);
        continue;
      }
      if (gravavelPorOutros(dir)) {
        recusados.push(`${candidato} (diretório gravável por outros)`);
        continue;
      }
      accessSync(candidato, constants.X_OK);
      return realpathSync(candidato);
    } catch {
      recusados.push(`${candidato} (inexistente ou sem permissão de execução)`);
    }
  }
  throw new Error(
    `precondicao de git invalida: nenhum executavel de git em diretorios fixos do sistema (${recusados.join("; ")}) — ` +
      `NUNCA recuar para o PATH ambiente; se o binario legitimo estiver em outro diretorio, acrescente-o em ` +
      `DIRETORIOS_FIXOS com o porque, em vez de reintroduzir a resolucao por PATH`,
  );
}

/**
 * Caminho absoluto e verificado do `git`, ou erro de pré-condição.
 *
 * O resultado é memoizado: a verificação envolve `statSync`/`accessSync` e o
 * chamador é uma guard que pode chamar isto em laço. Memoizar é seguro porque
 * um binário do sistema não muda de lugar no meio de uma execução — e se
 * mudasse, o próximo processo reavalia.
 */
export function gitExecutable(): string {
  if (resolvido === undefined) resolvido = resolverGit();
  return resolvido;
}

/**
 * `execFileSync` com o `git` já resolvido. Mesma assinatura de chamada, e o
 * `cwd`/`stdio` do chamador continua valendo — só o programa deixa de ser um
 * literal resolvido por `PATH`.
 */
export function gitSync(args: readonly string[], opcoes: ExecFileSyncOptions = {}): string {
  return execFileSync(gitExecutable(), [...args], { ...opcoes, encoding: "utf8" });
}
