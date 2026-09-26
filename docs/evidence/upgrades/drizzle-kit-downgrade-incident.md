# Incidente: downgrade de `drizzle-kit` quebrou a toolchain de migration

- **Data:** 2026-09-25
- **Severidade:** SEV-2 (fluxo crítico degradado — gate local vermelho, sem impacto em produção)
- **Classe da mudança:** **M4 — downgrade** (a mais alta das sete classes do plano de governança de
  dependências)
- **Estado:** causa raiz **fechada** neste ciclo; prevention **entregue**; veredito do registry é do
  MAESTRO (ver §6)

## 1. O que aconteceu

Um WIP não commitado rebaixou `drizzle-kit` de `^0.31.10` para `^0.18.1` em `package.json`, com
`package-lock.json` reescrito em sincronia. A árvore compilava, o `npm ci` instalava, e mesmo assim
**dois gates vermelhos**:

| gate                 | saída medida     | por quê                                                                                                |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------ |
| `m02:lockfile-guard` | exit 1, 4 razões | spec, lock resolvido, sha do lock e versão instalada fora do contrato `^0.31.x`                        |
| `npm run typecheck`  | exit 2, 1 erro   | `drizzle.config.ts(1,10): error TS2305 — Module '"drizzle-kit"' has no exported member 'defineConfig'` |

A versão `0.18.1` é **anterior ao símbolo `defineConfig`**, que `drizzle.config.ts:1` importa. Como
`npm ci` também instalou a versão rebaixada, a falha apareceu **antes** de qualquer migration rodar —
o melhor desfecho possível para uma toolchain quebrada, e o pior possível para quem confia em
"instalou, logo funciona".

**Por que não foi pego antes:** o `m02-lockfile-guard` já declarava `^0.31.x` como contrato, mas a
faixa vivia **hardcoded em dois lugares** (o regex do guard e a spec do `package.json`), sem nada que
os amarasse. E não existia verificação alguma de **ausência do símbolo** — só de faixa.

## 2. Fase A — estabilização (executada e medida)

| passo                            | resultado medido                                                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Isolar o WIP                     | branch `wip/drizzle-kit-downgrade-2026-09-25`, commit `944401c` — o trabalho do dono está preservado, não foi jogado fora |
| Reverter os manifests            | `package.json` volta a `^0.31.10`; `npm ci --ignore-scripts` ⇒ `drizzle-kit@0.31.10` instalado                            |
| `m02:lockfile-guard`             | **exit 0**, `ok: true`, 0 razões, 6 checks                                                                                |
| `typecheck`                      | **exit 0**                                                                                                                |
| `db:classify:check`              | **20/20 classificadas**                                                                                                   |
| `db:check` (`drizzle-kit check`) | _Everything's fine_ — a toolchain lê as migrations existentes                                                             |
| `npm run test`                   | **1.036 verdes**, 13 pulados, 99 arquivos                                                                                 |
| `npm run build`                  | ok                                                                                                                        |
| `check:bundle`                   | PASS                                                                                                                      |

## 3. Causa raiz corrigida na fonte

O `m02-lockfile-guard` tinha a faixa escrita dentro do próprio arquivo (`const SPEC_RE = /^\^0\.31\.\d+$/`).
Isso garante drift: quem someday ampliar a política continuaria com o guard antigo rejeitando, e quem
rebaixasse veria duas fontes discordando. A faixa passou a vir de
**`scripts/dependency-policy.json`** — fonte única, consumida pelos três guardas.

O comportamento observável do guard foi **preservado**: mesmo `schema: "m02-lockfile-guard/1"`, mesmos
`id`s de check, mesma flag `--no-node-modules`, mesmas saídas `0`/`1`. A mudança é de **origem da
verdade**, não de contrato — e a checagem nova é `dependency-policy`, que sai com `2` (precondição)
quando a política está ausente ou tem faixa invertida, porque uma guarda que aprova sem saber a
política é pior que nenhuma.

## 4. Prevenção entregue

