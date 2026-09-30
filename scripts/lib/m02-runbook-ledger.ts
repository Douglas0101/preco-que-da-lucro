/**
 * DBT-30 — consistência entre o runbook de ações manuais e o ledger.
 *
 * O defeito que originou esta dívida não foi um erro de digitação: dois
 * documentos do mesmo repositório afirmavam coisas incompatíveis sobre o
 * **mesmo** fato (a revogação de `neon-storage.env`), e nada no repositório
 * comparava os dois. O ledger dizia o fato certo; o runbook era o mais novo e
 * o errado; a contradição atravessou nove ciclos e só se resolvia por leitura
 * humana — que é exatamente o que o registry de DBT-30 registra.
 *
 * Este módulo é a lógica pura do closure test. Ele não conhece caminhos: os
 * três documentos entram como texto, para que o teste possa alimentar tanto os
 * arquivos reais quanto cópias deliberadamente corrompidas (controle negativo).
 *
 * Duas detecções, independentes:
 *   A) **Veredicto.** O runbook declara um estado para o item; o ledger registra
 *      o veredicto dele. Divergência reprova — nos **dois** sentidos.
 *   B) **Emissor.** Toda credencial tem um emissor; citar um provedor que não
 *      emitiu as chaves manda o operador para o console errado. Um provedor
 *      nomeado que não está no conjunto de emissores reprova, **a menos** que a
 *      própria frase o negue (o texto corrigido precisa poder dizer "nunca o
 *      Neon" sem ser reprovado por isso).
 *
 * Fail-closed nas duas direções, como o resto da casa: uma verificação que não
 * consegue ler o que precisa vira **precondição** (nada verificado), e uma
 * seção que não nomeia emissor nenhum vira precondição também — "verde por não
 * dizer nada" seria cobertura aparente.
 */

export interface RunbookLedgerInput {
  /** `docs/runbooks/acoes-manuais-pendentes.md` */
  runbook: string;
  /** `EXECUTION-STATE-PROGRAM.md` */
  ledger: string;
  /** `docs/evidence/pre-a4-2026-09-05/secrets-hygiene.md` */
  hygiene: string;
}

export interface RunbookLedgerAudit {
  /** Violações: a afirmação do runbook contradiz o fato. */
  findings: string[];
  /** Inverificável: falta o material para decidir. Nada foi verificado. */
  preconditions: string[];
}

export type Verdict = "fechada" | "aberta";

/** Provedores reconhecíveis no texto, para a checagem de emissor. */
const PROVIDERS: ReadonlyArray<{ id: string; pattern: RegExp }> = [
  { id: "aws", pattern: /\bAWS\b/i },
  { id: "openai", pattern: /\bOpenAI\b/i },
  { id: "neon", pattern: /\bNeon\b/i },
  { id: "vercel", pattern: /\bVercel\b/i },
  { id: "hostinger", pattern: /\bHostinger\b/i },
  { id: "sonar", pattern: /\bSonar(?:Cloud)?\b/i },
];

/** Prefixo do nome da chave ⇒ provedor que a emitiu. */
const KEY_ISSUERS: ReadonlyArray<{ prefix: RegExp; issuer: string }> = [
  { prefix: /^AWS_/, issuer: "aws" },
  { prefix: /^OPENAI_/, issuer: "openai" },
  { prefix: /^NEON_/, issuer: "neon" },
];

const CLOSED = /\bFECHAD[AO]S?\b/i;
const OPEN = /\b(ABERT[AO]S?|PENDENTE|PENDÊNCIAS?|PENDENCIAS?)\b/i;

/**
 * Negação na **mesma frase**. É o que permite ao texto corrigido citar o
 * provedor errado para dizer que ele era o errado — sem isso, a única redação
 * aprovada seria a que esconde o erro, que é o oposto do que o repo exige.
 */
const NEGATION = /\b(nunca|jamais|não|nao|errad[oa]s?|incorret[oa]s?)\b/i;

