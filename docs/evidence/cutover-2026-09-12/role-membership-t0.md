# Role membership — m02-role-membership (2026-09-12T02:44:42.926Z)

- kind: `cutover-window` · dry-run: false
- alvo: host mascarado `ep-long-violet-aye9g0bn.c-5.us-east-2.aws.neon.tech` · local: false
- motivo (logado): cutover A4 T-0: membership admin->app_runtime antes do smoke (H-07 exige SET ROLE)
- janela de freeze: VIGENTE — dentro da janela
- membership antes: has_set_membership=false (app_runtime existe=true, bypassrls=false, superuser=false)
- ação: ensureRuntimeRoleMembership executado; depois: has_set_membership=true
- idempotente: criada nesta execução
