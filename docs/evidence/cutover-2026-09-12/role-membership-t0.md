# Role membership — m02-role-membership (2026-09-12T02:44:42.926Z)

- kind: `cutover-window` · dry-run: false
- alvo: host do endpoint mascarado `ep-...-aye9g0bn.<region>.aws.neon.tech` · local: false
- motivo (logado): cutover A4 T-0: membership admin->app_runtime antes do smoke (H-07 exige SET ROLE)
- janela de freeze: VIGENTE — dentro da janela
- membership antes: has_set_membership=false (app_runtime existe=true, bypassrls=false, superuser=false)
- ação: ensureRuntimeRoleMembership executado; depois: has_set_membership=true
- idempotente: criada nesta execução
