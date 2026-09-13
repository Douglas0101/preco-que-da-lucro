# G-SEC T2 — Endurecimento estrutural (designs spec-first, sem implementação)

Rodada analítica: nenhum item abaixo é código entregue; são specs prontas para a
rodada de fix. Prioridade marcada por item.

## T2.1 — ENV-GUARD (prioridade máxima) — default-DENY para banco remoto

**Hazard**: o `.env` do checkout aponta `DATABASE_URL`/`DATABASE_URL_UNPOOLED`
para o Neon de PRODUÇÃO (`ep-long-violet-aye9g0bn[-pooler]`). `vite dev`,
`tsx` e scripts que auto-carregam `.env` podem ler/escrever produção sem
intenção. A proteção atual é checagem manual do agente (Fase 0 bloqueou
corretamente a suíte contra Neon) — **a checagem manual não pode continuar
sendo a proteção** (GAP-DOC da norma).

**Norma (emenda datada em `docs/specs/M-02/`)**: nenhum comando de teste,
mutação de schema ou servidor de dev pode conectar a banco com hostname fora de
{`127.0.0.1`, `localhost`, `::1`}. Operações remotas existem apenas na allowlist
de ops sancionadas, cada uma com evidência própria.

**Spec do script `scripts/env-guard.mjs`** (fail-closed):

1. Entrada: nome do lifecycle event (`npm_lifecycle_event`) + env analisada.
2. **DENY** (exit 3, mensagem com remedio) se o comando está no conjunto
   `test | dev | build:dev | e2e:prepare | test:e2e | db:test | db:migrate |
db:generate | db:check` e qualquer de
   `DATABASE_URL | DATABASE_URL_UNPOOLED | DATABASE_ADMIN_URL | DATABASE_RESTORE_URL`
   estiver definida com hostname **não-local**.
3. **ALLOW** (allowlist explícita de ops sancionadas, produção read-only ou
   drill autorizado): `smoke:substrate`, `m02:readiness`, `m02:backup-verify`,
   `migration:legacy-to-neon`, sondas da emenda de probes.
4. Override único: `ALLOW_REMOTE_DB=<motivo>` — exige motivo não-vazio, é
   logado em `.mimosa/`/evidência e NÃO se aplica ao conjunto DENY do item 2
   para `db:migrate` (migração em produção exige `MIGRATION_APPLY` + manifest
   próprio).
5. Ligação: hooks `pre*` do npm (`pretest`, `predev`, `predb:test`…) — zero
   mudança nos scripts existentes; o guard roda ANTES do comando.
6. Teste do guard: unit com matriz de hosts (local → allow; `*.neon.tech` →
   deny; `169.254.x` → deny) + smoke de negação real (`npm test` com
   `DATABASE_URL` remoto deve falhar com exit 3).

**Fix associado recomendado**: renomear/split do `.env` local
(`.env` = dev-local apenas; credenciais de produção migram para arquivo
explicitamente nomeado, carregado só pelas ops sancionadas).

## T2.2 — POOL: `max` explícito no runtime

Estado: `src/db/client.server.ts` não define `max` → default do driver (10).
Medição Fase 0: `max_connections = 901` (plano atual), instância única, tráfego
zero, endpoint **pooled** (transaction-mode) — `set_config(..., true)` por
transação já compatível (AUT-029).

**Spec**: `max: Number(process.env.DATABASE_POOL_MAX ?? 10)` no `NeonPool`
(pooled) e no fallback node-postgres. Valor default 10 mantém comportamento
atual e torna o teto visível/ajustável; recomendação de produção inicial:
10–20 por instância (≤ 2% de 901, folga para scripts admin `max:1`). Entra na
rodada de fix com teste de configuração (unit no factory).

## T2.3 — WARN-NITRO-001: allowlist expirada em 2026-09-01

`scripts/build.mjs` mantém `WARN-NITRO-001` (warning `inlineDynamicImports…`
do Nitro) em `.artifacts/build-warnings.json` com expiração **2026-09-01** —
expirada. Se o warning reaparecer, o gate `build` quebra (na Fase 0 não
ocorreu; build PASS 2×).

**Texto pronto (renovação, caminho recomendado)**: re-registrar a entrada com
`expires_at: 2026-10-06` + campo `rechecked_at: 2026-09-06` (espelha o commit
`d4b4719 "Record green CI baseline and WARN-NITRO-001 re-check"`), com nota:
"warning Nitro inlineDynamicImports conhecido, sem efeito no bundle (272.793 B
min / 84.888 B gzip medidos em ac2e834)". Alternativa (fixar a fonte): avaliar
`nitro.inlineDynamicImports` explícito na config — só com build verde duplo.

## T2.4 — KEEP-WARM memo para B3 (cold start vs auto-suspend)

Dados (Fase 0.3, branch efêmera, 3 amostras): TTFF **1637 / 1727 / 2480 ms**
pós-suspensão; auto-suspend **~300–322 s**; retention 6h; zero usuários no A4.

| Opção                                          | Efeito                                                                                                | Custo/Risco                                                                                             | Quando                                                               |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| (i) **Aceitar** (recomendada p/ A4/A5)         | 1ª requisição pós-idle paga ~2 s (fora do p95 500 ms §29 nessa requisição; janelas seguintes quentes) | Zero custo; zero delta de escrita                                                                       | A4/A5 — ninguém para sentir; alinhar expectativa na emenda de probes |
| (ii) Probe sancionado de leitura a cada ~4 min | Compute sempre quente; TTFF sempre < 500 ms                                                           | Custo de compute ativo contínuo; delta de contagens = probe sancionado (emenda permite, exige registro) | B3, se dados mostrarem usuários reais no limiar do SLO               |
| (iii) Compute always-active                    | idem (ii) sem sondas                                                                                  | Maior custo de plano                                                                                    | Só com decisão de custo (BAK-01-like)                                |

**Recomendação**: (i) no cutover; decisão (ii)/(iii) na B3 com dados reais
(Plano Mestre: "medir cold activation antes de decidir manter compute
always-active"). Qualquer probe (ii) segue a emenda "probe de monitoramento"
(`excecoes.md`): leitura, registro JSON+sha256, classificação de delta.

### Nota de decisão (2026-09-07, G-SEC-EXEC E3.4) — dados B3 coletados

Probe sancionado read-only na PRODUÇÃO (TLS estrito, zero escrita, produção
deixada suspensa como encontrada; evidência em
`artifacts/keepwarm/`): TTFF a frio ×3 = **1683,6 / 2135,6 / 2214,8 ms**
(média ~2011 ms), auto-suspend confirmado **304–316 s** após a última atividade
em 3 ciclos, `max_connections` 901, PG 17.11. Com tráfego zero no A4/A5, a
opção **(i) aceitar** permanece recomendada: ninguém senti os ~2 s; o custo do
keep-warm (ii) é compute ativo contínuo sem beneficiário. Revisar na B3 com
usuários reais; o limiar prático de ativação do (ii) é "primeiro usuário real
reincidente esperado".
