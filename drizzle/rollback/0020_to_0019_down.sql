-- Rollback 0020 → 0019: restaura o contrato anterior, em que `app_runtime`
-- não podia excluir despesas. Executável com dados: o REVOKE não toca linhas e
-- a policy `tenant_isolation` permanece intacta. Reverter o grant **quebra** a
-- exclusão de despesa de novo (42501) — o down existe para rebase de
-- laboratório e para o replay do chain em `scripts/db/test-migrations.ts`.
REVOKE DELETE ON TABLE public.expenses FROM app_runtime;
