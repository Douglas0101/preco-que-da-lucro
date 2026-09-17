# DECISÕES DO STEWARD — ciclo 3, pós-E1 do WP-D3 (2026-09-17)

> Insumo: os "pontos de contrato" e os "resíduos declarados" do claim
> `CLAIMS-INBOX/MEM-D3.md`. Estas decisões são tomadas **antes** de D4 e são citáveis pelo
> verificador adversarial. Nada aqui reescreve o que já foi implementado; o que muda é o que
> **D4 herda**.

## SD-C3-12 — Expurgo × privilégio da role de aplicação (tensão 1 do claim) — **DECIDIDO: conceder `DELETE` a `app_runtime` em D4**

- **Fato medido:** SD-C3-3/4 deram a `ai_memory_versions` apenas `SELECT`+`INSERT`; o T7 prova a denegação de `UPDATE`/`DELETE` (42501). Mas SD-C3-9 exige `delete(..., {purgeHistory: true})` apagando versões+conflitos+memória **na mesma transação**, e com FK `ON DELETE RESTRICT` o cascade não ajuda. Resultado: hoje o expurgo só roda sob executor privilegiado (foi assim que o E1 o provou).
- **Decisão:** em **D4**, uma migration aditiva concede `DELETE` em `ai_memory_versions` e `ai_memory_conflicts` a `app_runtime`. A **imutabilidade do histórico continua sendo enforçada por privilégio**, mas pela negação do `UPDATE` (reescrever história continua impossível); o `DELETE` passa a ser permitido porque a **eliminação por LGPD tem de ser executável pela role da aplicação** — e as FKs permanecem `RESTRICT`, de modo que o expurgo **precisa** apagar filho→pai explicitamente (falha fechada se esquecer).
- **Consequência testável para D4:** novo caso que prove (i) `UPDATE` em versões continua 42501; (ii) `DELETE` funciona **apenas** pelo caminho do repositório com a ordem correta; (iii) apagar a memória sem o expurgo continua recusando (`false`, sem erro).
- **Reversão:** revogar o `DELETE` (1 migration) e passar o expurgo a um executor dedicado.

## SD-C3-13 — Arquivos fora do escopo exclusivo do card — **RATIFICADO**

- O card listava o escopo exclusivo do WP-D3, mas a migration nova **exige** três arquivos fora dele: `scripts/db/test-migrations.ts` (lista `DOWNS_TIP_TO_0003` + contagem do journal 18→19), `scripts/db/purge-fixtures.ts` (ordem de expurgo antes de `ai_memories`) e `drizzle/rollback/0001_to_0000_down.sql` (DROP global do teardown — padrão herdado do D2 e conferido pelo MAESTRO no incidente de colisão). Nenhum `package.json` tocado.
- **Decisão:** ratificados como **necessidades de integração**, no mesmo fundamento do SD-4 do ciclo 2. O `docs/specs/M-02/**` continua intocado (regeneração é do MAESTRO).

## SD-C3-14 — `superseded` derivado e constante para linhas arquivadas — **ACEITO COMO ESTÁ**

- **Fato:** com o head fora da tabela de versões, a leitura "existe versão de número maior" marca **toda** linha arquivada como `superseded` (a última arquivada também), porque o head é a versão corrente. O campo não distingue "a última arquivada" das anteriores.
- **Decisão:** aceito — a semântica é correta (todas as linhas da tabela **são** estados superados) e é a única leitura que não exige coluna nova em 0018. Se o produto quiser a marcação informativa, o caminho é um espelho da versão corrente, **fora** deste degrau.

## SD-C3-15 — `revise` como método explícito do port — **RATIFICADO**

- Nem o plano nem o card nomeavam o método de revisão; sem ele, a revisão só seria alcançável por SQL direto e o caminho da aplicação ficaria sem prova. `revise(context, memoryId, { content, importance?, provenance? }, executor?)`, restrito ao tenant e a `status='active'`, é a extensão **mínima** que torna T2 verificável. `listConflicts` com filtro `{status?, memoryId?}` idem (superconjunto compatível com o que o card pedia).

## Follow-ups abertos por esta rodada

| id         | conteúdo                                                                                                                                                                                       | dono             | quando                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------------------- |
| **F-C3-1** | anomalia `500 Seroval` no read path do diagnóstico por `curl` com sessão do owner (UI normal; sem controle `200`) — ver `docs/evidence/browser-batteries-2026-09-16/CICLO-3-BATERIAS-UI.md` §3 | SQUAD-APP        | próximo ciclo, com hipótese única por vez                   |
| **F-C3-2** | `DATABASE_URL_UNPOOLED` com host de **produção** no ambiente de execução do enxame — manter no `DENY_SET` do `env-guard` e cobrir qualquer leitor novo por guard                               | GUARDIÃO/MAESTRO | imediato (política)                                         |
| **F-C3-3** | expurgo de memória sob a role de aplicação (herda **SD-C3-12**)                                                                                                                                | SQUAD-MEM        | D4                                                          |
| **WP-B1**  | `@vercel/analytics` incondicional ⇒ 404 + recusa por MIME por navegação no preset `node-server` (`src/routes/__root.tsx:11,119`)                                                               | SQUAD-APP        | a critério do humano (achado menor, sem risco de segurança) |
