#!/usr/bin/env bash
#
# scripts/verify-mcp-relaunch.sh — verificação de relançamento do cliente MCP.
#
# Por que existe: o mecanismo do DBT-32 é um servidor MCP stdio lançado por um runner sem pin
# e sem `cwd`. Quando o diretório corrente é um checkout, a instalação acontece **na árvore
# desse checkout** e `package.json` / `package-lock.json` são reescritos. A asserção que
# distingue "relancei e nada quebrou" de "relancei e a árvore foi reescrita" é a comparação
# dos dois manifestos — não a impressão de que as ferramentas subiram. Este script torna essa
# comparação reproduzível em vez de manual, e é por isso que ele existe separado do runbook.
#
# Este script NÃO relança o cliente: isso é o passo humano do runbook
# (`docs/runbooks/mcp-relaunch.md` § Procedimento), porque um MCP stdio é lançado **no
# processo do cliente** e não há recarga a quente.
#
# Uso:
#   scripts/verify-mcp-relaunch.sh --snapshot <arquivo>   # estado ANTES do relançamento
#   scripts/verify-mcp-relaunch.sh --verify   <arquivo>   # estado DEPOIS (compara)
#   scripts/verify-mcp-relaunch.sh                        # só as checagens estáticas
#
# Exit: 0 limpo · 1 verificação reprovada · 2 pré-condição não satisfeita (alvo ausente,
#       cofre inacessível, manifesto ausente). A ordem importa: uma violação real vence uma
#       pré-condição faltante, porque "olhei e está sujo" é mais forte que "não consegui olhar".
#
# Segurança: este script não lê, imprime nem persiste valor de segredo. Ele invoca o guard de
# runtime, que cita segredo apenas por nome da variável, tamanho e `sha256:<12 hex>` — e há
# teste dedicado para essa propriedade (`src/test/mcp-runtime-guard.test.ts`), porque uma
# guarda de segredo que imprime o segredo é um vetor, não uma guarda.

set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIDECAR="${SIDECAR_BIN:-$HOME/.mcp-runtime/secret-sidecar/bin/sidecar}"
BACKEND="${SIDECAR_BACKEND:-cofre}"
MANIFESTOS=(package.json package-lock.json)

VEREDITO=0
PRECONDICAO=0

ok() { printf '  ok      %s\n' "$*"; }
ruim() { printf '  RUIM    %s\n' "$*"; VEREDITO=1; }
nota() { printf '  nota    %s\n' "$*"; }
falta() { printf '  FALTA   %s\n' "$*"; PRECONDICAO=1; }

modo=estatico
arquivo=
case "${1:-}" in
  --snapshot) modo=snapshot; arquivo="${2:-}" ;;
  --verify) modo=verify; arquivo="${2:-}" ;;
  "") ;;
  -h | --help)
    sed -n '3,26p' "${BASH_SOURCE[0]}"
    exit 0
    ;;
  *)
    printf 'precondicao: argumento desconhecido: %s\n' "$1" >&2
    exit 2
    ;;
esac
if [ "$modo" != estatico ] && [ -z "$arquivo" ]; then
  printf 'precondicao: --%s exige um caminho de arquivo\n' "$modo" >&2
  exit 2
fi

cd "$RAIZ" || {
  printf 'precondicao: raiz do repositorio inacessivel: %s\n' "$RAIZ" >&2
  exit 2
}

echo "== 1/5 pre-condicoes =="
if [ -x "$SIDECAR" ]; then
  ok "lancador do sidecar executavel"
else
  falta "lancador do sidecar ausente ou nao executavel: $SIDECAR"
fi
manifestos_ok=1
for m in "${MANIFESTOS[@]}"; do
  [ -f "$m" ] || {
    falta "manifesto ausente: $m"
    manifestos_ok=0
  }
done
[ "$manifestos_ok" -eq 1 ] && ok "manifestos presentes"

