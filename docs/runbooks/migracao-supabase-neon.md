# Runbook — migração Supabase → Neon

## Pré-condições

- Neon develop provisionado; nunca começar em produção.
- `DATABASE_ADMIN_URL` direct e `DATABASE_URL` pooled segregadas.
- conexão Supabase direta somente leitura com acesso a `auth` e `public`.
- backup/snapshot confirmado; aplicação ainda no runtime legado.
- secrets fora do repositório.

## Dry run develop

```bash
npm run db:migrate
MIGRATION_APPLY=false npm run migration:supabase-to-neon
npm run db:test
npm run check
```

O dry run importa e reconcilia dentro da mesma transação e depois executa rollback. Salve o relatório com `MIGRATION_REPORT_PATH` em uma área segura. Nunca publique o arquivo se contiver exceções operacionais sensíveis.

Repita com `MIGRATION_APPLY=true` somente em uma branch Neon descartável ou no Neon develop aprovado. Se o destino já contém um dry run deliberado, a repetição exige `MIGRATION_ALLOW_UPSERT=true` e revisão prévia.

## Cutover de produção

1. Ativar manutenção/read-only no runtime Supabase.
2. Confirmar que não existem escritas em andamento.
3. Criar snapshot/PITR do Neon e registrar horário.
4. Executar migrations.
5. Fazer export final e import com `MIGRATION_APPLY=true`.
6. Exigir relatório com `different: 0`, `sessionsImported: 0` e ausência de órfãos.
7. Trocar secrets para pooled/direct, Better Auth, Google e Resend.
8. Executar `/api/health/live`, `/api/health/ready`, login, CRUD tenant-scoped, chat e smoke financeiro ainda sem liberar escrita pública.
9. Liberar escrita no Neon e monitorar autenticação, erros por código, latência DB/IA e cálculos inválidos/incompletos.

## Rollback

- Antes de escrita no Neon: restaurar os secrets/runtime Supabase e retirar manutenção.
- Depois de escrita no Neon: manter manutenção e restaurar snapshot/PITR do Neon. Não copiar as novas escritas de volta ao Supabase.
- Não reativar dual-write.

## Retenção da origem

Congele o Supabase por 14 dias. A exclusão ou desativação não faz parte deste runbook e só pode ocorrer após aprovação explícita do proprietário.
