# F-7 · Consolidação da rodada de produção — 2026-09-12/13

**Rodada:** `preco-que-da-lucro` · **Janela:** 2026-09-12 (mandato) → 2026-09-13T01:2xZ (fechamento)
**Referências de estado:** `main` = `ef2110e7` (SHA do dia-D) · `develop` = `8676fd5` (commit L desta rodada, filho do back-merge `6f2a392`)
**Contrato de evidência:** nenhum valor de env/segredo/URL de sessão transcrito; somente nomes, estados, contagens e hashes.

---

## 1. Frentes — estado, artefato, veredito

| Frente                 | Estado                                         | Artefato principal                                                                                      | Veredito de supervisão                                                                                             |
| ---------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **F-1 ENGINES**        | **CONCLUÍDA** (ADR em proposta)                | `docs/adr/ADR-028-node-engines-24-6-fallback.md` + `docs/evidence/engines-reconciliation-2026-09-12.md` | **S-TEC: OK with notes** — §1–§8 conferem com o lock e o código; §8 executável; 2 P2 rotulados/corrigidos          |
| **F-2 RUNBOOK DIA-D**  | **CONCLUÍDA** (corrigida pós-supervisão)       | `docs/runbooks/dia-d-2026-09-12.md`                                                                     | **S-TEC: BLOCK inicial → corrigido** (P1 material do probe de auth); **S-ALIN P1-1** (P9/BAK-01b + N-10) corrigido |
| **F-3 NEON**           | **CONCLUÍDA**                                  | `docs/evidence/neon-prontidao-2026-09-13.md`                                                            | **S-ALIN:** coerente com o ledger; `GAP-DOC-RLS-01` nomeado (P2-3)                                                 |
| **F-4 LEDGER/MEMÓRIA** | **CONCLUÍDA**                                  | `docs/evidence/agent-infra-findings-2026-09-12.md` + `docs/evidence/substrato-estado-2026-09-12.md`     | **S-ALIN P1-3** (proveniência do `matrix:check`) corrigido                                                         |
| **F-5 HPANEL**         | **DORMANTE → PARADA por protocolo** (2 falhas) | `docs/evidence/hpanel-homologacao-2026-09-12/SESSION-LIMIT.md`                                          | — (limite declarado)                                                                                               |
| **F-6 VERCEL**         | **PARCIAL** (sem token)                        | `docs/evidence/vercel-probes-interina-2026-09-13.md`                                                    | — (SHA não verificável = declarado)                                                                                |
| **F-7 CONSOLIDAÇÃO**   | **CONCLUÍDA**                                  | este artefato                                                                                           | —                                                                                                                  |

**Verificações independentes do orquestrador (não só dos revisores):** `grep` de padrões de segredo nos 8 artefatos (único hit = o próprio padrão de grep no runbook) · `npm run m02:secrets-audit` = `COMPLETE_WITH_LIMITS` com `failures: []` · `npm run m02:matrix:check` = **PASS** · `npm run m02:lockfile-guard` = PASS · `npm run m02:state:check` = **PASS** no HEAD `8676fd5`.

## 2. Supervisão transversal — resultado e limites

| Supervisor                                   | Veredito   | P0  | P1  | P2  | Estado                                                                                                                                                                                               |
| -------------------------------------------- | ---------- | --- | --- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S-SEC** (higiene)                          | **CLEAN**  | 0   | 0   | 5   | 1 endurecimento aplicado (janela de validade do `jwt` removida de `SESSION-LIMIT.md`)                                                                                                                |
| **S-ALIN** (governança SDD/§11.9/§42/docmap) | **DESVIO** | 0   | 5   | 4   | **todos corrigidos** na entrada da rodada (P9/N-10 · F-1/H-7 · proveniência do `matrix:check` · errata do G-VER-v2 · semântica do freeze · GAP-DOCs nomeados · pipes do ADR · `AGENTS.md` → ADR-028) |
| **S-TEC** (contrato técnico)                 | **DESVIO** | 0   | 1   | 4   | P1 **material** corrigido (a prova do `get-session` era falsa) + 4 P2                                                                                                                                |

**`TRANSCRIPT-UNAVAILABLE` declarados (com consequência):**

