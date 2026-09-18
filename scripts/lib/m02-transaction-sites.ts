import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/**
 * Scanner puro dos *transaction sites* da matriz M-02, extraído de
 * `scripts/m02-matrix.ts` para poder ser testado sem regravar a matriz.
 *
 * Semântica declarada (substitui a busca textual `/(request|context)\.transaction/`,
 * que contava comentários, literais de string e `src/test/**`, e colapsava N
 * instruções em 1 quando o handle era apelidado):
 *
 * 1. O site nasce de uma **expressão de valor** no AST (`context.transaction` /
 *    `request.transaction`). Comentário não é nó do AST, literal de string é
 *    `StringLiteral` e `typeof context.transaction` é posição de tipo, então
 *    nenhum dos três conta.
 * 2. `const tx = <handle>.transaction` (ou `let`/`var`) é um *alias*: em vez de 1
 *    ocorrência lexical, o alias contribui com **uma entrada por referência de
 *    valor a `tx`** no seu escopo léxico — ou seja, por instrução que roda
 *    dentro da transação. Alias sem referência contribui com 0 entradas (não
 *    executa instrução alguma). Sombreamento por nome homônimo é respeitado.
 * 3. `src/test/**` é código de teste, não caminho de runtime: fica fora da
 *    varredura (o gerador enumera `src/**`).
 * 4. A classificação deixa de ser prefixo de caminho puro: o *shape* do site é
 *    evidência de runtime e tem precedência, e um arquivo só-tipo (sem instrução
 *    de valor) não produz site nenhum, logo não recebe rótulo de runtime.
 *    - `executor-fallback`: o handle só preenche o executor padrão de um
 *      parâmetro (`executor: Executor = context.transaction`) ou o lado direito
 *      de `??`/`||`; não abre transação, herda a do chamador.
 *    - `auth-allowlist`: módulo no prefixo que `scripts/m02-boundaries.ts`
 *      permite direto (`src/server/auth/**`).
 *    - `repository-fallback`: módulo de repositório consumindo o handle do
 *      contexto.
 *    - `compatibility-facade`: fachada/adapter que estreita o handle neutro.
 */

export type TransactionSiteClassification =
  "auth-allowlist" | "repository-fallback" | "compatibility-facade";

export type TransactionSiteExpression = "request.transaction" | "context.transaction";

/** Como o handle aparece no site. Ver semântica declarada no topo do módulo. */
export type TransactionSiteShape = "direct-use" | "binding-alias" | "executor-fallback";

export type TransactionSite = {
  path: string;
  line: number;
  expression: TransactionSiteExpression;
  classification: TransactionSiteClassification;
};

/** Unidade de entrada do scanner: caminho normalizado (`src/...`) + fonte. */
export type TransactionSiteSource = {
  path: string;
  source: string;
};

const HANDLE_NAMES = ["context", "request"] as const;
const AUTH_ALLOWLIST_PREFIX = "src/server/auth/";
const REPOSITORY_PREFIX = "src/server/repositories/";
const TEST_PREFIX = "src/test/";

function handleBase(expression: ts.PropertyAccessExpression): TransactionSiteExpression | null {
  if (!ts.isIdentifier(expression.expression)) return null;
  if (expression.name.text !== "transaction") return null;
  const base = expression.expression.text;
  if (!HANDLE_NAMES.includes(base as (typeof HANDLE_NAMES)[number])) return null;
  return `${base}.transaction` as TransactionSiteExpression;
}

/** Desembrulha `as T`, `(expr)` e `expr!` para achar o hospedeiro sintático. */
function unwrap(node: ts.Expression): ts.Expression {
  let current = node;
  while (
    (ts.isAsExpression(current.parent) ||
      ts.isParenthesizedExpression(current.parent) ||
      ts.isNonNullExpression(current.parent)) &&
    current.parent.expression === current
  ) {
    current = current.parent as ts.Expression;
  }
  return current;
}

/**
 * `true` quando o handle aparece em posição de **tipo** (`typeof context.transaction`):
 * não é instrução de runtime, logo não é site.
 */
function inTypePosition(node: ts.Node): boolean {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isTypeNode(current)) return true;
    if (ts.isStatement(current) || ts.isSourceFile(current)) return false;
    current = current.parent;
  }
  return false;
}

function siteShape(host: ts.Node): TransactionSiteShape {
  if (ts.isVariableDeclaration(host) && ts.isIdentifier(host.name)) return "binding-alias";
  if (ts.isParameter(host)) return "executor-fallback";
  if (
    ts.isBinaryExpression(host) &&
    (host.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      host.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    return "executor-fallback";
  }
  return "direct-use";
}

function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  const names: string[] = [];
  for (const element of name.elements) {
    // `{ tx: other }` liga `other`; `{ tx }` liga `tx`; `[a]` liga `a`.
    if (ts.isOmittedExpression(element)) continue;
    names.push(...bindingNames(element.name));
  }
  return names;
}