/**
 * Onde a negação vale: a frase que contém a citação. Recortar por sentença em
 * vez de por janela de caracteres evita que "nunca" de um parágrafo distante
 * absolva uma citação afirmativa.
 */
function sentenceAround(text: string, index: number): string {
  const start = Math.max(
    text.lastIndexOf(".", index - 1),
    text.lastIndexOf("\n", index - 1),
    text.lastIndexOf(";", index - 1),
  );
  const ends = [
    text.indexOf(".", index),
    text.indexOf("\n", index),
    text.indexOf(";", index),
  ].filter((i) => i >= 0);
  const end = ends.length > 0 ? Math.min(...ends) : text.length;
  return text.slice(start + 1, end + 1);
}

/**
 * Veredicto declarado por um trecho. `null` = o trecho não declara nada (ou
 * declara as duas coisas, o que é indistinguível de não declarar).
 */
export function verdictOf(text: string): Verdict | null {
  const closed = CLOSED.test(text);
  const open = OPEN.test(text);
  if (closed === open) return null;
  return closed ? "fechada" : "aberta";
}

export interface Section {
  heading: string;
  body: string;
}

/**
 * Seção `## …` que contém a âncora. O `body` exclui o cabeçalho; o `heading`
 * entra separado porque é ali que o runbook declara o veredicto.
 */
export function extractSection(markdown: string, anchor: string): Section | null {
  const lines = markdown.split("\n");
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (/^##\s+\S/.test(lines[i])) starts.push(i);
  }
  for (let s = 0; s < starts.length; s += 1) {
    const from = starts[s];
    const to = s + 1 < starts.length ? starts[s + 1] : lines.length;
    const chunk = lines.slice(from, to).join("\n");
    if (chunk.includes(anchor)) {
      return { heading: lines[from], body: lines.slice(from + 1, to).join("\n") };
    }
  }
  return null;
}

/** Primeiro parágrafo rotulado em negrito (`**Estado:** …`), que é onde o runbook afirma o estado. */
export function firstLabelledParagraph(body: string): string | null {
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (!/^\*\*[^*]+:\*\*/.test(lines[i]) && !/^\*\*[^*]+:\*\*\s*$/i.test(lines[i])) continue;
    const collected: string[] = [lines[i]];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].trim() === "") break;
      collected.push(lines[j]);
    }
    return collected.join("\n");
  }
  return null;
}

/**
 * Último veredicto do ledger para o item. **Último**, não primeiro: o ledger é
 * append-only e cronológico, então o veredicto vivo é o mais recente. O próprio
 * ledger prova isso — `SEC-01 segue ABERTA` em 2026-09-05 e `SEC-01 FECHADA` em
 * 2026-09-12 coexistem, e ler o primeiro inverteria a verdade.
 */
export function lastLedgerVerdict(ledger: string, item: string): Verdict | null {
  const pattern = new RegExp(
    `${item}\\b[^\\n]{0,40}?\\b(FECHAD[AO]S?|ABERT[AO]S?|PENDENTE|PENDÊNCIAS?)\\b`,
    "gi",
  );
  let last: Verdict | null = null;
  for (const match of ledger.matchAll(pattern)) {
    const word = match[1];
    last = CLOSED.test(word) ? "fechada" : "aberta";
  }
  return last;
}

/**
 * Nomes das chaves listados no documento de higiene. A lista existe lá como
 * "nomes apenas, valores nunca lidos" — este módulo nunca vê valor nenhum.
 */
