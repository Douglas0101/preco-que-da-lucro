/**
 * Veredito de nível de **migrations** do schema diff §12.5 (`neon-pr-branch.yml`).
 *
 * **O defeito que este módulo fecha (DBT-56).** O passo comparava a branch do PR
 * contra a produção com `compare_schema` e classificava o resultado por uma única
 * pergunta — "o diff saiu vazio?" — combinada com "o PR mexe em `drizzle/**`?".
 * Com a ordem sancionada *expand antes de promover*, um diff vazio é o estado
 * **esperado** depois que as migrations do PR já chegaram à produção: as duas
 * pontas estão no mesmo nível e, por isso, não há diferença de schema a medir. O
 * predicado antigo leu esse estado como defeito e emitiu
 * `INCONSISTENTE: o PR mexe em drizzle/** mas o diff saiu vazio`; um estado
 * correto pintou o CI de vermelho. O mesmo predicado errava no sentido oposto:
 * uma migration que **não** aplicou também produz diff vazio, e esse é o defeito
 * real.
 *
 * **O predicado correto é de nível de migration, não de schema.** O que separa
 * "produção já migrada" de "a migration não aplicou" é o conjunto de hashes em
 * `drizzle.__drizzle_migrations` dos dois lados:
 *
 * - conjuntos **iguais** + diff vazio ⇒ `consistente: produção já migrada`;
 * - produção **atrás** (a branch tem migrations que produção não tem) + diff
 *   vazio ⇒ `INCONSISTENTE` — a mudança deveria ter aparecido e não apareceu;
 * - branch **atrás** ou **divergente** ⇒ `INCONSISTENTE` — a branch não entrega o
 *   estado que o PR deveria;
 * - journal **vazio** em qualquer ponta ⇒ `INCONSISTENTE` (não-vacuidade: dois
 *   bancos recém-criados são "iguais" por construção, e isso não é consistência);
 * - **qualquer falha de leitura** ⇒ `INCONSISTENTE` com o motivo nomeado. Nunca
 *   se infere igualdade a partir de uma leitura que não aconteceu — é o mesmo
 *   princípio do `exit 1` em vez de verde-por-omissão do resto do workflow.
 *
 * `DRIZZLE_TOUCHED` (a lista de arquivos do PR) deixa de ser o discriminador: passa
 * a qualificar a mensagem. O veredito é decidido pelos journals.
 *
 * **Política de alvo.** Os dois lados passam pela política única de
 * `scripts/lib/db-target.ts` — nada de check de loopback ad-hoc (as quatro cópias
 * de `assertLoopback` que este repositório já removeu). A branch do PR usa
 * `exigirAlvoDeBanco`, que recusa produção com ou sem motivo. O lado produção é
 * uma **leitura**: `exigirAlvoDeBanco` existe para bloquear alvos *escrevíveis*,
 * e o que este passo faz é ler o journal de produção numa transação
 * `read only`, com a URI que a própria API da Neon emite (a única credencial
 * remota do job). O leitor de baseline aceita o que `classificarAlvo` aceita —
 * loopback, override com motivo, produção — e recusa URL inválida e remoto sem
 * motivo; o `read only` é garantido pela transação e por o SQL ser uma constante
 * sem interpolação.
 *
 * **Por que é um módulo e não shell no YAML.** O predicado precisa ser
 * exercitável nos dois sentidos: o verde que conserta o falso vermelho e os
 * vermelhos que continuam vermelhos. Um `if` dentro de um heredoc de shell não
 * tem como ser testado, e o defeito original é justamente um `if` não testado.
 * `julgarSchemaDiff` é puro — sem env, sem rede, sem I/O.
 *
 * Uso: `npx tsx scripts/db/schema-diff-verdict.ts` (executado pelo passo do
 * workflow, que já falou com `compare_schema` e persistiu o corpo bruto).
 */

import { appendFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "pg";
import { classificarAlvo, exigirAlvoDeBanco } from "../lib/db-target";

export type Veredito = "consistente" | "inconsistente";

export type DrizzleTocado = "yes" | "no" | "unknown";

/** Leitura do journal de um lado. `ok: false` é fail-closed por construção. */
export type LeituraJournal =
  { ok: true; hashes: readonly string[] } | { ok: false; motivo: string };

export interface EntradaSchemaDiff {
  /** `compare_schema` saiu vazio? */
  vazio: boolean;
  /** Bytes do corpo bruto de `compare_schema` (evidência do artefato). */
  bytes: number;
  drizzleTocado: DrizzleTocado;
  branch: LeituraJournal;
  producao: LeituraJournal;
  /** `drizzle/meta/_journal.json` — quantas migrations o repositório declara. */
  migrationsNoRepo: number;
  headBranch: string;
  baseBranch: string;
  baseBranchId: string;
  dbName: string;
}

export interface ResultadoSchemaDiff {
  veredito: Veredito;
  /** Frase de uma linha que vai para o step summary e para o artefato. */
  leitura: string;
  /** Uma linha por parenthese do diagnóstico (journal, aritmética das pontas). */
  linhas: readonly string[];
  /** Valor do output `summary` do passo. */
  resumo: string;
}

const HASH_SHA256 = /^[0-9a-f]{64}$/;

function descrever(leitura: LeituraJournal): string {
  return leitura.ok
    ? `${leitura.hashes.length} migration(s)`
    : `leitura falhou (${leitura.motivo})`;
}

/** Subconjunto estrito: todo hash de `menor` está em `maior`, e não são iguais. */
function atrasado(maior: readonly string[], menor: readonly string[]): boolean {
  const alvo = new Set(maior);
  return menor.every((hash) => alvo.has(hash)) && menor.length < maior.length;
}

function conjuntosIguais(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((hash, index) => hash === b[index]);
}

function relacao(hashesBranch: readonly string[], hashesProducao: readonly string[]): string {
  if (conjuntosIguais(hashesBranch, hashesProducao)) {
    return "conjuntos IGUAIS (mesmos hashes, mesma ordem)";
  }
  if (atrasado(hashesBranch, hashesProducao)) {
    return `produção ATRÁS (branch tem ${hashesBranch.length - hashesProducao.length} migration(s) que produção não tem)`;
  }
  if (atrasado(hashesProducao, hashesBranch)) {
    return `branch ATRÁS (produção tem ${hashesProducao.length - hashesBranch.length} migration(s) que a branch não tem)`;
  }
  return "conjuntos DIVERGENTES (nenhum é subconjunto do outro)";
}

/**
 * O predicado. Puro: sem I/O, sem env, sem rede. A primeira condição que falha
 * nomeia o motivo — nenhuma das classificação depende de a outra ter passado.
 */
export function julgarSchemaDiff(entrada: EntradaSchemaDiff): ResultadoSchemaDiff {
  const { branch, producao } = entrada;

  // 1. Falha de leitura — fail-closed, e nomeada para não se confundir com (a).
  if (!branch.ok) {
    return {
      veredito: "inconsistente",
      leitura: `INCONSISTENTE: não foi possível ler drizzle.__drizzle_migrations na branch do PR (${branch.motivo}) — veredito ausente não é verde`,
      linhas: [
        `journal da branch do PR: INDISPONÍVEL — ${branch.motivo}`,
        `journal de produção: ${descrever(producao)}`,
        'consequência: a semântica de "diff vazio" fica NÃO VERIFICADA; a comparação roda de novo no próximo PR',
      ],
      resumo: "INCONSISTENTE (journal da branch do PR ilegível)",
    };
  }
  if (!producao.ok) {
    return {
      veredito: "inconsistente",
      leitura: `INCONSISTENTE: não foi possível ler drizzle.__drizzle_migrations em produção (${producao.motivo}) — veredito ausente não é verde`,
      linhas: [
        `journal de produção: INDISPONÍVEL — ${producao.motivo}`,
        `journal da branch do PR: ${descrever(branch)}`,
        'consequência: a semântica de "produção já migrada" fica NÃO VERIFICADA; a comparação roda de novo no próximo PR',
      ],
      resumo: "INCONSISTENTE (journal de produção ilegível)",
    };
  }

  const hashesBranch = branch.hashes;
  const hashesProducao = producao.hashes;
  const contexto = `${entrada.headBranch} vs ${entrada.baseBranch} (${entrada.baseBranchId})`;
  const aritmetica =
    `journal da branch do PR: ${hashesBranch.length} · produção: ${hashesProducao.length}` +
    ` · repo (_journal.json): ${entrada.migrationsNoRepo}`;
  const linhas = [aritmetica, `relação: ${relacao(hashesBranch, hashesProducao)}`];

  // 2. Não-vacuidade: banco sem journal algum não é "consistente" com nada.
  if (hashesBranch.length === 0) {
    return {
      veredito: "inconsistente",
      leitura: `INCONSISTENTE: a branch do PR não tem migration aplicada (journal vazio, o repositório declara ${entrada.migrationsNoRepo}) — igualdade por construção não é consistência`,
      linhas: [
        ...linhas,
        "diagnóstico: o journal da branch do PR está vazio — db:migrate não rodou, ou rodou contra outro banco",
      ],
      resumo: "INCONSISTENTE (journal da branch vazio)",
    };
  }
  if (hashesProducao.length === 0) {
    return {
      veredito: "inconsistente",
      leitura:
        "INCONSISTENTE: o journal de produção está vazio — a base de comparação não é a base migrada",
      linhas: [
        ...linhas,
        "diagnóstico: drizzle.__drizzle_migrations de produção não tem linhas — a URI de leitura não é a do banco de produção",
      ],
      resumo: "INCONSISTENTE (journal de produção vazio)",
    };
  }

  // 3. A branch tem que entregar o journal que o repositório declara.
  if (hashesBranch.length !== entrada.migrationsNoRepo) {
    return {
      veredito: "inconsistente",
      leitura: `INCONSISTENTE: a branch do PR tem ${hashesBranch.length} migration(s) aplicadas e o repositório declara ${entrada.migrationsNoRepo}`,
      linhas: [
        ...linhas,
        "diagnóstico: a chain da branch não é a chain do repositório — a passagem 'Prova de journal' também reprovaria",
      ],
      resumo: "INCONSISTENTE (journal da branch ≠ _journal.json)",
    };
  }

  // 4. Igualdade + diff vazio: o caso que o predicado antigo pintava de vermelho.
  if (conjuntosIguais(hashesBranch, hashesProducao)) {
    const diff = entrada.vazio
      ? `VAZIO (${entrada.bytes} B) — esperado: as duas pontas estão no mesmo nível de migration`
      : `NÃO VAZIO (${entrada.bytes} B) com journals idênticos — alerta de drift, o diff não vem de migrations`;
    return {
      veredito: "consistente",
      leitura: entrada.vazio
        ? "consistente: produção já migrada — os journals da branch do PR e de produção são idênticos, então o diff vazio é o estado esperado (expand antes de promover)"
        : "consistente: journals idênticos e ainda assim há diferença de schema — drift fora de drizzle/**, não atribuível às migrations",
      linhas: [
        ...linhas,
        `diff: ${diff}`,
        `PR mexe em drizzle/**: ${entrada.drizzleTocado} (qualifica a mensagem, não decide o veredito)`,
      ],
      resumo: entrada.vazio
        ? "consistente (journals iguais · diff vazio = produção já migrada)"
        : `nao-vazio (${entrada.bytes} B) com journals iguais — drift`,
    };
  }

  // 5. Produção atrás: um diff vazio é impossível de explicar.
  if (atrasado(hashesBranch, hashesProducao)) {
    if (entrada.vazio) {
      return {
        veredito: "inconsistente",
        leitura: `INCONSISTENTE: produção está atrás (${hashesProducao.length} de ${hashesBranch.length} migrations) e o diff saiu vazio — a mudança da branch deveria ter aparecido contra produção e não apareceu`,
        linhas: [
          ...linhas,
          'diagnóstico: schema igual com journals diferentes é contradição — compare_schema vazio aqui não é "produção já migrada"',
        ],
        resumo: "INCONSISTENTE (produção atrás + diff vazio)",
      };
    }
    return {
      veredito: "consistente",
      leitura: `consistente: mudança de schema do PR visível contra produção (produção atrás em ${hashesBranch.length - hashesProducao.length} migration(s))`,
      linhas: [
        ...linhas,
        `diff: NÃO VAZIO (${entrada.bytes} B) — compatível com a produção estar atrás`,
      ],
      resumo: "consistente (diff não vazio · produção atrás)",
    };
  }

  // 6. Branch atrás ou divergente: a branch não entrega o estado do PR.
  const motivo = atrasado(hashesProducao, hashesBranch)
    ? "a branch do PR está atrás de produção"
    : "os journals divergem sem que um contenha o outro";
  return {
    veredito: "inconsistente",
    leitura: `INCONSISTENTE: ${motivo} — a branch do PR não entrega o estado que o PR deveria (${contexto})`,
    linhas: [
      ...linhas,
      "diagnóstico: rever a chain aplicada na branch e o parent da branch (§12.4)",
    ],
    resumo: `INCONSISTENTE (${motivo})`,
  };
}

/**
 * Reconhecimento recursivo de corpo vazio. Deliberadamente conservador: a forma
 * exata do corpo de `compare_schema` só é confirmável com a chave (H-2), então o
 * bruto é persistido e o vazio é reconhecido por contenção.
 */
export function corpoVazio(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === "string") {
    const texto = valor.trim();
    return texto === "" || texto === "{}" || texto === "[]";
  }
  if (Array.isArray(valor)) return valor.every(corpoVazio);
  if (typeof valor === "object") return Object.values(valor).every(corpoVazio);
  return false;
}

