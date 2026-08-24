# G0-002 — Hardening de artefatos locais Neon no `.gitignore`

**Data:** 2026-08-17  
**Task ID:** G0-002  
**Status:** `IMPLEMENTED_FOR_REVIEW`  
**Checkout:** `/home/douglas-souza/preco-que-d-main`  
**Branch:** `codex/local-dev-postgres`  
**HEAD observado:** `71b0dc14de2b43bd606e122695cd97bb0c1eb5f0`  
**Implementação:** Agent Código / Orquestrador  
**Revisão:** pendente; nenhum commit, staging ou push realizado

## Objetivo e escopo

Cobrir artefatos dotenv gerados localmente e o estado local do CLI Neon sem
abrir, copiar, mover ou alterar o conteúdo de qualquer credencial e sem
descartar o WIP do checkout principal.

## Alteração controlada

Foram adicionadas ao `.gitignore` as regras:

```gitignore
*.env
!*.env.example
.neon
```

As regras existentes para `.env`, `.env.*`, templates `.env.example` e o
`.worktree-*/` já presente no WIP foram preservadas. O `.worktree-*/` não faz
parte da alteração funcional desta TaskSpec e não foi removido ou reescrito.

## Verificações sanitizadas

| Alvo                       | Resultado                | Evidência resumida                                                 |
| -------------------------- | ------------------------ | ------------------------------------------------------------------ |
| `.neon`                    | ignorado                 | regra `.neon`                                                      |
| `neon-storage.env`         | ignorado                 | regra `*.env`                                                      |
| `.env`                     | ignorado                 | regra `*.env`                                                      |
| `.env.local`               | ignorado                 | regra `*.local` existente                                          |
| `.env.example`             | preservado como template | regra de negação `!*.env.example`; `git check-ignore` retornou `1` |
| `neon-storage.env.example` | preservado como template | regra de negação `!*.env.example`; `git check-ignore` retornou `1` |

`git ls-files --error-unmatch -- .neon neon-storage.env .env .env.local`
não encontrou nenhum alvo rastreado (`exit 1` esperado; nenhuma saída de
caminho). O status ignorado observado para os artefatos presentes foi:

```text
!! .env
!! .neon
!! neon-storage.env
```

Nenhum conteúdo de `.neon`, `neon-storage.env` ou qualquer outro arquivo de
credencial foi lido ou impresso.

## Comandos executados

```text
git diff -- .gitignore
git diff --check
git check-ignore -v --no-index -- .neon neon-storage.env .env .env.local
git check-ignore -v --no-index -- .env.example neon-storage.env.example
git ls-files --error-unmatch -- .neon neon-storage.env .env .env.local
git status --short --ignored -- .neon neon-storage.env .env .env.local .env.example neon-storage.env.example
```

`git diff --check` passou. A inspeção do status preservou os arquivos
modificados e não rastreados que já pertenciam ao WIP; não houve `git add -A`,
staging, commit, push, merge, alteração de CI, acesso ao Neon ou alteração de
produção.

## Critérios de aceite

- [x] `.neon` e `neon-storage.env` aparecem como ignorados.
- [x] `.env.example` e `neon-storage.env.example` permanecem templates não ignorados.
- [x] Nenhum alvo sensível está rastreado.
- [x] O conteúdo dos artefatos não foi aberto nem exposto.
- [x] O WIP do checkout principal foi preservado.
- [x] Revisão independente de Segurança/Contenção: `APPROVE`.
- [x] Revisão independente de Git/CI/Evidência: `APPROVE`.

## Pareceres independentes

### Segurança/Contenção

- **Reviewer:** independent Security/Containment reviewer
- **Verdict:** `APPROVE`
- **Severity:** blocker 0, high 0, medium 0, low 0
- **Findings:** nenhum achado material; regras efetivas cobrem os artefatos e
  preservam os templates; nenhum segredo foi lido ou impresso.
- **Missing tests/evidence:** nenhum.

### Git/CI/Evidência

- **Reviewer:** Codex — revisor independente de Git/CI/Evidência
- **Verdict:** `APPROVE`
- **Severity:** blocker 0, high 0, medium 0, low 0
- **Findings:** nenhum; allowlist restrita ao `.gitignore` e à evidência,
  WIP preservado, sem staging/commit/push e sem exposição de segredos.
- **Missing tests/evidence:** nenhum para o escopo local de G0-002.
- **Limite:** CI externo, Neon e cutover não foram inferidos como validados.

## Decisão atual

`APPROVE` para a implementação local de G0-002 e para a preparação da
evidência. A aprovação é limitada a esta TaskSpec; não autoriza, por si só,
commit, push, CI, Neon, migração, merge ou cutover. Um commit exigirá uma
TaskSpec de commit separada e a allowlist explícita dos dois arquivos desta
tarefa.
