# RUM p75 — 2026-09-14

- Fonte: `rum_vitals` (migration 0014), série persistida do endpoint `/api/vitals`.
- Janela: `7 days` (received_at >= now() - interval).
- Mínimo de amostras por métrica: 20 (abaixo disso: N/A).
- Alvos p75: LCP ≤ 2,5 s · INP ≤ 200 ms · CLS ≤ 0,1.
- Gerado por: `npx tsx scripts/obs/rum-percentiles.ts`

Nenhuma amostra em `rum_vitals` na janela declarada — todas as métricas N/A.

## Privacidade e retenção

- Sem PII: apenas nome da métrica, valor, rating, delta e navigation type.
- Sem tenant_id/RLS: métrica global de performance do browser; o runtime é INSERT-only e a leitura é admin/local.
- Retenção: série descartável de telemetria; o down da 0014 (`DROP TABLE`) é o caminho de limpeza.