/**
 * O lado escrevível da comparação (a branch efêmera do PR) passa pela política de
 * `scripts/db/` sem exceção: `exigirAlvoDeBanco` recusa produção com ou sem
 * motivo e exige `ALLOW_REMOTE_DB` com frase para qualquer remoto.
 */
export function exigirAlvoDaBranch(
  url: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): void {
  exigirAlvoDeBanco("BRANCH_DIRECT_URL", url, env);
}

/**
 * O lado **read-only** do baseline. `classificarAlvo` é a política única: aceita
 * loopback, override com motivo e produção; recusa URL inválida e remoto sem
 * motivo. A leitura em si é um `select` numa transação `read only`, com SQL
 * constante — nenhuma escrita é possível por construção e nenhum host pode ser
 * apontado sem classificar.
 */
export function exigirAlvoDoBaseline(
  rotulo: string,
  url: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const decisao = classificarAlvo(url, env);
  if (decisao.modo === "ausente") {
    throw new Error(`${rotulo} é obrigatória para a leitura do journal de produção`);
  }
  if (decisao.modo === "invalido") {
    throw new Error(`${rotulo} não é uma URL válida — recusando por segurança`);
  }
  if (decisao.modo === "remoto") {
    throw new Error(
      `${rotulo} aponta para "${decisao.host ?? ""}", não para loopback — recusando ler de host remoto; ` +
        "para um alvo remoto sancionado use ALLOW_REMOTE_DB=<motivo>",
    );
  }
}

