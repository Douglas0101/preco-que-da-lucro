# PS-S5 - Estado do gate (2026-09-08)

**NÃO EMITIDO.**

O reparo de grants fez `backup-verify` retornar exit 0, com catálogo completo
e journal 11/11, e o reconcile retornou 26/26 diff 0. Porém, o probe H-07 no
restore abortou na fase PROBE com erro PostgreSQL `42P01`; as negações
cross-tenant de `app_runtime` não foram comprovadas. Após a segunda falha
consecutiva (diagnóstico read-only não executado por quoting do shell), a
rodada foi encerrada conforme protocolo.

O cleanup da branch efêmera foi comprovado. Isso não converte o resultado em
PASS: `PS-S6` continua sendo o selo de parada, e o experimento (b) permanece
`NÃO EXECUTADO`.
