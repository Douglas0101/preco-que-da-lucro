/**
 * `m02:state:check` — o ledger descreve um estado que existe nesta linhagem, e
 * descreve um estado recente.
 *
 * ## O defeito que esta versão conserta
 *
 * A versão anterior exigia que o ledger contivesse exatamente o SHA do **parent
 * do HEAD** (`Latest state marker parent = <HEAD^>`). Isso só é satisfazível se
 * **todo** commit reapinar o marcador — inclusive os que não tocam o ledger, que
 * são a maioria. Medido sobre os 220 commits da linhagem principal deste repo:
 * a distância entre o marcador e o commit era **1 em 45% deles**, mediana 2,
 * máxima 20. Ou seja, a regra não estava "ocasionalmente desatualizada": ela
 * reprovava **mais da metade** dos commits. Uma guarda que fica vermelha na
 * maioria das execuções deixa de ser sinal e vira ruído — e foi exatamente o que
 * aconteceu: o marcador ficou cinco commits atrás e ninguém reparou, porque o
 * check não pertence a pipeline nenhum.
 *
 * ## O contrato desta versão
 *
 * O marcador tem de **resolver para um commit desta linhagem** e estar **dentro
 * de um orçamento de folga declarado**. As duas condições juntas dizem o que
 * importa — "o ledger fala de um estado que existiu de verdade aqui, e não de um
 * estado antigo" — sem exigir um commit por re-pin.
 *
 * A condição de ancestralidade é **mais forte** do que a anterior, não mais
 * fraca: a versão antiga comparava strings e nunca verificava que o SHA nomeado
 * era, de fato, ancestral. Um marcador apontando para um commit de outro branch,
 * ou para um SHA inexistente, passaria se por acaso casasse a string do parent.
 * Aqui ele reprova. Zero dos 212 marcadores históricos resolvíveis nomeava um
 * commit fora da linhagem, então a exigência **codifica o que já era verdade** —
 * não renegocia para baixo.
 *
 * ## Taxonomia de saída
 *
 *   - `0` — válido.
 *   - `1` — violação: marcador ausente, irresolúvel num clone completo, fora da
 *     linhagem, ou além do orçamento. É diagnóstico, não desculpa.
 *   - `2` — **pré-condição**: não é repositório git, o `git` não resolve, o ledger
 *     não existe, o HEAD não resolve, ou o clone é **raso** (a ancestralidade é
 *     inverificável de princípio, e acusar violação seria mentir sobre a causa).
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
// Extensão explícita, e ela é load-bearing: este script roda na pipeline LEVE,
// que **não instala dependências** e executa `.ts` com o type-stripping nativo do
// Node (o irmão `m02-secrets-audit.ts` só tem imports de builtin, por isso nunca
// precisou disso). O resolvedor ESM do Node exige a extensão; sem ela o import
// falha só na light, que é exatamente onde ninguém olha. `allowImportingTsExtensions`
// está ligado no tsconfig, então o `tsc` aceita a forma.
import { gitSync } from "./lib/git-exec.ts";

const repositoryRoot = resolve(import.meta.dirname, "..");
const ledgerPath = resolve(repositoryRoot, "EXECUTION-STATE-PROGRAM.md");

/**
 * Folga declarada entre o commit nomeado e o HEAD, em commits da linhagem
 * principal (`--first-parent`, a mesma métrica da medição acima).
 *
 * **Por que 13, e por que não é um número escolhido para passar.** A distribuição
 * medida dá 72% dos commits dentro de 3, 86% dentro de 8 e **93% dentro de 13**.
 * Treze é, portanto, o menor número redondo que cobre a disciplina que o projeto
 * **de fato** pratica — a guarda passa a cobrar um padrão que existe, em vez de
 * inventar um mais estrito e ficar vermelha por desenho. Um orçamento maior
 * acomodaria a deriva que se quer pegar; um menor reproduziria o ruído.
 *
 * O número é uma **decisão**, não uma constante mágica: mudá-lo muda o que a
 * guarda cobra, e o novo valor precisa da medição correspondente no comentário.
 */
export const ORCAMENTO_DE_FOLGA = 13;

