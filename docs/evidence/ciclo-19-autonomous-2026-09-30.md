# Ciclo 19 — fluxo autônomo com observabilidade (2026-09-30)

> Registro de integração das três fatias disjuntas e das decisões de registro do MAESTRO.
> **Escritor:** enxame (3 agentes) + integrador. **Base:** `789e9a1` (`c18/sonar-exclusion`).
> **Commits `c18/state-marker` NÃO foram tocados** — instrução do MAESTRO, respeitada sem exceção.

## 1. Hipótese

`DBT-56` (o passo de schema diff reprovando produção já migrada) é um **defeito de predicado**, não de
infraestrutura: o passo decide por _vazio/não-vazio_ quando a variável que separa os dois estados — o
conjunto de migrations aplicadas — está disponível e nunca era lida. `DBT-55` dependia de um re-baseline
que este ambiente talvez não consiga disparar. A branch de ensaio é descartável por construção.

## 2. Medido antes

| item                                                   | medição pré                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| head                                                   | `789e9a1`, `npm run check` exit 0 no tree anterior                       |
| `SONAR_TOKEN` / `SONAR_API_TOKEN` / `SONARQUEBE_TOKEN` | **UNSET** no ambiente                                                    |
| `neonctl`                                              | **NÃO instalado** (`which` vazio; sem bin em `node_modules/.bin`)        |
| `curl` / `jq`                                          | disponíveis                                                              |
| tokenizer do Sonar                                     | `Sonar.txt` (gitignored, 0600) — 40 chars, `validate` → `{"valid":true}` |
| produção Neon                                          | migrations `0012`–`0019` aplicadas; 20 linhas, 37 tabelas                |

## 3. Mudança — as três fatias

### F19-A · `DBT-56` — FECHADA

`scripts/db/schema-diff-verdict.ts` (novo) decide o veredito pelos **journals**
(`drizzle.__drizzle_migrations`, hashes sha256) lidos na branch do PR **e** em produção; o passo
`schema_diff` de `.github/workflows/neon-pr-branch.yml` mantém `compare_schema` para o artefato bruto e
**delega o veredito** ao módulo. O literal `mas o diff saiu vazio` saiu do YAML (`grep -c` → **0**).

Os cinco sentidos, com `src/test/schema-diff-verdict.test.ts` = **23 passed**:

| sentido | estado                                                         | veredito                             |
| ------- | -------------------------------------------------------------- | ------------------------------------ |
| (a)     | journals **IGUAIS** + diff vazio (o caso medido que reprovava) | `consistente: produção já migrada`   |
| (b)     | journals divergentes + diff vazio                              | `INCONSISTENTE`                      |
| (c)     | journal **vazio** dos dois lados                               | `INCONSISTENTE` (não-vacuidade)      |
| (d)     | falha de leitura em qualquer ponta                             | `INCONSISTENTE`, distinguível de (a) |
| (e)     | schema genuinamente divergente                                 | comportamento antigo preservado      |

**O controle negativo é a própria forma removida:** o teste
`(a) o predicado antigo reprovava exatamente esta entrada` reconstrói o `predicadoAntigo` e prova que ele
devolve `INCONSISTENTE` na **mesma** entrada que o módulo novo aceita. Sem ele, os outros 22 testes seriam
congruentes com um check que aprova tudo.

Política de alvo: sem check de loopback ad-hoc — branch por `exigirAlvoDeBanco`, baseline por
`classificarAlvo`, ambas de `scripts/lib/db-target.ts`. Leitura em transação `read only`, SQL constante.

### F19-B · `DBT-55` — **NÃO FECHADA**; premissa do brief refutada por medição

O re-baseline **não é disparável deste ambiente**, por três medições independentes:

1. `POST /api/analysis_engine/reanalyze` → **HTTP 404 `Unknown url`**;
2. varredura de **toda** a superfície da API (`GET /api/webservices/list`, **33** serviços) — **nenhuma**
   ação de disparo de análise;
3. o projeto está em **Automatic Analysis**, que **proíbe por desenho** análise via CI; desligá-la é
   restrito ao plano **Enterprise** e esta org é **Free**.

`fd9449f` e `789e9a1` **nunca** foram analisados.

**Correções ao registro anterior (medidas, não estimadas):**

- distribuição real **374 CODE_SMELL / 19 VULNERABILITY / 15 BUG** (= 408), **não** "356/71/19";
- **duas** condições reprovam — `new_reliability_rating`=4 **e** `new_security_rating`=5;
- `&sinceLeakPeriod=true` devolve os **408**: todos são _new code_.

