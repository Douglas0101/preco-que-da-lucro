# Vercel — probes da produção interina (F-6, sem token) — 2026-09-13

**Rodada:** produção `preco-que-da-lucro` · **Frente:** F-6 VERCEL · **Executado por:** orquestrador (curl público; nenhum token disponível — H-2)
**Baseline de referência:** `docs/evidence/vercel-docmap-2026-09-12.md`, `docs/evidence/G-VER-v2-memo-2026-09-12.md`

## 1. Probes timestamped — alias de deployment (`preco-que-da-lucro-sage.vercel.app`)

| Instante (UTC)       | Probe                   | HTTP    | t (s) | Corpo                                                 |
| -------------------- | ----------------------- | ------- | ----- | ----------------------------------------------------- |
| 2026-09-13T01:01:24Z | `/api/health/live`      | **200** | 1.42  | `{"status":"ok"}`                                     |
| 2026-09-13T01:01:25Z | `/api/health/ready`     | **200** | 1.81  | `{"status":"ready","dependencies":{"postgres":"ok"}}` |
| 2026-09-13T01:01:27Z | `/api/auth/get-session` | **200** | 0.70  | `null` (sem sessão — esperado sem cookie)             |

- `server: Vercel` · `x-vercel-cache: MISS` · `x-vercel-id: gru1::iad1::6xcxh-…` → **execução edge gru1 / região iad1**, sem cache.
- **Semântica do `get-session` 200 com corpo `null`:** prova que a rota de auth **está montada e respondendo** (não 404/500); não prova troca de auth do dia-D (isso só ocorre com `BETTER_AUTH_URL`/`AUTH_TRUSTED_ORIGINS` canônicos — F-2).

## 2. Alias canônico (`preco-que-da-lucro.vercel.app`)

| Instante (UTC)       | Probe              | HTTP    | Corpo                                                                   |
| -------------------- | ------------------ | ------- | ----------------------------------------------------------------------- |
| 2026-09-13T01:01:28Z | `/api/health/live` | **404** | `The deployment could not be found on Vercel.` (`DEPLOYMENT_NOT_FOUND`) |

- Mantém o estado já documentado no docmap: o alias canônico **não está atribuído a deployment vivo**; o tráfego interino está no alias `-sage`. **Sem mudança** nesta rodada (e sem mutação — não há token).

## 3. SHA auto-deployado — NÃO CONFIRMÁVEL nesta rodada

- Sem token (H-2 pendente) e sem Vercel CLI, **não é possível** consultar o deployment ativo nem o commit associado.
- **Classe:** `[NÃO VERIFICADO]` — a expectativa de que o alias `-sage` sirva `ef2110e7` (main, SHA do dia-D) **permanece hipótese**, não fato. Não usar como evidência de release.
- Alternativa disponível sem token: quando o hPanel subir (F-5) e as vars canônicas forem aplicadas, os probes canônicos com `get-session` **200 + cookie** serão a prova funcional; o SHA continua dependendo de H-2 ou de inspeção no painel (navegador do dono).

## Veredito F-6 (parcial, por limite declarado)

| Item                                       | Estado                                  |
| ------------------------------------------ | --------------------------------------- |
| Interina `-sage`: live/ready/get-session   | **200/200/200** ✅ (timestamped)        |
| Interina `-sage`: postgres no `ready`      | **ok** ✅                               |
| Alias canônico                             | **404** (estado conhecido; sem mutação) |
| SHA do deployment                          | **NÃO VERIFICADO** (depende de H-2)     |
| Inventário de config / drift `NEON_AUTH_*` | **BLOQUEADO** (H-2)                     |
