# Cleanup §12.5 — branches efêmeras do CUTOVER-READY (2026-09-07)

Deleção das branches temporárias do V2/V3/V4 com prova `always()` (Plano
Mestre §12.5/§26). Executado pelo orquestrador após a conclusão de V3 e V4,
com captura antes/depois via `neon branches list`.

## Antes (prova de existência)

```
dryrun-2026-09-07    br-weathered-darkness-ayssv0qf  ready     2026-09-06T23:13:13Z  expira 2026-09-08T23:59:59Z
[default][current] production  br-snowy-violet-aymcvvvv  ready  2026-08-17T14:58:47Z  never
restore-2026-09-07   br-tiny-waterfall-ay6a51b9      ready     2026-09-07T00:02:28Z  expira 2026-09-07T23:59:59Z
develop              br-small-hill-aymcu14y          archived  2026-08-23T04:42:49Z  never
```

## Comandos de deleção

```
neon branches delete br-weathered-darkness-ayssv0qf --project-id damp-forest-57346541   # dryrun (V2/V3: migrations em cópia, seed sintético do rls-probe)
neon branches delete br-tiny-waterfall-ay6a51b9 --project-id damp-forest-57346541       # restore (V4: alvo do restore drill)
```

## Depois (prova de cleanup)

```
[default][current] production  br-snowy-violet-aymcvvvv  ready     2026-08-17T14:58:47Z
develop                        br-small-hill-aymcv14y    archived  2026-08-23T04:42:49Z
```

**Só `production` (ready) e `develop` (archived) restam** — produção intacta,
fixture-free, nenhuma branch efêmera remanescente. O seed sintético do
rls-probe (2 tenants/users/products no domínio-marcador `@preco-que-da.test`)
foi destruído junto com a branch `dryrun-2026-09-07` — cleanup §12.5 `always()`
cumprido sem purge adicional.

## Conteúdo destruído (rastreabilidade)

| Branch               | Fases                                                                                    | Conteúdo                          |
| -------------------- | ---------------------------------------------------------------------------------------- | --------------------------------- |
| `dryrun-2026-09-07`  | V2 (migrations em cópia, journal 11/11) · V3 (seed sintético + rls-probe 10/10 negações) | cópia de produção + seed de probe |
| `restore-2026-09-07` | V4 (alvo do pg_restore do dump de produção)                                              | cópia restaurada, vazia           |

Datas UTC: deleção 2026-09-07. Horizonte: ambas tinham expires-at de segurança
(23:59Z de 08/09 e 07/09) — deleção antecipou o vencimento com prova.
