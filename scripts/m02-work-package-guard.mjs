#!/usr/bin/env node
// Guard do contrato de work package (docs/evidence/_templates/work-package.md).
//
// Valida a ESTRUTURA do template: secoes obrigatorias, checklist anti-vacuoso com
// 17 itens numerados, coluna de origem identificada pelo header (nao "a ultima
// coluna") e com conteudo rastreavel (nao degenerado), taxonomia CORR x N e o
// layout do selo. Nao valida prosa nem conteudo de um WP especifico — o
// enforcement de conteudo e humano/S6 (vide o proprio template).
//
// A partir de 2026-10-21 o guard passou a olhar tambem os PACOTES REAIS de
// `docs/evidence/` (antes so o template era verificado, e um pacote novo
// nascia sem selagem sem que nada reprovasse):
//
//   1. SELAGEM — um pacote (diretório com `README.md` ou `REPORT.md`) que não
//      tem `MANIFEST.sha256` **e** não tem `SPEC.md` reprova, a menos que
//      esteja numa lista NOMEADA de exceções, cada uma com motivo. O padrão é
//      o do `scripts/lib/m02-ci-coverage.ts` (DBT-62): "declarado fora do
//      contrato com motivo nomeado". A lista é de EXCEÇÕES LEGADAS (pacotes
//      históricos anteriores ao contrato de selagem) e de SELAGEM EM CURSO
//      (pacotes novos cujo selo entra em paralelo).
//
//   2. SEGREDO NAS CAPTURAS — um DSN (postgres/postgresql/mysql/mongodb) com
//      senha LITERAL em arquivo versionado sob `docs/evidence/**` reprova.
//      Placeholders (`${...}`, `$VAR`, `<REDACTED...>`, `***`) e senha vazia
//      passam. Um DSN cujo alvo é um loopback LITERAL é fixture local, não
//      credencial; um host de espaço reservado/documentação é sintético.
//
// Node built-ins apenas (os dois pipelines rodam este guard sem instalar deps).
// Uso: node scripts/m02-work-package-guard.mjs [--template <caminho>] [--evidence <dir>]

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_TEMPLATE = "docs/evidence/_templates/work-package.md";
const DEFAULT_EVIDENCE = "docs/evidence";
const EXPECTED_ITEMS = 17;
const EXPECTED_CHECKLIST_COLUMNS = 4;
const ORIGIN_HEADER = /^origem\b/i;
const DEGENERATE_ORIGIN = /^(n\/?a|tbd|\?+|—|-+|\.+)$/i;
const DEMO_HEADER = /^como demonstrar\b/i;
const DEGENERATE_DEMO = /^(n\/?a|tbd|\?+|—|-+|\.+)$/i;
// Piso de nao-vacuidade da coluna de demonstracao (S6 N4 do WP-R5): a celula mais curta do
// template real tem 84 caracteres e a mediana 121; 40 fica muito abaixo do menor caso legitimo e
// muito acima de um preenchimento de fachada. E um piso, nao um juizo semantico — vacuidade de
// conteudo continua sendo objeto do S6.
const MIN_DEMO_LENGTH = 40;
const REQUIRED_SECTIONS = [
  "## 1. Seções obrigatórias do SPEC",
  "## 2. Seções obrigatórias do README",
  "## 3. Checklist anti-vacuoso",
  "## 4. Taxonomia de veredicto",
  "## Apêndice B — layout do selo",
];

// ── contrato de selagem dos pacotes reais ───────────────────────────────────
// Documento que caracteriza um pacote de evidencia (medido em 2026-10-21: 62
// pacotes com `README.md` + 8 com `REPORT.md`; 19 deles sem `MANIFEST.sha256`).
const PACKAGE_DOCUMENTS = ["README.md", "REPORT.md"];
// Selo do pacote: manifesto de bytes + documento de especificacao. Um pacote
// com qualquer um dos dois nao precisa de excecao.
const SEAL_MARKERS = ["MANIFEST.sha256", "SPEC.md"];

const LEGACY_REASON =
  "pacote histórico anterior ao contrato de selagem; dívida registrada no registry (DBT-144)";

