# G4/G5 — Rehearsal de migração, rollback e cutover — 2026-08-16

## Estado

**G4 BLOQUEADO; G5 NÃO AUTORIZADO.** O rehearsal depende do G3 real, que está
bloqueado por credenciais Neon ausentes. Nenhuma base externa ou produção foi
alterada.

## Evidência de não execução

- Não houve backup externo, restore, reconciliação, comparação de dados,
  rollback, freeze de escrita ou cutover.
- O PostgreSQL 17 descartável usado no G1 foi exclusivamente local e foi
  encerrado ao final; ele não prova readiness de Neon nem reconciliação entre
  ambientes.
- O workflow Neon preview teve as etapas substantivas puladas, portanto não
  há diff de dados nem rollback externo a registrar.

## Rehearsal obrigatório após G3

1. Congelar a fonte conforme runbook aprovado e capturar snapshot/backup
   verificável.
2. Restaurar em destino isolado e executar migrations com conexão admin
   direta, mantendo a URL pooled separada para o runtime.
3. Reconciliar contagens, chaves, tenants, RLS e invariantes financeiras;
   aceitar somente `different: 0` ou relatório equivalente com diff zero.
4. Executar smoke funcional autenticado, observabilidade e redaction.
5. Testar rollback em ambiente isolado, medir duração e confirmar restauração
   do estado anterior.
6. Repetir o rehearsal até ser reprodutível e anexar logs sanitizados,
   checksums, timestamps e SHAs.

## Go/no-go

G4 só passa com backup/restore, diff zero, rollback e smoke comprovados.
G5 só pode ser discutido após G0–G4 passarem, com aprovação explícita,
janela, plano de reversão e fonte congelada. Até lá, cutover permanece
proibido.
