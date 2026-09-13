# 06 — Varredura MCP Neon do painel (Fase C, read-only, 2026-09-08)

- **Método:** MCP `neon` — enumerar→mapear (`list_organizations`, `search`,
  `list_projects`, `list_branches`, `list_snapshots`, `describe_project`,
  `list_branch_computes`, `list_postgres_endpoints`, `get_database_tables`).
  Somente leitura; nenhuma branch criada/deletada; produção read-only.
- **Evidência:** só NOMES/IDs/contagens/estados. Hosts completos mascarados.

## Resultado (projeto `damp-forest-57346541`, PG 17, `aws-us-east-2`, `free_v3`)

| Campo do painel             | Valor observado                                                                                                          | Concordância com ledger                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| branches                    | `production/br-snowy-violet-aymcvvvv` ready (default) + `develop/br-small-hill-aymcu14y` archived; zero efêmera          | CONCORDANTE — cleanup C-02A com prova                                                                              |
| snapshot                    | `snap-tiny-smoke-ayc382ji` (`pre-a4-prepurge-20260905`), origem production, criado 2026-09-05, expira 2026-10-10         | CONCORDANTE — mas STALE para o gate `snapshot-fresco` (<24h); trio novo no dia-D                                   |
| `history_retention_seconds` | 21600 (6h)                                                                                                               | VIOLAÇÃO ABERTA — BAK-01b exige ≥7d; upgrade antes do dia-D                                                        |
| endpoints/computes          | production e develop `idle`; `suspend_timeout_seconds=0` (default 300s); `pooler_mode=transaction`, hosts pooled válidos | CONCORDANTE — `pooler_enabled:false` não significa pooler indisponível                                             |
| tabelas (production)        | 36: 1 `drizzle` + 9 `neon_auth` (plataforma) + 26 `public` (aplicação)                                                   | CONCORDANTE — `backup-verify` compara 27 (drizzle+public); `neon_auth` é plataforma, fora do catálogo de aplicação |
| roles                       | via SQL read-only (`backup-verify`): `app_runtime` sem superuser/BYPASSRLS                                               | CONCORDANTE — sem MCP nativo confiável para PG roles; via sonda                                                    |

## Divergências = achados (nenhuma nova além das conhecidas)

1. PITR 6h vs ≥7d (BAK-01b aberta; pós-upgrade: re-verificar do painel).
2. Snapshot nativo válido até 10/10 porém STALE para frescor — não confundir
   validade nativa com gate <24h.
3. Sem `DATABASE_*` no env local (checagem só-NOMES: ausentes) — A1/A2 e B
   seguem bloqueados até credenciais + autorização para branch efêmera.