/**
 * EXCEÇÕES LEGADAS — pacotes históricos que nunca foram selados.
 *
 * Medido em 2026-10-21: 19 pacotes tinham `README.md`/`REPORT.md` sem
 * `MANIFEST.sha256` e sem `SPEC.md`. Cinco deles (`cu-interativo-2026-10-19`,
 * `cu-primeiro-cliente-2026-10-19`, `depuracao-visual-2026-10-19`,
 * `fase2a-2026-10-18`, `reconciliacao-2026-10-19`) foram selados nesta
 * mesma janela e saíram da exceção; os 14 restantes são históricos.
 *
 * A dívida que esta lista representa (pacotes históricos sem selo) está
 * registrada no registry como DBT-144 — este guard não abre dívida (a lista
 * é uma DECLARAÇÃO, não um registro).
 */
export const LEGACY_UNSEALED_PACKAGES = {
  "ciclo-24": LEGACY_REASON,
  "ciclo-25": LEGACY_REASON,
  "ci-tiers-2026-09-21": LEGACY_REASON,
  "cutover-2026-09-12": LEGACY_REASON,
  "cutover-prep-2026-09-14": LEGACY_REASON,
  "infra-2026-10-02": LEGACY_REASON,
  "pos-merge-pr62-2103151-phase3": LEGACY_REASON,
  "preflight-rat-2026-09-07": LEGACY_REASON,
  "reconciliation-2026-09-19": LEGACY_REASON,
  "trk-a-wp-b7-2026-09-17": LEGACY_REASON,
  "trk-b-mem-d4-2026-09-17": LEGACY_REASON,
  "trk-c-wp-b1-2026-09-17": LEGACY_REASON,
  "trk-d1-matrix-2026-09-18": LEGACY_REASON,
  "trk-d2-fk-2026-09-18": LEGACY_REASON,
};

/**
 * SELAGEM EM CURSO — pacotes novos cujo selo está sendo publicado em
 * paralelo. Entrada transitória: quando `MANIFEST.sha256`/`SPEC.md` existirem,
 * a exceção fica inerte e o guard avisa (nota em stdout) que ela pode sair.
 *
 * Medido em 2026-10-21: as cinco entradas que existiam foram seladas nesta
 * janela (SPEC.md + MANIFEST.sha256 publicados) e retiradas. A lista fica
 * vazia e o mecanismo permanece: um pacote novo sem selo **falha fechado**,
 * salvo se for declarado aqui enquanto o selo está em publicação.
 */
export const IN_FLIGHT_SEALS = {};

