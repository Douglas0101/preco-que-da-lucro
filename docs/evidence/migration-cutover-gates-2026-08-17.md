# G4/G5 — Migração, rollback e cutover — 2026-08-17

## Estado

**G4 BLOQUEADO; G5 NÃO AUTORIZADO.** O G3 não iniciou porque as credenciais
protegidas estão ausentes, o workflow de readiness ainda não está registrado
no default branch e o environment não possui protection rules. Nenhuma
operação externa foi tentada como substituto.

## Não execução comprovada

- Não houve snapshot, backup, restore ou reconciliação.
- Não houve `different: 0`, `sessionsImported: 0` ou verificação de órfãos.
- Não houve freeze de escrita, smoke pós-migração ou rollback.
- Não houve alteração de produção, merge ou cutover.

O PostgreSQL descartável anterior foi local e não representa o destino Neon.
O run Neon preview anterior também não substitui readiness, pois as etapas
substantivas foram skipped.

Não será feito merge automático do workflow para habilitar o dispatch; essa é
uma mudança administrativa/revisável que precisa de aprovação separada.

## Próximo ciclo após G3

1. Executar dry-run em branch Neon descartável.
2. Revisar conexão direct/pooled, migrations, RLS, drift e artifacts.
3. Capturar backup/snapshot e restaurar em destino isolado.
4. Reconciliar dados com diff zero e sem sessões importadas.
5. Executar smoke autenticado e testar rollback.
6. Registrar checksums, run IDs, timestamps e logs sanitizados.

O modo `apply` só poderá ocorrer em branch descartável, com confirmação
explícita após a revisão do dry-run. O cutover só poderá ser discutido depois
de G0–G4 completos, com aprovação, janela, source freeze e plano de reversão.