/** Valida a forma dos hashes lidos; um journal com lixo é leitura inválida. */
export function validarHashes(hashes: readonly unknown[]): LeituraJournal {
  for (const hash of hashes) {
    if (typeof hash !== "string" || !HASH_SHA256.test(hash)) {
      return { ok: false, motivo: `hash fora do formato sha256 esperado: ${JSON.stringify(hash)}` };
    }
  }
  return { ok: true, hashes: hashes.filter((hash): hash is string => typeof hash === "string") };
}

/**
 * Lê `drizzle.__drizzle_migrations` numa transação read-only. Erro de conexão ou
 * de query volta como `LeituraJournal` falho — o chamador decide o veredito, e
 * nenhum caminho aqui transforma falha em conjunto vazio.
 */
export async function lerJournalAplicadas(url: string, rotulo: string): Promise<LeituraJournal> {
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: true },
    connectionTimeoutMillis: 15_000,
    query_timeout: 15_000,
  });
  try {
    await client.connect();
    await client.query("start transaction read only");
    const resultado = await client.query<{ hash: unknown }>(
      "select hash from drizzle.__drizzle_migrations order by created_at, id",
    );
    await client.query("rollback");
    return validarHashes(resultado.rows.map((row) => row.hash));
  } catch (error) {
    return { ok: false, motivo: `${rotulo}: ${(error as Error).message}` };
  } finally {
    await client.end().catch(() => undefined);
  }
}