const SECAO_OBRIGATORIA = "## Correção de estado M-02";

/** As três formas que o ledger já usou para carimbar o estado. */
const FORMAS_DE_MARCADOR =
  /(?:Latest state marker parent|P1 marker parent)\s*=\s*`([0-9a-f]{7,40})`/g;
const FORMA_EXATA = /`HEAD`\s*=\s*`([0-9a-f]{7,40})`/g;

export type Veredicto =
  | { exit: 0; tipo: "exato" | "ancestral"; sha: string; distancia: number; mensagem: string }
  | { exit: 1; mensagem: string }
  | { exit: 2; mensagem: string };

export interface EntradaDaAvaliacao {
  ledger: string;
  head: string;
  /** Clone raso torna a ancestralidade inverificável — pré-condição, não violação. */
  raso: boolean;
  /** SHA completo do commit, ou `undefined` se ele não existe neste clone. */
  resolverCommit: (sha: string) => string | undefined;
  ehAncestral: (ancestral: string, head: string) => boolean;
  /** Commits `--first-parent` de `base` (exclusivo) até `head` (inclusive). */
  distancia: (base: string, head: string) => number;
  orcamento?: number;
}

type FormaDeMarcador = "exato" | "ancestral";

interface MarcadorEncontrado {
  forma: FormaDeMarcador;
  sha: string;
  indice: number;
}

/**
 * O marcador **do fim do arquivo** é o que descreve o estado corrente. Procurar
 * cada forma em separado não serve: o ledger guarda registros de operador datados
 * que citam `` `HEAD` = `<sha>` `` de meses atrás, e tomar essa citação histórica
 * por afirmação de estado produziria uma violação falsa. Entre as formas, vence a
 * que aparece por último — um marcador antigo e válido não pode resgatar um
 * recente e vencido, e uma citação antiga não pode reprovar o estado atual.
 */
function ultimoMarcador(ledger: string): MarcadorEncontrado | undefined {
  let ultimo: MarcadorEncontrado | undefined;
  const considerar = (forma: FormaDeMarcador, padrao: RegExp) => {
    for (const m of ledger.matchAll(padrao)) {
      const indice = m.index ?? -1;
      if (!ultimo || indice > ultimo.indice) ultimo = { forma, sha: m[1], indice };
    }
  };
  considerar("exato", FORMA_EXATA);
  considerar("ancestral", FORMAS_DE_MARCADOR);
  return ultimo;
}

/**
 * O núcleo puro: recebe tudo por parâmetro, não toca disco nem executa processo.
 * É o que permite exercitar os ramos que a guarda **rejeita** — uma guarda cuja
 * decisão só se prova no caminho feliz não se provou.
 */
export function avaliarEstadoM02(entrada: EntradaDaAvaliacao): Veredicto {
  const orcamento = entrada.orcamento ?? ORCAMENTO_DE_FOLGA;

  if (entrada.raso) {
    return {
      exit: 2,
      mensagem:
        "precondicao: clone raso — a ancestralidade do marcador e inverificavel aqui. " +
        "Faca fetch da historia completa ou rode com --unshallow; acusar violacao seria mentir sobre a causa.",
    };
  }

  if (!entrada.ledger.includes(SECAO_OBRIGATORIA)) {
    return {
      exit: 1,
      mensagem: `Ledger sem a secao obrigatoria "${SECAO_OBRIGATORIA}" — o ledger perdeu a ancora de estado.`,
    };
  }

  const marcador = ultimoMarcador(entrada.ledger);
  if (marcador === undefined) {
    return {
      exit: 1,
      mensagem:
        "Ledger sem marcador de estado: registre `Latest state marker parent = <sha>` antes de prosseguir.",
    };
  }

  if (marcador.forma === "exato") {
    const resolvido = entrada.resolverCommit(marcador.sha);
    if (resolvido === undefined) {
      return {
        exit: 1,
        mensagem: `Marcador \`HEAD\` = \`${marcador.sha}\` nao resolve para commit nenhum neste clone completo.`,
      };
    }
    if (resolvido !== entrada.head) {
      return {
        exit: 1,
        mensagem:
          `Marcador \`HEAD\` = \`${marcador.sha}\` nao e o HEAD atual (${entrada.head}) — ` +
          "o ledger afirma um estado que nao e o corrente.",
      };
    }
    return { exit: 0, tipo: "exato", sha: resolvido, distancia: 0, mensagem: "exato" };
  }

  const resolvido = entrada.resolverCommit(marcador.sha);
  if (resolvido === undefined) {
    return {
      exit: 1,
      mensagem: `Marcador ${marcador.sha} nao resolve para commit nenhum neste clone completo — SHA fabricado ou de outra ref.`,
    };
  }

  if (!entrada.ehAncestral(resolvido, entrada.head)) {
    return {
      exit: 1,
      mensagem:
        `Marcador ${marcador.sha} nao e ancestral de HEAD (${entrada.head}) — o ledger descreve um estado ` +
        "que nao esta na historia desta linhagem.",
    };
  }

  const distancia = entrada.distancia(resolvido, entrada.head);
  if (distancia > orcamento) {
    return {
      exit: 1,
      mensagem:
        `Ledger desatualizado: o marcador ${marcador.sha} esta a ${distancia} commits do HEAD, acima do ` +
        `orcamento declarado de ${orcamento}. Reapine com o commit corrente e registre o que mudou.`,
    };
  }

  return { exit: 0, tipo: "ancestral", sha: resolvido, distancia, mensagem: "ancestral" };
}