1. **S-TEC, 1ª passagem** — o workflow de supervisão estourou o deadline (420 s) e o filho `s-tec` não entregou. **Consequência:** o contrato técnico ficou **sem veredito** por ~15 min; retentativa com escopo estreito (`6553d521`) entregou o veredito nesta rodada. Registrado como **atraso de supervisão**, não como aprovação tácita.
2. **S-TEC — insumo não auditado:** `docs/evidence/hpanel-homologacao-2026-09-12/01-node-version.md` foi citado pelo ADR/runbook mas **não** integrou o conjunto auditado (existe e foi lido pelo orquestrador; **não** revisado por S-agent). Consequência: nenhuma afirmação do ADR depende dele sem checagem local direta.

## 3. CP-E — estado exato (seletor × ADR)

- **Seletor do painel:** oferece Node **apenas por major** (18/20/22/24) → no alvo resolveu para **v24.6.0** (npm 11.5.1). Não há escolha de patch ⇒ **o caminho (a) "oferecer 24.15+" não existe hoje**.
- **ADR (caminho canônico):** `ADR-028` redigido em **PROPOSTA/DRAFT** — piso `>=24.6.0` como **transição com prazo** + cláusula do `jsdom` (piso oculto). **Ratificação = H-7** (ato humano, novo na fila).
- **Reconciliação do engines = FECHADA no sentido de "estado exato declarado"**, com **2 blockers mapeados** (root declarado + `jsdom@30.0.1` em `devOptional`), nenhummy uso de API > 24.6.0 e runtime/build de produção compatíveis.
- **O que fecha o item 1 do 11/12 hoje:** o workaround **`NPM_CONFIG_ENGINE_STRICT=false`** (env não-secreta) — **não** a mudança de `engines` (que exige PR + H-7).
- **Pendência de prova:** `nvm use 24.6.0 && npm ci` (sem override) **não executado** — é critério do §8.2 do ADR e a disambiguação do P2 do S-TEC (nó `devOptional`).

## 4. F-6 — probes da produção interina (resumo)

- `preco-que-da-lucro-sage.vercel.app`: **live 200 · ready 200 (`postgres: ok`) · get-session 200 (`null`)** em 2026-09-13T01:01:24–27Z (`server: Vercel`, edge `gru1`/`iad1`, cache MISS).
- `preco-que-da-lucro.vercel.app` (canônico): **404 DEPLOYMENT_NOT_FOUND** — sem mutação nesta rodada.
- **SHA auto-deployado: NÃO VERIFICADO** (depende de H-2) — **não** usar como evidência de release.
- **Correção de semântica (S-TEC P1):** `get-session 200/null` **não** prova troca de `baseURL`; o que ele prova é que a instância de auth subiu.

## 5. Dormantes — estado dos watchers

| Watcher                          | Estado    | Último sinal                                                                        |
| -------------------------------- | --------- | ----------------------------------------------------------------------------------- |
| `app-live` (health 200)          | **ativo** | poll 930 em 2026-09-13T00:49:43Z → `http=404` (build ainda não sobe)                |
| `h6-watch` v3 (mudança de `jwt`) | **ativo** | `jwt` mudou 2026-09-13T00:55:03Z → sondagem **desafiada** → aguardando nova mudança |
| `h2-watch` (token Vercel, 7 d)   | **ativo** | sem token/CLI até agora                                                             |

## 6. Fila humana — instruções

| ID      | Ação                                                                                                                                                                                                                                                                                                                                        | Tempo  | Bloqueia                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------- |
| **H-6** | No Firefox: abrir `hpanel.hostinger.com/websites/darkgray-pony-545965.hostingersite.com` → **Variáveis de ambiente** → adicionar `NPM_CONFIG_ENGINE_STRICT` = `false` → salvar → **Implantações → Reimplantar** → voltar e adicionar `BETTER_AUTH_URL` e `AUTH_TRUSTED_ORIGINS` = `https://darkgray-pony-545965.hostingersite.com` → salvar | ~2 min | **11/12** e todo o dia-D                                                    |
| **H-7** | **Ratificar o ADR-028** (§9: assinatura)                                                                                                                                                                                                                                                                                                    | ~1 min | o fallback canônico do engines (`engine-strict=false` segue como transição) |
| **H-4** | PITR ≥ 7 d: plano **Launch** (usage-based, ~US$1–3/mês), janela de histórico em 7 d, re-medir `history_retention_seconds` (esperado `604800`) — **ou** assinar a exceção formal (P9)                                                                                                                                                        | ~5 min | P9/BAK-01b (não bloqueia o 11/12; bloqueia o carimbo de tráfego por norma)  |
| **H-5** | Assinar o go-live (após o 11/12)                                                                                                                                                                                                                                                                                                            | ~1 min | CP-G3                                                                       |
| **H-2** | (opcional) criar token Vercel e salvar em `~/.config/vercel-token`                                                                                                                                                                                                                                                                          | ~1 min | inventário de config/drift (`NEON_AUTH_*`), SHA do deployment               |