| peça                                                                                      | o que faz                                                                                                                                                                                                                                                            |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/dependency-policy.json`                                                          | 15 pacotes com `criticality`, faixa `min`→`max` e motivo. `drizzle-kit` é `critical` em `0.31.0..0.31.99`                                                                                                                                                            |
| `scripts/lib/upgrade-guard.ts` + `src/test/upgrade-guard.test.ts`                         | política geral: presença, faixa da spec, faixa do lock, faixa do instalado, e **downgrade contra o `HEAD`** com Downgrade Request em `scripts/dependency-approvals/`. **39 casos**, dos quais 17 reprovam um veredito e 5 exigem `skip` em vez de `pass`             |
| `scripts/lib/migration-toolchain-guard.ts` + `src/test/migration-toolchain-guard.test.ts` | checagem derivada: faixa, **presença do símbolo `defineConfig` nos types**, carga de `drizzle.config.ts`, migrations classificadas, separação `DATABASE_URL`/`DATABASE_ADMIN_URL`. **28 casos**, incluindo o incidente real reprovando por duas razões independentes |
| `m02-lockfile-guard.mjs`                                                                  | passa a derivar a faixa da mesma política (sem duplicar a verdade)                                                                                                                                                                                                   |

Ambos os guardas são **fail-closed nas duas direções** e distinguem `0` (pass), `1` (veredito) e
`2` (precondição). Precondição nunca é `pass`. Nenhuma dependência nova foi adicionada — implementar
a política de dependências com uma dependência seria incoerente.

### Aprovação não é atalho

Um Downgrade Request **não** desliga a política: ele satisfaz a exigência de _aprovação_, e o finding
de **spec fora da faixa continua reprovando**. Medido: com o arquivo de aprovação presente, o finding
`downgrade` some e o finding `spec` permanece. Quem quiser de fato rebaixar tem de ampliar a faixa na
política **de propósito, em commit visível** — que é a revisão que a política existe para forçar.

## 5. Prova de falsificação fora da suíte

Nenhum controle negativo foi aceito por estar "verde na suíte". Todos foram executados contra a
árvore real, com mutação e restauração:

| prova                       | mutação                                         | veredito                                                                                                                               |
| --------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `m02-lockfile-guard`        | `package.json` → `^0.18.1`                      | **exit 1**, `spec '^0.18.1' fora da faixa aprovada 0.31.0..0.31.99` + `lock '^0.31.10' != package.json '^0.18.1'`. Restaurado ⇒ exit 0 |
| `upgrade-guard`             | `package.json` → `^0.18.1` (HEAD em `^0.31.10`) | **exit 1**, duas findings nomeando pacote, lado, observado e esperado, e o arquivo de aprovação ausente                                |
| `upgrade-guard`             | + arquivo de aprovação indevido                 | **exit 1**, só a finding de `spec` — a aprovação remove o finding de downgrade e **não** o de faixa                                    |
| `migration-toolchain-guard` | política com `min: 0.99.0`                      | **exit 1**, faixa degenerada detectada **e** instalado abaixo do mínimo. Restaurado ⇒ exit 0                                           |

## 6. Limites declarados

1. **`docs/evidence/agent-state/DEBTS.md` não foi editado** — o registry é do MAESTRO. A entrada
   para este incidente está em
   `docs/sdd/SDD-20260925-dependency-policy/MAESTRO-REQUEST-DEPENDENCY-DEBT.md`, com closure test
   apontando para os dois arquivos de teste.
2. **Verde local, não CI.** O CI por push segue bloqueado por cota desde 2026-09-21. Nenhum
   `run@sha` é citado aqui porque não houve run. Push de _branch de feature_ não dispara workflow
   (os `on.push` são `main`/`develop`), portanto não consome cota; PR aberto consome.
3. **A light pipeline não roda os dois guardas novos** — leem `node_modules`, e a light não instala
   dependências por desenho. O buraco de cobertura é nulo: um push que muda `package.json` ou
   `package-lock.json` nunca é docs-only, então a heavy é sempre disparada. Isso está registrado como
   `✘` nomeado na tabela de cobertura do `AGENTS.md`, e
   `src/test/m02-ci-coverage.test.ts` passa a exigir que a tabela e a cadeia `check` concordem.
4. **Não executado:** `db:test` (exige container PG17) e e2e Playwright (exige preview e browsers).
   O guard de toolchain é deliberadamente **sem banco** para poder rodar no pipeline leve; a
   conectividade continua no tier `db:test`, que não foi tocado.
5. **Achado colateral, corrigido:** `npm run format:check` **já estava vermelho** em `develop` antes
   deste ciclo — oito relatórios de `docs/auditoria-publicacao/` entraram sem formatação em
   `a734cb2`. Corrigido em `294f660` (`chore(format)`), sem afrouxar regra e sem excluir arquivo.
6. **Defeito meu, corrigido no caminho:** a primeira versão do teste de DBT-19 fixava `toHaveLength(16)`
   — cardinalidade, não identidade. Ao entrar um gate novo ela reprovou, e a correção trocou o número
   por igualdade de conjuntos (tabela ↔ cadeia). Cardinalidade envelhece sozinha e passa a mentir.

## 7. Rollback

Cada peça é reversível isoladamente, e a ordem importa:

```text
1. política:   git revert <commit da política>   # volta a faixa anterior
2. guardas:    git revert <commit dos guardas>   # remove as entradas novas da cadeia `check`
3. wiring:     git revert <commit do AGENTS.md>   # remove a linha nova da tabela
4. WIP:        git cherry-pick 944401c            # recupera o rebaixamento, se for mesmo wanted
```

## 8. O que este incidente ensina

O sintoma (`typecheck` quebrado) foi o mais barato possível. O que quase passou é pior: a faixa
declarada, o lockfile e o `node_modules` concordavam entre si — **os três estavam errado juntos**, e
conferir um contra o outro só prova que o erro é coerente, não que ele não existe. A verificação que
faltava não é sobre o número: é sobre **o símbolo**. `defineConfig` é o contrato real entre a
toolchain e o código, e ele não está em nenhum dos três lugares que se auto-validavam.
