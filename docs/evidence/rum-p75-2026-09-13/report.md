# RUM p75 — 2026-09-13

- Fonte: `rum_vitals` (migration 0014), série persistida do endpoint `/api/vitals`.
- Janela: `7 days` (received_at >= now() - interval).
- Mínimo de amostras por métrica: 20 (abaixo disso: N/A).
- Alvos p75: LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1.
- Gerado por: `npx tsx scripts/obs/rum-percentiles.ts`

| Métrica |   N |     p75 | Alvo         | Veredito             |
| ------- | --: | ------: | ------------ | -------------------- |
| CLS     |  12 |   0.070 | CLS ≤ 0,1    | N/A (N=12 < 20)      |
| FCP     |  25 |    1000 | —            | sem target declarado |
| INP     |  40 |  150 ms | INP ≤ 200 ms | OK                   |
| LCP     |  40 | 2300 ms | LCP ≤ 2,5 s  | OK                   |

## Janela observada

- CLS: 2026-09-13T14:45:51.597Z → 2026-09-14T01:45:51.597Z
- FCP: 2026-09-13T01:45:51.597Z → 2026-09-14T01:45:51.597Z
- INP: 2026-09-12T10:45:51.597Z → 2026-09-14T01:45:51.597Z
- LCP: 2026-09-12T10:45:51.597Z → 2026-09-14T01:45:51.597Z

## Privacidade e retenção

- Sem PII: apenas nome da métrica, valor, rating, delta e navigation type.
- Sem tenant_id/RLS: métrica global de performance do browser; o runtime é INSERT-only e a leitura é admin/local.
- Retenção: série descartável de telemetria; o down da 0014 (`DROP TABLE`) é o caminho de limpeza.