## 7. Dia-D — data estimada e cadeia

- **Condições (CP-G3):** `11/12` + `H-5` assinada + snapshot < 24 h + `m02:readiness` + freeze conforme `M02-D-009` + **P9** (BAK-01b fechada ou exceção assinada).
- **Estimativa:** se **H-6** for executado hoje (2026-09-13), o build sobe e o **11/12 fecha no mesmo dia**; com **H-5** e o snapshot fresco executado na janela, **dia-D mais provável: 2026-09-15/16**.
- **Ordem dura do dia:** vars → reimplantar → domínio (docmap) → SSL → probes canônicos (**com a asserção (c1)**) → integridade MX/SPF/DKIM/DMARC → carimbo `Tráfego: EXISTE` → A5 0h.
- **Rollback:** R1–R7 (`reset`+push **proibido** — ADR-017).
- **O que NÃO muda no dia:** NS/MX/SPF/DKIM/DMARC (intocados até o CP-G3 e depois apenas verificados).

## 8. Top-3 riscos

1. **BAK-01b aberto (PITR 6 h)** — começar tráfego sem PITR ≥ 7 d viola SDD §16.6. **Mitigação:** H-4 (custo na ordem de US$1–3/mês) ou exceção formal assinada (P9). _Risco assimétrico: barato de fechar, caro de descobrir depois._
2. **Sessão hPanel (Cloudflare intermitente)** — sem o passo manual de 2 min, o **11/12 não fecha** e o dia-D não abre; toda a cadeia fica parada em um único ponto humano. **Mitigação:** H-6 + watcher `app-live` (que já acorda o orquestrador).
3. **Rollback sem commit no hPanel (GAP-DOC material)** — o R3 do runbook é o elo fraco: publicar a versão anterior exige `git revert` + push (nunca `reset`). **Mitigação:** validar o fluxo `revert` + push **no preview** antes do dia-D.

**Risco residual declarado (fora do top-3):** ~198 arquivos de evidência de rodadas anteriores seguem **não rastreados** no worktree (o CI só vê rastreados; o gate local é afetado por eles). Recomendação: rodada dedicada de **versionamento de evidências** — não feita aqui para não misturar escopo.

## 9. Análise pós-execução (o que o mandato pediu)

1. **Frentes ativas — 4 entregas com validação:** ADR-028 + checklist (F-1) · runbook dia-D com P9/N-10 e probe corrigido (F-2) · memo PITR já instrumentado + prontidão Neon com números (F-3) · ledger/memória + substrato + arqueologia do lockfile (F-4). Validações: S-TEC (contrato), S-ALIN (governança), S-SEC (higiene) — **todos com P0 = 0** e P1 corrigidos.
2. **CP-E:** fechado como **estado exato** (seletor só por major; ADR em proposta; 2 blockers; workaround de env é o que destrava o item 1). Ratificação pendente = **H-7**.
3. **F-6:** probes da interina **timestamped** (200/200/200); **SHA não confirmado** (H-2) — declarado, não inferido.
4. **Dormantes:** os 3 watchers **ativos** (últimos sinais na §5); o `h6` detectou a renovação de sessão do dono e **parou por protocolo** após o desafio.
5. **Fila humana:** §6 (com H-6 clique-a-clique) · **dia-D:** §7 (2026-09-15/16) · **top-3:** §8.

---

### Registro de revisão deste artefato

| Versão | Data       | Mudança                                                                                               |
| ------ | ---------- | ----------------------------------------------------------------------------------------------------- |
| v1     | 2026-09-13 | Redigido no fechamento da rodada; incorpora os vereditos S-SEC/S-ALIN/S-TEC e as correções aplicadas. |
