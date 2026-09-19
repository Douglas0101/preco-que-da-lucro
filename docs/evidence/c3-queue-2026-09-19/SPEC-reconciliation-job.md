# SPEC CARD — Job de reconciliação de uso desconhecido (fila C3)

**Aprovado pelo MAESTRO em 2026-09-19** (Decisão 3) · **Execução: SOMENTE após o land do INV-006** e após B1.
**Natureza:** dívida assumida pelo `INV-006` variante B — a reserva retida erra para o lado seguro, mas
consumo desconhecido repetido consome o teto diário do tenant sem consumo real correspondente.

## 1. Problema

No caminho desconhecido, o `settle` **retém** `tokens_reserved` e marca `outcome = 'usage_unknown'` com
`real_tokens = NULL`. O orçamento fica conservador; porém N eventos sem reconciliação consomem teto
permanentemente, podendo bloquear o tenant (`AI_QUOTA`) por um valor que nunca foi gasto.

## 2. Contrato

| campo        | valor                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gatilho      | periódico (ex.: 1 h) **ou** contagem (ex.: 100 eventos) — decidir na implementação com dado                                                                   |
| Entrada      | `ai_usage` com `outcome = 'usage_unknown'` **e** `settled_at < now() - interval 'X'`                                                                          |
| Isolamento   | por `tenant_id` (INV-008) — nunca varredura global com filtro na aplicação                                                                                    |
| Idempotência | INV-009: cada linha tratada **uma vez** (CAS por `usage_id` + `status`), com retry seguro                                                                     |
| Ações        | (i) reconciliar junto ao gateway **se** houver como obter o uso real; (ii) marcar `reconciliation_failed`                                                     |
| Ajuste       | se reconciliado: escrever `real_tokens` real e liberar a reserva do valor **medido**; se falhar: liberar com **log de auditoria** e motivo, nunca em silêncio |
| Auditoria    | registrar em `ai_memory_access_log`-like? **não** — usar o próprio `outcome` + evento estruturado; **jamais** apagar o fato de que o uso foi desconhecido     |
| Métricas     | `app.ai.reconciliation_total` · `app.ai.reconciliation_failed` (+ idade do evento mais antigo)                                                                |
| Proibições   | não inventar número; não converter desconhecido em zero; não liberar sem trilha                                                                               |

## 3. Estados propostos (sem migration, se possível)

`ai_usage.status` tem CHECK restrito a `('reserved','settled','expired')` — qualquer estado novo exige
**migration classificada** (SAFE/ONLINE_WITH_CARE). Preferência inicial: **não** criar estado novo;
distinguir por `outcome ∈ {usage_unknown, reconciliation_failed, reconciled}`.

## 4. DoD

- [ ] Nenhuma linha `usage_unknown` fica sem tratamento por mais de X (invariante verificável por query).
- [ ] Reconciliação idempotente (replay não duplica ajuste) — teste com CAS.
- [ ] Falha não vira sucesso vazio (INV-013): `reconciliation_failed` é **estado persistido**, não log.
- [ ] Tenant isolation provada com controle positivo (0 rows / `42501`).
- [ ] Métricas emitidas e verificadas.
- [ ] Nenhum arquivo dos trilhos A–D do ciclo 6 tocado sem reavaliar contenção.

## 5. Riscos

| risco                                                      | mitigação                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Reconciliar e o gateway não ter o dado (nem retê-lo)       | `reconciliation_failed` persistido + alarme; decisão de produto sobre liberar ou não |
| Job competir com o `sweep` existente de reservas expiradas | reusar/estender o sweep em vez de criar um segundo varredor                          |
| Ajuste retroativo mudar KPI já lido                        | janela curta (X pequeno) + trilha de auditoria                                       |
