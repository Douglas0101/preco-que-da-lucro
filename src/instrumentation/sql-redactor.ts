/**
 * Redator de SQL para telemetria (§19.3): remove literais e comentários antes
 * que qualquer texto de query vire atributo de span.
 *
 * Contrato:
 * - `$1`, `$2`, ... (placeholders) são preservados — `values` nunca é anexado;
 * - literais entre aspas simples (inclusive `''` escapado e prefixo `E'...'`)
 *   e dollar-quoted (`$tag$...$tag$`) viram `?`;
 * - identificadores entre aspas duplas são preservados;
 * - comentários `--` e `/* *\/` (aninhados) são removidos;
 * - o resultado é normalizado (espaços colapsados) e truncado em `maxLength`
 *   caracteres, com sufixo `...`;
 * - a operação (`SELECT`, `INSERT`, ...) é derivada do texto redigido e cai
 *   para `QUERY` quando não reconhecida.
 */

export const SQL_REDACTION_MAX_LENGTH = 256;
const TRUNCATION_SUFFIX = "...";
const OPERATION_PROBE_LENGTH = 64;

const SQL_OPERATIONS = new Set([
  "ALTER",
  "ANALYZE",
  "BEGIN",
  "CALL",
  "CHECKPOINT",
  "CLOSE",
  "CLUSTER",
  "COMMENT",
  "COMMIT",
  "COPY",
  "CREATE",
  "DEALLOCATE",
  "DECLARE",
  "DELETE",
  "DISCARD",
  "DO",
  "DROP",
  "EXECUTE",
  "EXPLAIN",
  "FETCH",
  "GRANT",
  "IMPORT",
  "INSERT",
  "LISTEN",
  "LOAD",
  "LOCK",
  "MERGE",
  "MOVE",
  "NOTIFY",
  "PREPARE",
  "REFRESH",
  "REINDEX",
  "RELEASE",
  "RESET",
  "REVOKE",
  "ROLLBACK",
  "SAVEPOINT",
  "SELECT",
  "SET",
  "SHOW",
  "START",
  "TABLE",
  "TRUNCATE",
  "UNLISTEN",
  "UPDATE",
  "VACUUM",
  "VALUES",
  "WITH",
]);

function normalizeLimit(maxLength: number): number {
  if (!Number.isFinite(maxLength) || maxLength < TRUNCATION_SUFFIX.length + 1) {
    return SQL_REDACTION_MAX_LENGTH;
  }
  return Math.floor(maxLength);
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - TRUNCATION_SUFFIX.length)}${TRUNCATION_SUFFIX}`;
}

/** Consome `'...'` (com `''` escapado; backslash também protege o próximo
 * caractere para não vazar o resto da query em strings `E'...'`). */
function consumeSingleQuoted(sql: string, start: number): number {
  let index = start + 1;
  while (index < sql.length) {
    const char = sql[index];
    if (char === "\\" && index + 1 < sql.length) {
      index += 2;
      continue;
    }
    if (char === "'") {
      if (sql[index + 1] === "'") {
        index += 2;
        continue;
      }
      return index + 1;
    }
    index += 1;
  }
  return sql.length;
}

function consumeDoubleQuoted(sql: string, start: number): number {
  let index = start + 1;
  while (index < sql.length) {
    if (sql[index] === '"') {
      if (sql[index + 1] === '"') {
        index += 2;
        continue;
      }
      return index + 1;
    }
    index += 1;
  }
  return sql.length;
}

function consumeLineComment(sql: string, start: number): number {
  let index = start + 2;
  while (index < sql.length && sql[index] !== "\n") index += 1;
  return index;
}

function consumeBlockComment(sql: string, start: number): number {
  let depth = 1;
  let index = start + 2;
  while (index < sql.length) {
    if (sql[index] === "/" && sql[index + 1] === "*") {
      depth += 1;
      index += 2;
      continue;
    }
    if (sql[index] === "*" && sql[index + 1] === "/") {
      depth -= 1;
      index += 2;
      if (depth === 0) return index;
      continue;
    }
    index += 1;
  }
  return sql.length;
}

/** Reconhece o delimitador de dollar-quote (`$$` ou `$tag$`); `$1` não casa
 * porque o tag não pode começar com dígito. */
function dollarQuoteDelimiter(sql: string, start: number): string | undefined {
  let index = start + 1;
  while (index < sql.length && /[A-Za-z0-9_]/.test(sql[index]!)) index += 1;
  if (index >= sql.length || sql[index] !== "$") return undefined;
  const tag = sql.slice(start + 1, index);
  if (tag.length > 0 && !/^[A-Za-z_]/.test(tag)) return undefined;
  return sql.slice(start, index + 1);
}

function consumeDollarQuoted(sql: string, start: number, delimiter: string): number {
  const end = sql.indexOf(delimiter, start + delimiter.length);
  return end < 0 ? sql.length : end + delimiter.length;
}

/** Redige um SQL: literais/comentários fora, espaços colapsados, truncado. */
export function redactSqlText(sql: string, maxLength = SQL_REDACTION_MAX_LENGTH): string {
  if (typeof sql !== "string" || sql.length === 0) return "";
  const limit = normalizeLimit(maxLength);
  const parts: string[] = [];
  let index = 0;
  while (index < sql.length) {
    const char = sql[index]!;
    if (char === "'") {
      index = consumeSingleQuoted(sql, index);
      parts.push("?");
      continue;
    }
    if (char === '"') {
      const end = consumeDoubleQuoted(sql, index);
      parts.push(sql.slice(index, end));
      index = end;
      continue;
    }
    if (char === "-" && sql[index + 1] === "-") {
      index = consumeLineComment(sql, index);
      parts.push(" ");
      continue;
    }
    if (char === "/" && sql[index + 1] === "*") {
      index = consumeBlockComment(sql, index);
      parts.push(" ");
      continue;
    }
    if (char === "$") {
      const delimiter = dollarQuoteDelimiter(sql, index);
      if (delimiter) {
        index = consumeDollarQuoted(sql, index, delimiter);
        parts.push("?");
        continue;
      }
    }
    parts.push(char);
    index += 1;
  }
  const normalized = parts.join("").replace(/\s+/g, " ").trim();
  return truncate(normalized, limit);
}

/** Primeira palavra do SQL redigido, em maiúsculas (semconv `db.operation.name`). */
export function normalizeSqlOperation(sql: string | undefined): string {
  if (typeof sql !== "string" || sql.trim() === "") return "QUERY";
  const head = redactSqlText(sql, OPERATION_PROBE_LENGTH);
  const match = /^[A-Za-z][A-Za-z0-9_]*/.exec(head);
  if (!match) return "QUERY";
  const operation = match[0].toUpperCase();
  return SQL_OPERATIONS.has(operation) ? operation : "QUERY";
}
