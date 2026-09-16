# DECISÕES DO SPEC-STEWARD — escada §43 / memória (2026-09-16)

> Insumo: `docs/evidence/agent-state/MEM-D0-GAP-REPORT.md` (§5 daquele relatório listou 5 decisões pendentes). Estas decisões **destravam D2** e não bloqueiam D1.

## A — Nomenclatura `ai_conversations`/`ai_messages` × `chat_*` — **ALIAS CANÔNICO, sem renomeação**

- **Decisão:** manter `chat_conversations`/`chat_messages` (entregues no escopo F9) como implementação vigente do §15.2-conversas; registrar a equivalência semântica já reconhecida na medição (item `15.2c` = SUPERSEDED). As tabelas **novas** da memória usam os nomes do plano: `ai_memories`, `ai_memory_sources`, `ai_memory_versions`, `ai_memory_conflicts`, `ai_memory_embeddings`, `ai_memory_access_log`, `ai_memory_policies`.
- **Racional:** renomear `chat_*` seria migration **BREAKING** com custo de escrita e zero ganho funcional; o plano nomeia o alvo semântico, e a equivalência já está documentada (`CONSOLIDADO.md` §4 e `MEDICAO-2026-09-15.md` §6.4). Novo artefato ⇒ nome novo do plano.
- **Ação de rastro:** a nota de equivalência entra na migration de D2 (comentário) e na matriz M-02 quando o `MemoryService` mudar de `contract-only` para `implemented`.

## B — Memória emite evento de domínio (outbox)? — **NÃO em D2**

- **Decisão:** o append de memória **não** insere evento no outbox. A atomicidade exigida permanece: quando uma memória é gravada na mesma transação de um efeito de domínio, o rollback do domínio não pode deixar memória órfã (e vice-versa) — o aceite D2(c) do relatório continua válido e é o que importa.
- **Racional:** o outbox (§23) existe para garantir **entrega cross-boundary** de eventos de domínio de negócio; hoje **não há consumidor** de eventos de memória, e criar um stream sem consumidor é gold-plating (anti-objetivo explícito). A auditabilidade da decisão de memória é atendida por (i) `status`/`confidence`/`provenance` na própria linha e (ii) `ai_memory_access_log` em D4.
- **Reversão:** se aparecer consumidor (ex.: UI que reage a nova memória), a mudança é **aditiva** — `events.append` na mesma transação, hoje o outbox já é runtime e testado.

## C — Forma da proveniência — **`ai_memory_sources` com FKs opcionais**

- **Decisão:** proveniência 1:N em tabela própria (`ai_memory_sources`) com FKs **opcionais** para as origens conhecidas (conversa/mensagem de chat, produto, simulação, usuário), em vez do `sourceId` polimórfico do contrato atual.
- **Racional:** o §34 (matriz de integridade) espera FKs verificáveis; um id polimórfico não é enforçável no banco e degrada a proveniência a um comentário. O contrato `memory.contracts.ts` passa a expor `sourceId` como **derivado/opcional** (compatível), mantendo a porta M-05.
- **Consequência no aceite:** D2(b) ganha a forma "proveniência órfã é impossível (FK/CHECK)" — já previsto no relatório.

## D — Retenção/TTL e escopo do export — **decisão humana, briefe a emitir em D4**

- Produto/jurídico (LGPD): valores default de TTL por camada (L0–L3) e escopo do `export`.
- **Registro:** entra no `REGISTRO-H.md` como **H-12**, não bloqueante agora; o briefe canônico é emitido pelo MAESTRO no início de D4 (o mecanismo não depende do número).

## E — Pós-gate (embeddings, extensão vetorial, limiar HNSW) — **deferido por desenho**

- Não se decide antes do **GATE-43-AVALIACAO.md**. O §44 exige números (linhas, p95 exato, CPU, recall) para justificar qualquer índice aproximado.
- **Registro:** linha no `REGISTRO-H.md` como decisão pós-gate (sem briefe agora).