`set_baseline` existe e exigiria `Administer`, mas **não foi chamada**: PRs não são aceitos por essa rota
e ela mudaria _o que é medido_ sem remover um defeito.

**Ação humana única que destrava:** desmarcar **Automatic Analysis** em _Administration → General
Settings_ (ou criar token de CI) e analisar `main` em `fd9449f`.

### F19-C · branch de ensaio — APAGADA

`c18-migration-rehearsal` = `br-little-thunder-ay1oz7c4`, **32,71 MiB**. Filha de `production`
(`primary=false`, `default=false`). Segurança provada antes de agir: árvore **idêntica** à de produção
(**194 vs 194** objetos, **37 vs 37** tabelas, `diff -u` com **0** linhas), uso **0** vs compute
**7.406 s** em produção. O agente **não** invocou a ferramenta destrutiva (instrução do MCP); a aprovação
humana foi obtida e a execução feita pelo integrador.

**Pós-condição medida:** `list_branches` → **9** branches (eram **10**), `c18-migration-rehearsal`
ausente, `production` ainda `primary=true`/`default=true`.

### F19-D · registro

`DBT-36` → **`EM_TRATAMENTO`** (adiada), `DBT-55` → **`EM_TRATAMENTO`** (bloqueada por Automatic
Analysis), `DBT-56` → **`FECHADA`**. Journal `L261`–`L264`.

## 4. Depois

| gate                                                  | antes   | depois                                                     |
| ----------------------------------------------------- | ------- | ---------------------------------------------------------- |
| `npm run m02:debts-guard`                             | OK (39) | **OK (39 dividas, taxonomia e regra de closure)**          |
| `npx vitest run src/test/schema-diff-verdict.test.ts` | n/a     | **23 passed**, exit 0                                      |
| `m02:matrix:check`                                    | OK      | reprovou (contador 49→50) → `m02:matrix:generate` → **OK** |
| `format:check`                                        | OK      | reprovou (25 arquivos) → `prettier --write` → **OK**       |
| `npm run check` (20 scripts)                          | exit 0  | **exit 0**                                                 |
| branches Neon                                         | 10      | **9**                                                      |

**Diff da matriz revisado** (conforme `AGENTS.md`): apenas `directDatabaseFiles: 49 → 50` nomeando
`src/test/schema-diff-verdict.test.ts`. Nada mais se moveu.

## 5. Resultado

`DBT-56` fechada com os dois sentidos executados. Branch de ensaio removida. `DBT-36` adiada com
justificativa medida e gatilhos de retomada. `DBT-55` **permanece aberta** — o brief a tratava como
executável e ela não é.

## 6. Limites declarados

- **L1 —** a contagem de linhas de `drizzle.__drizzle_migrations` na branch apagada **não** foi re-medida:
  o toolset Neon MCP não expõe execução de SQL, `psql` não está instalado e o `DATABASE_URL` do `.env`
  aponta para `127.0.0.1`. O valor 20 vem de `L257`.
- **L2 —** `DBT-55` segue aberta e **não** há número pós-baseline. Ausência de análise **não** foi
  relatada como verde.
- **L3 —** a leitura `describe_branch` da branch de ensaio **iniciou** o compute dela (op `5d36a611`,
  22:43:04Z). Nenhum dado escrito; o custo morreu com a branch.
- **L4 —** a razão pela qual `main` não foi analisado **não é determinável** daqui (_automatic analysis
  logs are not available_). Hipóteses — fila descartada, filtro de evento, limite de _branch_ default no
  Free — **não** foram adotadas como verdade.
- **L5 —** `DBT-36` adiada **não** é quitação: `npm run check` segue verde porque o item nunca foi gate.
- **L6 —** a área autenticada de produção segue não validada (zero usuários) — limite herdado do Ciclo 18.

## 7. Higiene de segredo

Auditoria por `grep -F` do valor **completo** do token do Sonar sobre `docs/ scripts/ src/ .github/` →
**0** ocorrências. O valor nunca foi impresso, nunca saiu do processo (header injetado por `curl -K -`
via stdin, fora de argv) e não entrou em nenhuma evidência.

## 8. Artefatos

- `docs/evidence/dbt-56-schema-diff-2026-09-30.md`
- `docs/evidence/sonar-baseline-2026-09-30.md` + `sonar-baseline/captures/` (**16** capturas)
- `docs/evidence/ciclo-19-sonar-dbt55-2026-09-30.md`
- `docs/evidence/neon-branch-cleanup-2026-09-30.md` + `neon-branch-cleanup/captures/`
- Journal: `docs/evidence/agent-state/PROGRESS.md` `L261`–`L264`
