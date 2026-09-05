-- Down restores the pre-backfill state (NULL issuer on credential accounts).
-- WARNING: running this while better-auth >= 1.7.x is deployed breaks sign-in.
--
-- GUARDA ADICIONAL (2026-09-05, checagens pós-publicação):
-- Este down NÃO é no-op. O forward (0010) foi aplicado em produção em
-- 2026-09-03 e verificado como no-op (0 de 4 credential accounts tinham
-- issuer NULL), mas o predicado abaixo casa as 4 contas atuais — executar
-- este arquivo reverteria linhas que o forward NÃO alterou.
-- PROIBIDO executar automaticamente. Pré-requisitos antes de qualquer down:
--   1. reconciliar as linhas efetivamente alteradas pelo forward no ambiente
--      alvo (esperado: zero) e documentar a contagem;
--   2. confirmar a versão de better-auth atendendo tráfego (1.6.x aceita
--      issuer NULL; 1.7.x NÃO aceita);
--   3. registrar a execução no ledger com reconciliation report (§13.4/13.5).
-- Para reverter apenas o artefato da aplicação (código), preferir rollback de
-- deploy sem este down — as mudanças 0008/0009/0010 são 100% aditivas.
UPDATE "accounts" SET "issuer" = NULL
WHERE "provider_id" = 'credential' AND "issuer" = 'local:credential';