echo "== 2/5 sidecar: cofre ($BACKEND) =="
saida_health="$("$SIDECAR" health --backend="$BACKEND" 2>&1)"
codigo_health=$?
case "$codigo_health" in
  0) ok "cofre responde: $saida_health" ;;
  2) falta "cofre indisponivel — pre-condicao, nao veredicto: $saida_health" ;;
  *) ruim "health do cofre falhou (exit $codigo_health): $saida_health" ;;
esac

echo "== 3/5 sidecar: integridade do audit log =="
saida_audit="$("$SIDECAR" verify 2>&1)"
codigo_audit=$?
case "$codigo_audit" in
  0) ok "audit legivel: $saida_audit" ;;
  2) falta "audit nao pode ser lido — pre-condicao: $saida_audit" ;;
  *) ruim "audit malformado (exit $codigo_audit): $saida_audit" ;;
esac

echo "== 4/5 guardas do repositorio =="
npm run --silent m02:lockfile-guard >/dev/null 2>&1
codigo_lock=$?
case "$codigo_lock" in
  0) ok "m02:lockfile-guard verde" ;;
  2) falta "m02:lockfile-guard: pre-condicao (exit 2)" ;;
  *) ruim "m02:lockfile-guard reprovou (exit $codigo_lock) — um relancamento com a arvore ja driftada nao distingue causa nova de causa antiga" ;;
esac

npm run --silent guard:mcp-runtime >/dev/null 2>&1
codigo_guard=$?
case "$codigo_guard" in
  0) ok "guard:mcp-runtime (escopo-repositorio) verde" ;;
  2) falta "guard:mcp-runtime: pre-condicao (exit 2)" ;;
  *) ruim "guard:mcp-runtime (escopo-repositorio) reprovou (exit $codigo_guard)" ;;
esac

echo "== 5/5 configuracao viva da maquina (escopo-maquina) =="
saida_home="$(npm run --silent guard:mcp-runtime -- --home 2>&1)"
codigo_home=$?
case "$codigo_home" in
  0) ok "config da maquina limpa" ;;
  1)
    nota "config da maquina com violacao — isto e a FORMA da linha, nao dano a arvore;"
    nota "corrija pelo runbook passo 3. Saida do guard:"
    printf '%s\n' "$saida_home" | sed 's/^/          /'
    ;;
  2) falta "escopo-maquina nao pode medir (exit 2): $saida_home" ;;
  *) ruim "guard:mcp-runtime --home inesperado (exit $codigo_home)" ;;
esac

if [ "$modo" != estatico ]; then
  echo "== manifestos (a assercao que fecha o mecanismo) =="
  if [ "$modo" = snapshot ]; then
    if sha256sum "${MANIFESTOS[@]}" >"$arquivo"; then
      ok "estado ANTES gravado em $arquivo"
    else
      falta "nao foi possivel gravar o snapshot em $arquivo"
    fi
  else
    if [ ! -f "$arquivo" ]; then
      falta "snapshot ausente: $arquivo — grave com --snapshot ANTES de relancar"
    elif diff <(sha256sum "${MANIFESTOS[@]}") "$arquivo" >/dev/null; then
      ok "manifestos IDENTICOS ao estado anterior — o relancamento nao reescreveu a arvore"
    else
      ruim "manifestos MUDARAM — este e o mecanismo do DBT-32:"
      diff <(sha256sum "${MANIFESTOS[@]}") "$arquivo" | sed 's/^/          /'
    fi
  fi
fi

echo
if [ "$VEREDITO" -ne 0 ]; then
  printf 'veredicto: REPROVADO\n'
  exit 1
fi
if [ "$PRECONDICAO" -ne 0 ]; then
  printf 'veredicto: PRECONDICAO NAO SATISFEITA (nao e reprovacao)\n'
  exit 2
fi
printf 'veredicto: OK\n'
exit 0
