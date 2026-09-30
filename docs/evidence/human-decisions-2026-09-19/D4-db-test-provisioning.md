# D4 · Como obter `db:test` em PG17 real (Condição B do land do INV-006)

**Briefing de decisão — 2026-09-19.** O land do INV-006 está **NEGADO** até B1 **e** `db:test` em PG17 real.
Este documento mede o que existe no ambiente e propõe o caminho.

## 1. O que foi medido (nesta sessão, read-only)

| verificação                                                            | resultado                                                                                                                                |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `initdb` · `pg_ctl` · `postgres` · `psql` · `pg_tmp` · `pg_virtualenv` | **nenhum existe** no host                                                                                                                |
| `/usr/lib/postgresql/*` · `/etc/postgresql`                            | **vazios/ausentes**                                                                                                                      |
| Docker CLI                                                             | **existe** (`/usr/local/bin/docker`)                                                                                                     |
| daemon do Docker                                                       | **ausente**: `/var/run/docker.sock` e `~/.docker/desktop/docker.sock` não existem                                                        |
| podman · nerdctl · containerd                                          | **ausentes**                                                                                                                             |
| runbook de PG no repo                                                  | só `postgres-local-docker.md` (depende do daemon; `db:up` = `docker compose up -d --wait`)                                               |
| cache do npm no sandbox                                                | **read-only** (`EROFS` em `~/.npm/_cacache`) ⇒ `npm`/`npx` **não** baixam nada                                                           |
| `curl` para fora                                                       | **funciona**; escrita **na área de trabalho** funciona                                                                                   |
| registry npm                                                           | acessível; `@embedded-postgres/linux-x64` com a linha **17.x** disponível (17.10.0-beta.17, 55 MB descompactado, shasum `b6e52756aee6…`) |

**Conclusão:** a opção "PG17 sem Docker" **não é viável como estava escrita** (não há `pg_tmp` nem binários), mas é **viável de outra forma**: baixar binários embarcados do PostgreSQL 17 e extraí-los **dentro da área de trabalho**. Isso exige decisão sua (binário de terceiros no workspace).

## 2. Detalhe que invalida o procedimento antigo

O `db:test` verde **exige as três URLs definidas e loopback**:

```
DATABASE_ADMIN_URL · DATABASE_URL · DATABASE_URL_UNPOOLED   → todas 127.0.0.1
```

`scripts/db/test-products-fk-conflict.ts` **reprova** se houver qualquer teste pulado (`numPendingTests !== 0`),
e o gate dos testes vitest de banco é `isLoopbackUrl(...)` nas três. Como `isLoopbackUrl(undefined) → false`,
o padrão usado nos ciclos 3–5 — `env -u DATABASE_URL_UNPOOLED` — faz os testes **pularem** e o `db:test` **falhar**.

> **Correção necessária na spec do `F-D2-runner-failopen`:** a variável deve ser **definida apontando para loopback**, não removida do ambiente.

## 3. Opções

| #     | opção                                                                                                                                                                                          | quem executa                       | custo                              | risco                                                                                                                   |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **A** | **Iniciar o Docker Desktop no host** → `npm run db:up` → `db:test`                                                                                                                             | **humano** (ação de host)          | mínimo                             | nenhum; é o caminho canônico do repo                                                                                    |
| **B** | **PG17 embarcado na área de trabalho**: baixar o tarball 17.x por `curl`, extrair em `node_modules/.pg17/` (**já gitignored**, não toca arquivo rastreado), `initdb` + `pg_ctl start -p 55432` | **este agente**, com sua aprovação | ~55 MB descompactados, um download | binário de terceiros; mitigação: fixar versão, registrar **shasum** no artefato e usar só localmente (nunca versionado) |
| **C** | Branch Neon de preview                                                                                                                                                                         | —                                  | —                                  | exige `NEON_API_KEY` (**H-2**) e/ou MCP (**H-11**): indisponível                                                        |
| **D** | Adiar o land                                                                                                                                                                                   | —                                  | —                                  | mantém `READY_TO_LAND_BLOCKED`; residual aberto                                                                         |

## 4. Recomendação

1. **A é a preferida** (canônica, sem binário novo, sem desvio de disciplina): ~1 min no host e eu executo todo o resto.
2. Se o Docker não puder subir, **B** é aceitável **desde que explícita** — com versão pinada (`17.10.0-beta.17`), shasum registrado e extração em `node_modules/.pg17/` (nada versionado, nenhum `package.json`/lock tocado).
3. **D** só se você preferir manter o land parado; nesse caso o residual permanece declarado e **o INV-006 não landa**.

## 5. Comandos exatos (idênticos para A e B, mudando só a porta)

```bash
cd .worktree-inv006
export DATABASE_DRIVER=node-postgres EXPECTED_POSTGRES_MAJOR=17
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:PORT/preco_que_da_lucro_test"
export DATABASE_ADMIN_URL="$DATABASE_URL"
export DATABASE_URL_UNPOOLED="$DATABASE_URL"     # definida E loopback (ver §2)
npm run db:test > captures/db-test.txt 2>&1; echo "EXIT=$?"
```

Critérios de aceitação: prova-FK com **`N passed (N), 0 skipped`** · `db:test` **exit 0** com as 15 suítes ·
`real_tokens` aceitando `NULL` no driver real · nenhum teste de integração quebrado pela assinatura aditiva.

E, no worktree, **um caso de banco novo** para o caminho desconhecido (reservar → `settle({kind:'unknown'})` →
assertar `real_tokens IS NULL`, `outcome='usage_unknown'`, reserva retida, `in_flight` decrementado), em arquivo
**próprio do WP** — sem tocar `scripts/db/test-ai-budget.ts` (trilho A).