export function keyNamesOf(hygiene: string): string[] {
  const match = hygiene.match(/chaves \(nomes apenas[^)]*\):\s*([^\n]+)/);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((name) => name.trim().replace(/[`*]/g, ""))
    .filter((name) => name !== "");
}

/** Emissores das chaves, derivados do prefixo de cada nome. */
export function issuersOf(keyNames: string[]): { issuers: string[]; unknown: string[] } {
  const issuers = new Set<string>();
  const unknown: string[] = [];
  for (const name of keyNames) {
    const rule = KEY_ISSUERS.find((candidate) => candidate.prefix.test(name));
    if (rule) issuers.add(rule.issuer);
    else unknown.push(name);
  }
  // Comparador por code unit UTF-16: é a MESMA ordem do `sort()` sem argumento (a
  // especificação compara as strings com `<`/`>`, não por locale). Existe porque `sort()`
  // sem comparador é o achado S2871; `localeCompare` NÃO serve — ordenaria por locale,
  // que é outra ordem, e trocaria a semântica em silêncio.
  return { issuers: [...issuers].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), unknown };
}

export function auditRunbookLedger(input: RunbookLedgerInput): RunbookLedgerAudit {
  const findings: string[] = [];
  const preconditions: string[] = [];
  const anchor = "neon-storage.env";
  const item = "SEC-01";

  const section = extractSection(input.runbook, anchor);
  if (!section) {
    preconditions.push(`runbook sem seção que mencione \`${anchor}\` — nada comparado`);
    return { findings, preconditions };
  }

  // ── A) veredicto ────────────────────────────────────────────────────────
  const labelled = firstLabelledParagraph(section.body);
  const runbookVerdict = verdictOf(section.heading) ?? (labelled ? verdictOf(labelled) : null);
  const ledgerVerdict = lastLedgerVerdict(input.ledger, item);

  if (runbookVerdict === null) {
    preconditions.push(
      `runbook não declara veredicto para \`${item}\` (cabeçalho nem parágrafo rotulado)`,
    );
  }
  if (ledgerVerdict === null) {
    preconditions.push(`ledger não registra veredicto para \`${item}\``);
  }
  if (runbookVerdict !== null && ledgerVerdict !== null && runbookVerdict !== ledgerVerdict) {
    findings.push(
      `runbook afirma \`${item}\` ${runbookVerdict} enquanto o ledger registra ${ledgerVerdict}`,
    );
  }

  // ── B) emissores ────────────────────────────────────────────────────────
  const keyNames = keyNamesOf(input.hygiene);
  if (keyNames.length === 0) {
    preconditions.push(
      "documento de higiene sem a lista de nomes de chave — emissor indeterminável",
    );
    return { findings, preconditions };
  }
  const { issuers, unknown } = issuersOf(keyNames);
  if (unknown.length > 0) {
    preconditions.push(
      `sem regra de emissor para ${unknown.length} chave(s): ${unknown.join(", ")}`,
    );
  }
  if (issuers.length === 0) {
    preconditions.push("nenhum emissor derivável dos nomes de chave");
    return { findings, preconditions };
  }

  // A âncora carrega o nome do provedor errado por acidente (`neon-storage.env`
  // contém "neon"): fora do texto, ela deixaria de ser sinal e viraria ruído.
  // Do texto INTEIRO, cabeçalho incluído — deixar o cabeçalho de fora fez toda
  // seção se auto-acusar de citar o provedor errado, que é o defeito oposto.
  const scan = (section.heading + "\n" + section.body).split(anchor).join(" ");

  const cited = new Set<string>();
  for (const provider of PROVIDERS) {
    const pattern = new RegExp(provider.pattern.source, "gi");
    for (const match of scan.matchAll(pattern)) {
      const index = match.index ?? 0;
      const sentence = sentenceAround(scan, index);
      if (NEGATION.test(sentence)) continue;
      cited.add(provider.id);
      if (!issuers.includes(provider.id)) {
        findings.push(
          `runbook cita \`${provider.id}\` como provedor de \`${anchor}\`, mas o emissor é ${issuers.join("/")}`,
        );
      }
    }
  }

  if (cited.size === 0) {
    preconditions.push(
      `runbook não nomeia provedor nenhum para \`${anchor}\` — nada verificado sobre o emissor`,
    );
  } else if (![...cited].some((id) => issuers.includes(id))) {
    preconditions.push(
      `runbook não nomeia nenhum dos emissores reais (${issuers.join("/")}) — citação só do provedor errado`,
    );
  }

  return { findings, preconditions };
}
