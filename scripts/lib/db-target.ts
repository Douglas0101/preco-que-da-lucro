/**
 * Política de alvo de banco para os scripts de `scripts/db/` — uma implementação,
 * uma lista de produção, um predicado de override.
 *
 * **O defeito que este módulo fecha.** `assertLoopback` estava copiado em quatro
 * arquivos (`reconcile-ai-usage`, `release-unknown-reservations`,
 * `test-ai-usage-unknown`, `test-reconcile-ai-usage`) — três deles byte-idênticos,
 * o quarto diferindo só na redação da mensagem. Nenhum importava a precondição
 * compartilhada de `src/test/helpers/db-precondition.ts`. O efeito no CI não foi
 * teórico: o job "Branch efêmera" do `neon-pr-branch.yml` aponta `DATABASE_URL` e
 * `DATABASE_ADMIN_URL` para a branch Neon efêmera (§26) e grava um motivo em
 * `ALLOW_REMOTE_DB`, e estas cópias recusavam qualquer host remoto sem conhecer o
 * escape hatch. Reprova em `test-reconcile-ai-usage.ts:80`:
 *
 *   Error: DATABASE_ADMIN_URL aponta para "ep-frosty-bread-ayi2pg4p.…", não para
 *   loopback — recusando rodar contra host remoto
 *
 * A correção de `dbPrecondition` (26a1c55) levou a falha uma suíte adiante; era a
 * última cópia que ainda recusava. E a cópia era mais estreita que
 * `isLoopbackUrl`: aceitava só `127.0.0.1`, `localhost` e `::1`, recusando
 * grafias que o libpq aceita, como `127.1`. É a classe de defeito que a duplicação
 * produz — duas regras que deveriam ser uma, divergindo em silêncio.
 *
 * **A política, em uma frase:** loopback sempre; produção nunca, com ou sem
 * motivo; qualquer outro remoto só com `ALLOW_REMOTE_DB` carregando um motivo
 * não-vazio — o mesmo predicado de `env-guard.mjs:166`, que é frase e não
 * booleano.
 *
 * `classificarAlvo` devolve a decisão e `exigirAlvoDeBanco` a transforma em erro,
 * para que os ramos de recusa sejam exercitáveis: uma guarda cuja decisão só se
 * prova no caminho verde é o defeito que este arquivo veio remover.
 */

const PRODUCTION_ENDPOINT_PREFIX = "ep-long-violet-aye9g0bn";
const OVERRIDE_ENV = "ALLOW_REMOTE_DB";

export type ModoAlvo = "ausente" | "loopback" | "override" | "producao" | "invalido" | "remoto";

export type Classificacao =
  | { ok: true; modo: "ausente" | "loopback" | "override"; host: string | null }
  | { ok: false; modo: "producao" | "invalido" | "remoto"; host: string | null };

function ehLoopback(host: string): boolean {
  const normalizado = host.toLowerCase().replace(/\.$/, "");
  if (normalizado === "localhost" || normalizado === "[::1]") return true;
  if (/^127(\.\d{1,3}){0,3}$/.test(normalizado)) return true;
  if (/^\[::ffff:7f[0-9a-f]{2}:/.test(normalizado)) return true;
  return false;
}

function overrideAtivo(env: NodeJS.ProcessEnv): boolean {
  const motivo = env[OVERRIDE_ENV];
  return typeof motivo === "string" && motivo.trim() !== "";
}

/**
 * A decisão, sem efeito colateral. `valor` indefinido é "ausente" e passa: quem
 * exige a URL é o chamador, e as quatro cópias antigas devolviam neste caso.
 */
export function classificarAlvo(
  valor: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Classificacao {
  if (valor === undefined) return { ok: true, modo: "ausente", host: null };
  let host: string;
  try {
    host = new URL(valor).hostname;
  } catch {
    return { ok: false, modo: "invalido", host: null };
  }
  if (host.includes(PRODUCTION_ENDPOINT_PREFIX)) return { ok: false, modo: "producao", host };
  if (ehLoopback(host)) return { ok: true, modo: "loopback", host };
  if (overrideAtivo(env)) return { ok: true, modo: "override", host };
  return { ok: false, modo: "remoto", host };
}

/**
 * `assertLoopback` das quatro cópias, agora com a política inteira. A redação
 * dos dois casos que já existiam é preservada — a diff-leitura não precisa
 * traduzir nada — e o caso da produção é novo, porque antes não havia override
 * para distinguish e portanto nenhuma mensagem específica.
 */
export function exigirAlvoDeBanco(
  rotulo: string,
  valor: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const decisao = classificarAlvo(valor, env);
  if (decisao.ok) return;
  if (decisao.modo === "invalido") {
    throw new Error(`${rotulo} não é uma URL válida — recusando por segurança`);
  }
  if (decisao.modo === "producao") {
    throw new Error(
      `${rotulo} aponta para produção ("${decisao.host ?? ""}") — ${OVERRIDE_ENV} não autoriza endpoint de produção, com ou sem motivo`,
    );
  }
  throw new Error(
    `${rotulo} aponta para "${decisao.host ?? ""}", não para loopback — recusando rodar contra host remoto; ` +
      `para um alvo remoto sancionado use ${OVERRIDE_ENV}=<motivo>`,
  );
}