/** Nome introduzido por declarações que criam ligação de valor. */
function declaredName(node: ts.Node): string | undefined {
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isClassDeclaration(node) ||
    ts.isClassExpression(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node)
  ) {
    return node.name?.text;
  }
  if (
    (ts.isMethodDeclaration(node) || ts.isPropertyDeclaration(node)) &&
    ts.isIdentifier(node.name)
  ) {
    return node.name.text;
  }
  return undefined;
}

function declaredParameters(node: ts.Node): readonly ts.ParameterDeclaration[] {
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node)
  ) {
    return node.parameters;
  }
  return [];
}

/**
 * `true` quando o nó introduz uma ligação homônima e portanto sombreia o alias
 * alvo em toda a sua subárvore (parâmetro, variável, função, classe, `catch`,
 * import).
 */
function declaresName(node: ts.Node, name: string): boolean {
  if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) return true;
  if (declaredName(node) === name) return true;
  for (const parameter of declaredParameters(node)) {
    if (bindingNames(parameter.name).includes(name)) return true;
  }
  if (ts.isVariableDeclaration(node) && bindingNames(node.name).includes(name)) return true;
  if (ts.isCatchClause(node) && node.variableDeclaration) {
    return bindingNames(node.variableDeclaration.name).includes(name);
  }
  return false;
}

/** `true` quando o identificador é leitura de valor da ligação (não nome de propriedade). */
function isValueReference(node: ts.Identifier, name: string): boolean {
  if (node.text !== name) return false;
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isQualifiedName(parent) && parent.right === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  return true;
}

/** `const` é escopado pelo bloco: o bloco mais próximo é o limite do alias. */
function enclosingScope(node: ts.Node): ts.Node {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isSourceFile(current) || ts.isBlock(current) || ts.isCaseBlock(current)) return current;
    current = current.parent;
  }
  return node.getSourceFile();
}

/**
 * Referências de valor à ligação criada por `declaration`, em ordem léxica. O
 * próprio `declaration` (nome e inicializador) não conta.
 */
function bindingReferences(declaration: ts.VariableDeclaration, name: string): ts.Identifier[] {
  const references: ts.Identifier[] = [];
  const visit = (node: ts.Node): void => {
    if (node === declaration) return;
    if (declaresName(node, name)) return;
    if (ts.isIdentifier(node) && isValueReference(node, name)) references.push(node);
    ts.forEachChild(node, visit);
  };
  visit(enclosingScope(declaration));
  return references;
}

export function classifyTransactionSite(input: {
  path: string;
  shape: TransactionSiteShape;
}): TransactionSiteClassification {
  if (input.shape === "executor-fallback") return "repository-fallback";
  if (input.path.startsWith(AUTH_ALLOWLIST_PREFIX)) return "auth-allowlist";
  if (input.path.startsWith(REPOSITORY_PREFIX)) return "repository-fallback";
  return "compatibility-facade";
}

function lineAt(source: ts.SourceFile, node: ts.Node): number {
  return source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
}

function sitesForModule({ path, source }: TransactionSiteSource): TransactionSite[] {
  if (!path.startsWith("src/") || path.startsWith(TEST_PREFIX)) return [];
  const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const sites: TransactionSite[] = [];
  const push = (
    expression: TransactionSiteExpression,
    line: number,
    shape: TransactionSiteShape,
  ) => {
    sites.push({
      path,
      line,
      expression,
      classification: classifyTransactionSite({ path, shape }),
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAccessExpression(node) && !inTypePosition(node)) {
      const expression = handleBase(node);
      if (expression) {
        const host = unwrap(node).parent;
        const shape = siteShape(host);
        if (
          shape === "binding-alias" &&
          ts.isVariableDeclaration(host) &&
          ts.isIdentifier(host.name)
        ) {
          for (const reference of bindingReferences(host, host.name.text)) {
            push(expression, lineAt(parsed, reference), shape);
          }
        } else {
          push(expression, lineAt(parsed, node), shape);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return sites.sort((a, b) => a.line - b.line);
}

/**
 * Varredura determinística: a ordem da saída depende só de `path`+`line`, nunca
 * da ordem do array de entrada.
 */
export function transactionSites(sources: readonly TransactionSiteSource[]): TransactionSite[] {
  return sources
    .flatMap(sitesForModule)
    .sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line);
}

/**
 * Guarda de entrypoint: `true` quando o módulo roda como script, `false` quando
 * é apenas importado — importar `scripts/m02-matrix.ts` não pode regravar a
 * matriz.
 */
export function isEntrypoint(importMetaUrl: string, argv1: string | undefined): boolean {
  if (!argv1) return false;
  const canonical = (path: string) => {
    try {
      return realpathSync(path);
    } catch {
      return resolve(path);
    }
  };
  return canonical(fileURLToPath(importMetaUrl)) === canonical(argv1);
}