// ---------------------------------------------------------------------------
// CLI — o que o passo do workflow executa.
// ---------------------------------------------------------------------------

function obrigatorio(env: NodeJS.ProcessEnv, nome: string): string {
  const valor = env[nome];
  if (!valor) throw new Error(`${nome} ausente — o passo do schema diff exige o ambiente completo`);
  return valor;
}

async function api(env: NodeJS.ProcessEnv, path: string): Promise<unknown> {
  const base = env.NEON_API_BASE ?? "https://console.neon.tech/api/v2";
  const resposta = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${obrigatorio(env, "NEON_API_KEY")}` },
  });
  if (!resposta.ok) throw new Error(`GET ${path} respondeu HTTP ${resposta.status}`);
  return resposta.json();
}

function branchesDoProjeto(
  payload: unknown,
): Array<{ id: string; name?: string; default?: boolean }> {
  if (typeof payload !== "object" || payload === null || !("branches" in payload)) return [];
  const { branches } = payload as { branches?: unknown };
  if (!Array.isArray(branches)) return [];
  return branches.filter(
    (branch): branch is { id: string; name?: string; default?: boolean } =>
      typeof branch === "object" &&
      branch !== null &&
      typeof (branch as { id?: unknown }).id === "string",
  );
}

function ownerDoBanco(payload: unknown, dbName: string): string | null {
  if (typeof payload !== "object" || payload === null || !("databases" in payload)) return null;
  const { databases } = payload as { databases?: unknown };
  if (!Array.isArray(databases)) return null;
  for (const database of databases) {
    if (typeof database !== "object" || database === null) continue;
    const registro = database as { name?: unknown; owner_name?: unknown };
    if (registro.name === dbName && typeof registro.owner_name === "string") {
      return registro.owner_name;
    }
  }
  return null;
}

function uriDoBaseline(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("uri" in payload)) return null;
  const { uri } = payload as { uri?: unknown };
  return typeof uri === "string" ? uri : null;
}

async function main(): Promise<void> {
  const env = process.env;
  const dir = obrigatorio(env, "ARTIFACT_DIR");
  const dbName = env.DB_NAME ?? "neondb";
  const baseName = env.BASE_BRANCH ?? "production";
  const headBranch = obrigatorio(env, "BRANCH_ID");
  const projectId = obrigatorio(env, "NEON_PROJECT_ID");
  const touched = (env.DRIZZLE_TOUCHED ?? "unknown") as DrizzleTocado;
  const branchUrl = (await readFile(obrigatorio(env, "BRANCH_DIRECT_URL_FILE"), "utf8")).trim();
  const corpo = await readFile(obrigatorio(env, "COMPARE_SCHEMA_BODY_FILE"), "utf8");

  exigirAlvoDaBranch(branchUrl, env);

  const journal = JSON.parse(
    await readFile(resolve(import.meta.dirname, "../../drizzle/meta/_journal.json"), "utf8"),
  ) as { entries?: unknown[] };

  // Base de comparação: `production` resolvida para id, owner do banco e URI
  // read-only emitida pela API — a única credencial remota do job.
  const branches = branchesDoProjeto(await api(env, `/projects/${projectId}/branches`));
  const baseBranchId =
    branches.find((branch) => branch.name === baseName)?.id ??
    branches.find((branch) => branch.default)?.id;
  if (!baseBranchId) throw new Error(`branch "${baseName}" não encontrada no projeto ${projectId}`);

  const owner = ownerDoBanco(
    await api(env, `/projects/${projectId}/branches/${baseBranchId}/databases`),
    dbName,
  );
  if (!owner) throw new Error(`owner do banco "${dbName}" não resolvido em ${baseBranchId}`);

  const uri = uriDoBaseline(
    await api(
      env,
      `/projects/${projectId}/connection_uri?branch_id=${encodeURIComponent(baseBranchId)}` +
        `&database_name=${encodeURIComponent(dbName)}&role_name=${encodeURIComponent(owner)}`,
    ),
  );
  if (!uri) throw new Error(`connection_uri sem corpo para ${baseBranchId}/${dbName}`);
  exigirAlvoDoBaseline("PRODUCTION_READ_URL", uri, env);

  const [branch, producao] = await Promise.all([
    lerJournalAplicadas(branchUrl, `branch do PR (${headBranch})`),
    lerJournalAplicadas(uri, `produção (${baseName})`),
  ]);

  let parsed: unknown = null;
  let parseError: string | null = null;
  try {
    parsed = JSON.parse(corpo);
  } catch (error) {
    parseError = (error as Error).message;
  }
  const bytes = Buffer.byteLength(corpo);

  const vazio = parseError === null && corpoVazio(parsed);
  const resultado = julgarSchemaDiff({
    vazio,
    bytes,
    drizzleTocado: touched,
    branch,
    producao,
    migrationsNoRepo: journal.entries?.length ?? 0,
    headBranch,
    baseBranch: baseName,
    baseBranchId,
    dbName,
  });

  const linhas = [
    "### Schema diff §12.5 — branch do PR vs produção (veredito por nível de migration)",
    "",
    `- head: ${headBranch} · base: ${baseName} (${baseBranchId}) · db_name: ${dbName}`,
    `- compare_schema: ${vazio ? `VAZIO (${bytes} B)` : `não vazio (${bytes} B)`} · PR mexe em drizzle/**: ${touched}`,
    ...resultado.linhas.map((linha) => `- ${linha}`),
    `- leitura: ${resultado.leitura}`,
    "- artefato: schema-diff.md + compare-schema-response.json (retenção 7 d)",
    "- produção intocada: leitura read-only do journal; a branch do PR é descartável (§12.5 always()).",
    ...(parseError === null
      ? []
      : [`- aviso: corpo não-JSON de compare_schema persistido (${parseError})`]),
  ];
  const bloco = `${linhas.join("\n")}\n`;
  writeFileSync(`${dir}/schema-diff.md`, bloco);
  appendFileSync(env.GITHUB_OUTPUT ?? "/dev/null", `summary=${resultado.resumo}\n`);
  appendFileSync(env.GITHUB_STEP_SUMMARY ?? "/dev/null", `${bloco}\n`);
  process.stdout.write(bloco);
  if (resultado.veredito === "inconsistente") process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    process.stderr.write(`schema-diff-verdict falhou: ${(error as Error).message}\n`);
    process.exit(1);
  });
}