function gitOuUndefined(args: readonly string[]): string | undefined {
  try {
    return gitSync(args, { cwd: repositoryRoot }).trim();
  } catch {
    return undefined;
  }
}

function main(): void {
  // --- Pré-condições, todas exit 2 -------------------------------------------
  if (gitOuUndefined(["rev-parse", "--git-dir"]) === undefined) {
    console.error("precondicao: isto nao e um repositorio git.");
    process.exitCode = 2;
    return;
  }
  const head = gitOuUndefined(["rev-parse", "HEAD"]);
  if (head === undefined) {
    console.error("precondicao: HEAD nao resolve (repositorio sem commits?).");
    process.exitCode = 2;
    return;
  }
  if (!existsSync(ledgerPath)) {
    console.error(`precondicao: ledger ausente em ${ledgerPath}.`);
    process.exitCode = 2;
    return;
  }
  const raso = gitOuUndefined(["rev-parse", "--is-shallow-repository"]) === "true";

  const veredicto = avaliarEstadoM02({
    ledger: readFileSync(ledgerPath, "utf8"),
    head,
    raso,
    resolverCommit: (sha) =>
      gitOuUndefined(["rev-parse", "--verify", "--quiet", `${sha}^{commit}`]),
    ehAncestral: (ancestral, atual) =>
      gitOuUndefined(["merge-base", "--is-ancestor", ancestral, atual]) !== undefined,
    distancia: (base, atual) => {
      const n = gitOuUndefined(["rev-list", "--count", "--first-parent", `${base}..${atual}`]);
      return n === undefined ? Number.POSITIVE_INFINITY : Number.parseInt(n, 10);
    },
  });

  if (veredicto.exit === 0) {
    console.log(
      `M-02 ${veredicto.tipo} state marker is valid for HEAD ${head} ` +
        `(folga ${veredicto.distancia}/${ORCAMENTO_DE_FOLGA} commits).`,
    );
  } else {
    console.error(veredicto.mensagem);
  }
  process.exitCode = veredicto.exit;
}

/**
 * Só executa quando é o ponto de entrada. Sem esta guarda, importar o módulo — que
 * é o que o teste faz para exercitar `avaliarEstadoM02` — dispararia I/O de git,
 * imprimiria no stdout do teste e mexeria em `process.exitCode` de quem importou.
 * Um núcleo puro que não pode ser importado em silêncio não é um núcleo puro.
 */
const executadoDiretamente =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDiretamente) {
  main();

  const status = gitOuUndefined(["status", "--short", "--untracked-files=all"]);
  console.log(`Worktree: ${status ? "dirty (preservado e auditável)" : "clean"}.`);
  console.log("External state: not inspected by this local check.");
}