// ── varredura de segredo nas capturas ───────────────────────────────────────
const DSN_PATTERN = /\b(postgres|postgresql|mysql|mongodb):\/\/([^\s"'`<>|\\)]*)/gi;
// Placeholders aceitos: `${VAR}`, `$VAR`, `<REDACTED...>`, `***`.
const DSN_PLACEHOLDER = [/^\$\{[^}]*\}$/, /^\$[A-Za-z_][A-Za-z0-9_]*$/, /^<[^>]*>$/, /^\*+$/];
// Hosts DECLARADOS sintéticos: endpoints usados por sondas de controle
// negativo, com nome de "fake" no próprio host.
const SYNTHETIC_HOSTS = new Set([
  "ep-fake.neon.tech",
  "ep-fake-pooler.c-5.us-east-2.aws.neon.tech",
  "ep-fake.us-east-2.aws.neon.tech",
]);
// Espaço reservado/documentação (RFC 2606 e RFC 5737): nunca é ambiente real.
const RESERVED_TLD = /\.(example|invalid|test|localhost)$/i;
const RESERVED_DOMAIN = /(^|\.)example\.(com|org|net)$/i;
const RESERVED_IP = /^(192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)/;
const HOST_LABEL = /^[a-z0-9_-]+$/i;
// Saída bruta que o `.gitignore` já exclui: não é fonte versionada e o byte
// bruto é prova, não texto de código. (Limite declarado: "versionado" é
// aproximado por esta lista, não por leitura do índice Git.)
const IGNORED_PATH = new RegExp(
  [
    "(^|/)visual/",
    "playwright-mcp",
    "\\.ax\\.txt$",
    "page-.*\\.yml$",
    "\\.jsonl$",
    "(^|/)artifacts/",
    "(^|/)logs/",
    "(^|/)screenshots/",
    "(^|/)snapshots/",
    "(^|/)raw/",
    "(^|/)private/",
    "(^|/)secrets/",
    "(^|/)credentials/",
    "\\.log$",
    "\\.patch$",
    "\\.bundle$",
  ].join("|"),
);
const MAX_SCAN_BYTES = 1024 * 1024;

/**
 * Arquivos com DSN de senha literal DECLARADOS fora do contrato, cada um com
 * o motivo. São hosts de documentação/sonda com senha-sentinela — a senha é
 * parte do texto da prova, não uma credencial de ambiente.
 */
export const DECLARED_DSN_FILES = {
  "agent-state/CLAIMS-INBOX/16.3-pgstat.md":
    "host de documentação com senha-sentinela no texto da prova; não é credencial de ambiente",
  "pg-stat-statements-2026-09-15.md":
    "host de documentação com senha-sentinela no texto da prova; não é credencial de ambiente",
  "trilho-a-runner-failopen-2026-09-19/captures/adversarial-probes/s6-gate.mjs.txt":
    "endpoint remoto sintético de controle negativo (falha fechada); a senha é sentinela",
  "trilho-a-runner-failopen-2026-09-19/captures/adversarial-probes/s6-noconn.mjs.txt":
    "endpoint remoto sintético de controle negativo (falha fechada); a senha é sentinela",
  "trilho-a-runner-failopen-2026-09-19/captures/adversarial-probes/s6-run.mjs.txt":
    "endpoint remoto sintético de controle negativo (falha fechada); a senha é sentinela",
  "trilho-a-runner-failopen-2026-09-19/captures/bateria-final.log.txt":
    "endpoint remoto sintético de controle negativo (falha fechada); a senha é sentinela",
  // `browser-autonomo-2026-10-17/captures/09-bancada-preview.txt` saiu desta
  // lista em 2026-10-21: a senha literal do container local de fixture foi
  // redigida (`<REDACTED_BENCH_PASSWORD>`) e o arquivo passa a ser varrido
  // pela regra comum.
};

/** Host literal (sem porta) de uma autoridade DSN. */
export function dsnHostLiteral(host) {
  if (host.startsWith("[")) return host.slice(0, host.indexOf("]") + 1);
  const partes = host.split(":");
  if (partes.length > 2) return host; // IPv6 sem porta
  return partes[0];
}

/** `true` quando o alvo é um loopback LITERAL (fixture local provada). */
export function isLoopbackHost(host) {
  const h = host.toLowerCase();
  return (
    h === "localhost" || h === "::1" || h === "[::1]" || h === "0.0.0.0" || h.startsWith("127.")
  );
}

/**
 * `true` quando o host é sintetico por construção: espaço reservado
 * (RFC 2606/5737), host declarado sintético ou rótulo único (não é FQDN).
 * Um host com variável (`${...}`) NÃO é sintético: o destino é decidido em
 * runtime, então a guarda não pode provar que é local.
 */
export function isSyntheticHost(host) {
  const h = host.toLowerCase();
  if (SYNTHETIC_HOSTS.has(h)) return true;
  if (RESERVED_TLD.test(h) || RESERVED_DOMAIN.test(h) || RESERVED_IP.test(h)) return true;
  if (!h.includes(".") && HOST_LABEL.test(h)) return true;
  return false;
}

/** `true` quando a senha é placeholder (ou vazia) — não é credencial. */
export function isDsnPlaceholder(password) {
  if (password.length === 0) return true;
  return DSN_PLACEHOLDER.some((padrao) => padrao.test(password));
}

/**
 * DSNs com senha literal em um texto.
 *
 * Devolve `{ linha, esquema }` — NUNCA o valor da senha: a saída do guard
 * nomeia o arquivo e a linha, e a senha literal NÃO é ecoada (a mesma
 * propriedade que a guarda MCP conserva: uma guarda de segredo que imprime o
 * segredo é um vetor).
 */
export function findLiteralPasswordDsns(raw) {
  const encontrados = [];
  const linhas = raw.split("\n");
  linhas.forEach((linha, indice) => {
    DSN_PATTERN.lastIndex = 0;
    let match;
    while ((match = DSN_PATTERN.exec(linha)) !== null) {
      const credencial = match[2];
      const arroba = credencial.indexOf("@");
      if (arroba === -1) continue;
      const info = credencial.slice(0, arroba);
      const doisPontos = info.indexOf(":");
      if (doisPontos === -1) continue;
      const senha = info.slice(doisPontos + 1);
      if (isDsnPlaceholder(senha)) continue;
      const autoridade = credencial.slice(arroba + 1);
      const interrogacao = autoridade.indexOf("?");
      const consulta = interrogacao === -1 ? "" : autoridade.slice(interrogacao + 1);
      let host = interrogacao === -1 ? autoridade : autoridade.slice(0, interrogacao);
      const barra = host.search(/[/?]/);
      if (barra !== -1) host = host.slice(0, barra);
      // `host=`/`hostaddr=` movem o destino efetivo do driver — a autoridade
      // pode ser loopback e o alvo, não.
      const override = /(^|&)host(addr)?=([^&]+)/.exec(consulta);
      const efetivo = override ? override[3] : host;
      const literal = dsnHostLiteral(efetivo);
      if (isLoopbackHost(literal) || isSyntheticHost(literal)) continue;
      encontrados.push({ linha: indice + 1, esquema: match[1] });
    }
  });
  return encontrados;
}

function listarArquivos(raiz) {
  const encontrados = [];
  const pendentes = [raiz];
  while (pendentes.length > 0) {
    const atual = pendentes.pop();
    let entradas;
    try {
      entradas = readdirSync(atual, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entrada of entradas) {
      const caminho = join(atual, entrada.name);
      if (entrada.isDirectory()) {
        pendentes.push(caminho);
        continue;
      }
      if (!entrada.isFile()) continue;
      const relativo = caminho
        .slice(raiz.length + 1)
        .split("\\")
        .join("/");
      if (IGNORED_PATH.test(relativo)) continue;
      try {
        if (statSync(caminho).size > MAX_SCAN_BYTES) continue;
      } catch {
        continue;
      }
      encontrados.push({ caminho, relativo });
    }
  }
  return encontrados;
}

/**
 * Varre os arquivos versionados sob `docs/evidence/**` procurando DSN com
 * senha literal. Host declarado + senha literal = achado.
 */
export function auditDsnLiterals({ root, declarados = DECLARED_DSN_FILES }) {
  const findings = [];
  for (const arquivo of listarArquivos(root)) {
    let raw;
    try {
      raw = readFileSync(arquivo.caminho, "utf8");
    } catch {
      continue;
    }
    if (raw.includes("\u0000")) continue; // binário
    for (const achado of findLiteralPasswordDsns(raw)) {
      const motivo = declarados[arquivo.relativo];
      if (motivo) continue;
      findings.push(
        `dsn com senha literal nao-redigida: ${arquivo.relativo}:${achado.linha} ` +
          `(esquema ${achado.esquema}; a senha nao e ecoada)`,
      );
    }
  }
  return findings;
}

/**
 * Verifica a selagem dos pacotes reais. Pacote = diretório com `README.md`
 * ou `REPORT.md`. Sem `MANIFEST.sha256` E sem `SPEC.md` reprova, a menos que
 * esteja numa lista nomeada de exceções.
 */
export function auditPackageSealing({
  root,
  legacy = LEGACY_UNSEALED_PACKAGES,
  inFlight = IN_FLIGHT_SEALS,
}) {
  const findings = [];
  const notas = [];
  const excecoes = { ...legacy, ...inFlight };
  let entradas;
  try {
    entradas = readdirSync(root, { withFileTypes: true });
  } catch (error) {
    return { findings: [`raiz de evidencia ilegivel: ${root} (${error.message})`], notas };
  }
  const nomes = entradas
    .filter((entrada) => entrada.isDirectory() && entrada.name !== "_templates")
    .map((entrada) => entrada.name)
    .sort();
  for (const nome of nomes) {
    const diretorio = join(root, nome);
    const temDocumento = PACKAGE_DOCUMENTS.some((documento) =>
      existsSync(join(diretorio, documento)),
    );
    if (!temDocumento) continue;
    const selado = SEAL_MARKERS.filter((marcador) => existsSync(join(diretorio, marcador)));
    if (selado.length > 0) {
      if (excecoes[nome]) {
        notas.push(`excecao agora sem efeito (pacote selado): ${nome} — remova a entrada da lista`);
      }
      continue;
    }
    if (excecoes[nome]) continue;
    findings.push(
      `pacote sem selagem e sem declaracao de excecao: ${nome} ` +
        `(faltam ${SEAL_MARKERS.join(" e ")})`,
    );
  }
  for (const nome of Object.keys(excecoes)) {
    if (!nomes.includes(nome)) {
      notas.push(`excecao declarada para pacote inexistente: ${nome} — remova a entrada da lista`);
    }
  }
  return { findings, notas };
}

function parseArgs(argv) {
  const opcoes = { template: DEFAULT_TEMPLATE, evidence: DEFAULT_EVIDENCE, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--template") {
      const valor = argv[i + 1];
      if (!valor) throw new Error("--template exige um caminho");
      opcoes.template = valor;
      i += 1;
    } else if (arg === "--evidence") {
      const valor = argv[i + 1];
      if (!valor) throw new Error("--evidence exige um diretorio");
      opcoes.evidence = valor;
      i += 1;
    } else if (arg === "--json") {
      opcoes.json = true;
    } else {
      throw new Error(`argumento desconhecido: ${arg}`);
    }
  }
  return opcoes;
}

function cells(linha) {
  return linha
    .split("|")
    .slice(1, -1)
    .map((celula) => celula.trim());
}

function fail(mensagens) {
  for (const mensagem of mensagens) console.error(`work-package guard: ${mensagem}`);
  console.error(`work-package guard: REPROVADO (${mensagens.length} falha(s))`);
  process.exitCode = 1;
}

function validarChecklist(secao, falhas) {
  const linhas = secao.split("\n");
  const header = linhas.find((linha) => /^\|\s*#\s*\|/.test(linha));
  if (!header) {
    falhas.push("checklist sem linha de cabecalho (| # | ...)");
    return;
  }
  const colunas = cells(header);
  if (colunas.length !== EXPECTED_CHECKLIST_COLUMNS) {
    falhas.push(
      `cabecalho do checklist tem ${colunas.length} colunas; esperado ${EXPECTED_CHECKLIST_COLUMNS}`,
    );
  }
  const origemIndex = colunas.findIndex((coluna) => ORIGIN_HEADER.test(coluna));
  if (origemIndex === -1) {
    falhas.push("checklist sem coluna de origem (header 'origem ...')");
    return;
  }
  const demoIndex = colunas.findIndex((coluna) => DEMO_HEADER.test(coluna));
  if (demoIndex === -1) {
    falhas.push("checklist sem coluna de demonstracao (header 'como demonstrar')");
    return;
  }

  const itens = [];
  for (const linha of linhas) {
    const m = /^\|\s*(\d+)\s*\|/.exec(linha);
    if (!m) continue;
    itens.push({ numero: Number(m[1]), celulas: cells(linha) });
  }
  if (itens.length !== EXPECTED_ITEMS) {
    falhas.push(`checklist tem ${itens.length} itens; esperado ${EXPECTED_ITEMS}`);
  }
  itens.forEach((item, index) => {
    if (item.numero !== index + 1) {
      falhas.push(`item fora de sequencia: ${item.numero} na posicao ${index + 1}`);
    }
    if (item.celulas.length !== EXPECTED_CHECKLIST_COLUMNS) {
      falhas.push(
        `item ${item.numero} tem ${item.celulas.length} colunas; esperado ${EXPECTED_CHECKLIST_COLUMNS}`,
      );
      return;
    }
    const corpo = item.celulas[1] ?? "";
    if (corpo.length === 0) falhas.push(`item ${item.numero} sem descricao`);
    const demonstracao = item.celulas[demoIndex] ?? "";
    if (demonstracao.length < MIN_DEMO_LENGTH || DEGENERATE_DEMO.test(demonstracao)) {
      falhas.push(
        `item ${item.numero} com demonstracao degenerada ou vazia (${demonstracao.length} < ${MIN_DEMO_LENGTH}): "${demonstracao.slice(0, 60)}"`,
      );
    }
    const origem = item.celulas[origemIndex] ?? "";
    if (origem.length < 4 || DEGENERATE_ORIGIN.test(origem)) {
      falhas.push(`item ${item.numero} com origem degenerada ou vazia: "${origem}"`);
    }
  });
}

function main() {
  const { template, evidence, json } = parseArgs(process.argv.slice(2));
  const caminho = resolve(process.cwd(), template);

  let texto;
  try {
    texto = readFileSync(caminho, "utf8");
  } catch (error) {
    if (json) {
      console.log(
        JSON.stringify(
          {
            check: "m02:work-package-guard",
            result: "FAILED",
            findings: [`template ilegivel em ${template}: ${error.message}`],
          },
          null,
          2,
        ),
      );
    } else {
      fail([`template ilegivel em ${template}: ${error.message}`]);
    }
    return;
  }

  const falhas = [];

  for (const secao of REQUIRED_SECTIONS) {
    if (!texto.includes(secao)) falhas.push(`secao ausente: ${secao}`);
  }

  const inicio = texto.indexOf("## 3. Checklist anti-vacuoso");
  const fim = texto.indexOf("## 4. Taxonomia de veredicto");
  if (inicio === -1 || fim === -1 || fim <= inicio) {
    falhas.push("nao foi possivel delimitar a secao do checklist");
  } else {
    validarChecklist(texto.slice(inicio, fim), falhas);
  }

  for (const ancora of ["**CORR**", "**N** =", '"Correções forçadas"']) {
    if (!texto.includes(ancora)) falhas.push(`taxonomia sem a ancora ${ancora}`);
  }

  if (!texto.includes("Auto-verificação pré-S6")) {
    falhas.push("template sem o campo de auto-verificacao pre-S6 (KPI do checklist)");
  }

  for (const componente of ["SPEC.md", "README.md", "MANIFEST.sha256", "captures/"]) {
    if (!texto.includes(componente)) falhas.push(`layout do selo sem ${componente}`);
  }

  // ── pacotes reais + varredura de segredo ──────────────────────────────────
  const raizEvidencia = resolve(process.cwd(), evidence);
  const selagem = auditPackageSealing({ root: raizEvidencia });
  falhas.push(...selagem.findings);
  const segredos = auditDsnLiterals({ root: raizEvidencia });
  falhas.push(...segredos);

  if (json) {
    console.log(
      JSON.stringify(
        {
          check: "m02:work-package-guard",
          template,
          evidence,
          legacyExceptions: LEGACY_UNSEALED_PACKAGES,
          inFlightSeals: IN_FLIGHT_SEALS,
          declaredDsnFiles: DECLARED_DSN_FILES,
          findings: falhas,
          notes: selagem.notas,
          result: falhas.length > 0 ? "FAILED" : "OK",
        },
        null,
        2,
      ),
    );
  } else if (falhas.length > 0) {
    fail(falhas);
    return;
  } else {
    for (const nota of selagem.notas) console.log(`work-package guard: ${nota}`);
    console.log(
      `work-package guard: OK (${EXPECTED_ITEMS} itens, ${REQUIRED_SECTIONS.length} secoes, taxonomia e layout do selo) — ${template}`,
    );
    console.log(
      `work-package guard: OK (selagem dos pacotes reais e varredura de DSN sem senha literal) — ${evidence}`,
    );
  }
  if (falhas.length > 0) process.exitCode = 1;
}

// Só executa como CLI quando é o entrypoint. Importado por teste, o módulo
// exporta as funções puras sem varrer o repositório no import.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main();
  } catch (error) {
    console.error(`work-package guard: ERRO ${error.message}`);
    process.exitCode = 2;
  }
}
