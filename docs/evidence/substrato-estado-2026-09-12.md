# Substrato — estado consolidado (rodada 2026-09-12, coleta 2026-09-13T01:0xZ)

**Escopo:** estado operacional consolidado do substrato de produção `preco-que-da-lucro` ao fim da rodada de 2026-09-12.
**Contrato de evidência:** somente leitura; **nenhum** valor de env/segredo/URL de sessão transcrito (apenas nomes, estados, contagens, hashes).
**Artefato companheiro:** `docs/evidence/agent-infra-findings-2026-09-12.md` (INFRA-MEM-01 + arqueologia do lockfile).

## 1. Tráfego

- **Tráfego de aplicação: NÃO EXISTE** (ainda não há primeiro acesso real pelo domínio canônico).
- O que existe é **tráfego de probe** nas URLs de preview/interino: interina Vercel `-sage` (F-6, 2026-09-13T01:01Z) e o preview hPanel (que ainda não sobe — build FAIL item 1).
- A transição para **"Tráfego: EXISTE (primeiro registro)"** é carimbo do dia-D (F-2 §1.8; `docs/runbooks/cutover-A4.md:432-451`).

## 2. Neon (produção)

| Item                      | Valor                                  | Fonte                                           |
| ------------------------- | -------------------------------------- | ----------------------------------------------- |
| Journal de migrations     | **12/12**                              | `docs/evidence/neon-prontidao-2026-09-13.md` §1 |
| RLS (tabelas / políticas) | **26 / 30**                            | idem §2                                         |
| Conexões                  | 1 total / 1 ativa (só a sessão MCP)    | idem §3                                         |
| TTFF via MCP (`SELECT 1`) | 630 ms / 635 ms                        | idem §4                                         |
| Retenção de histórico     | **21600 s (6 h)** → **BAK-01b ABERTO** | idem §5                                         |
| Snapshot trio             | **agendado** para <24 h do go-live     | idem §6                                         |
| Branch produção           | `br-snowy-violet-aymcvvvv` (read-only) | idem §7                                         |
| Branch preview            | `br-blue-silence-ayj9erkh`             | idem §7                                         |

## 3. hPanel (alvo canônico)

- Web App **PREVIEW criado**: `darkgray-pony-545965.hostingersite.com` (preset Nitro, branch `main`, Node 24.x) com **11 env vars** — CP-G2 CLEAN (nomes, não valores) — `docs/evidence/hpanel-homologacao-2026-09-12/`.
- **Build FAIL — item 1 (`EBADENGINE`)**: Node do alvo `v24.6.0` < `>=24.15.0`; workaround documentado `NPM_CONFIG_ENGINE_STRICT=false` (env não-secreta), pendente de sessão.
- **Limite Cloudflare (H-6)**: bloqueio **intermitente** do contexto automatizado; em 2026-09-13T00:55:03Z o dono renovou a sessão (`jwt` mudou) mas a sondagem foi desafiada de novo → **item parado** (2 falhas) → caminho manual de ~2 min (`SESSION-LIMIT.md`).
- **Detector de app vivo** (`app-live-watch.sh`, 7 d): último poll 930 a 2026-09-13T00:49:43Z com `http=404` (build ainda não subiu).

## 4. Vercel (interino)

- Alias público **`preco-que-da-lucro-sage.vercel.app`**: `live`/`ready`/`get-session` = **200/200/200** (2026-09-13T01:01:24–27Z), `ready` com `postgres: ok`.
- Alias canônico `preco-que-da-lucro.vercel.app`: **404 DEPLOYMENT_NOT_FOUND** (sem mutação — sem token).
- **SHA auto-deployado: NÃO VERIFICADO** (depende de H-2) — não usar como evidência de release.
- **H-2**: token pela UI bloqueado por combobox customizado (`docs/evidence/vercel-token-blocker-2026-09-12.md`); watcher de 7 d armado.

## 5. Checks M-02 (modo leitura, executados nesta rodada)

| Check                      | Resultado                                                                   | Nota                                                            |
| -------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `npm run m02:state:check`  | **FAIL esperado** (ledger desatualizado: exigia HEAD/marker do novo commit) | corrigido nesta rodada com o marcador `parent-pinned` no ledger |
| `npm run m02:matrix:check` | **PASS** — "M-02 matrix is deterministic and up to date"                    | —                                                               |
| `npm run smoke:substrate`  | **não re-executado nesta rodada** (7/7 no cutover de 2026-09-12)            | re-executar no 11/12 (F-5) e na A5 0h                           |

## 6. Fila humana (sinalizada)

| ID  | Ação                                                                                                        | Custo/limite                          | Estado                                                          |
| --- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------- |
| H-2 | Token Vercel (inventário/drift)                                                                             | ~1 min; **opcional**                  | watcher 7 d armado                                              |
| H-4 | PITR ≥ 7 d (plano Launch)                                                                                   | **única com pagamento** (~US$1–3/mês) | memo com números pronto                                         |
| H-5 | Assinatura do go-live                                                                                       | decisão                               | destrava CP-G3                                                  |
| H-6 | 2 min no Firefox: `NPM_CONFIG_ENGINE_STRICT=false` + Reimplantar + `BETTER_AUTH_URL`/`AUTH_TRUSTED_ORIGINS` | bloqueio Cloudflare intermitente      | instrução clique-a-clique publicada                             |
| H-7 | **Ratificar o ADR-028** (piso `>=24.6.0` como transição + cláusula do `jsdom`)                              | ato humano de governança (sem custo)  | **novo** — exigido por S-ALIN P1-2; sem H-7 o fallback não vale |

## 7. Superfície de dados sensíveis (higiene)

- Segredos duráveis em arquivos `600` fora do repositório (`~/.config/hpanel-secrets.env`, `~/.config/preco-admin.env`, `~/.config/preco-auth.env`) — **nomes** apenas em evidência.
- Nenhuma URL de sessão autenticada em artefato. Nenhum valor de env em artefato.
