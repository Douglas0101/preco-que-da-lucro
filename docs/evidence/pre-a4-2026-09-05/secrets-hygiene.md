# Higiene de segurança pré-A4 — DB-02 e inventário de segredos

- **Data:** 2026-09-05 · **Rodada:** pré-A4 burn-down · **PR:** chore/pre-a4-security-hygiene
- **Autorizações exercidas:** A2 (revogação das credenciais de `neon-storage.env` + remoção do disco). A1 (destruição do sandbox) fica aguardando o workflow `neon-drill-ops` chegar a `main` (ver §4).

## 1. DB-02 — credenciais órfãs em `neon-storage.env`

### Antes (2026-09-05T19:55:19Z)

```
stat: neon-storage.env, 361 bytes, mtime 2026-08-18T01:57:20-03:00
sha256 (prefixo): cf0bbee7c99ca20b
chaves (nomes apenas, valores nunca lidos): AWS_ACCESS_KEY_ID, AWS_ENDPOINT_URL_S3, AWS_REGION, AWS_SECRET_ACCESS_KEY, OPENAI_API_KEY
git check-ignore: confirmado fora do git
```

### Prova de não-consumo

Varredura por nome de chave em `src/`, `scripts/`, `e2e/`, `.github/` (rastreados
por git, excluídos `node_modules`, `.env*`, `package-lock.json`):
**zero consumidores para as 5 chaves** — reproduzível via
`npm run m02:secrets-audit` (saída completa: `secrets-audit.json` neste diretório,
resumo: 24 definidos · 8 com consumidor · 2 docs-only · 14 órfãos).

### Ações executadas

1. **Arquivo removido do disco em 2026-09-05T19:58:45Z** (`rm neon-storage.env`;
   verificado por `ls` → inexistente). Evidência antes/depois neste documento.
2. **Revogação no emissor: PENDENTE-HUMANO** — exige console web autenticado,
   fora do alcance desta sessão. Passos exatos:
   - **OpenAI:** platform.openai.com → API keys → revogar a chave presente em
     `OPENAI_API_KEY` (identificável pelo prefixo do valor no backup local do
     operador, se houver; a chave não tem consumidor, então a revogação não
     quebra nada).
   - **S3-compatible (AWS\_*):** identificar o provedor pelo valor de
     `AWS_ENDPOINT_URL_S3` na cópia local do operador e revogar o par
     access/secret no console desse provedor.
   - Registrar a revogação no ledger com data. Até lá, exceção **SEC-01**
     (credenciais possivelmente live no emissor; mitigação parcial: arquivo
     local destruído, zero consumidores, nunca versionado).

## 2. Inventário de segredos — classificação (Regra 3)

Fonte: `npm run m02:secrets-audit` (script novo `scripts/m02-secrets-audit.ts`,
read-only, saída JSON timestamped) + `gh secret list` / `gh variable list`.

| Achado                                                                                                     | Classificação                                                                                                                                            | Ação                                                               |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 5 chaves de `neon-storage.env` sem consumidor (DB-02)                                                      | **VIOLAÇÃO** (gestão de segredos) → resolvida no disco; **SEC-01** cobre a janela até revogação                                                          | arquivo removido; revogação pendente-humano                        |
| `SUPABASE_*` / `VITE_SUPABASE_*` em `.env` sem consumidor                                                  | **FALSO-ALARME** (residual; gate CI já proíbe runtime Supabase)                                                                                          | limpeza de `.env` local recomendada, sem gate                      |
| `NEON_AUTH_BASE_URL` / `NEON_AUTH_JWKS_URL`                                                                | **docs-only** (citados em evidência/skills; zero leitores em código)                                                                                     | remover de `.env` local na próxima higiene                         |
| `NEON_BRANCH` / `NEON_DATA_API_URL`                                                                        | **órfãos**                                                                                                                                               | remover de `.env` local na próxima higiene                         |
| `DATABASE_URL_UNPOOLED` sem consumidor em código                                                           | **FALSO-ALARME** — é a URL direct de operador (ADR-019: migrations/admin/dump); consumida manualmente como `DATABASE_ADMIN_URL` (smoke, drill de backup) | documentar em `.env.example` (já coberto por `DATABASE_ADMIN_URL`) |
| GitHub Secrets: apenas `NEON_API_KEY` (2026-08-18); vars: `NEON_PROJECT_ID`                                | **CONFORME** — superfície mínima                                                                                                                         | —                                                                  |
| `SUPABASE_MIGRATION_DATABASE_URL` referenciado em `neon-readiness.yml` mas **ausente** dos secrets do repo | **CONFORME intencional** — o workflow bloqueia o modo legacy sem a credencial (guarda alinhada a M02-D-008)                                              | nenhuma                                                            |

Limite da evidência: o inventário cobre o repo rastreado por git + metadados de
secrets do GitHub (nomes, não valores). Não cobre máquinas de terceiros nem
consoles de provedores.

## 3. Sandbox `br-summer-dream-ayewlgx2` (A1) — agendado

A destruição exige a Management API do Neon (sem `NEON_API_KEY` local nesta
sessão). Ferramenta: workflow `neon-drill-ops` (PR #30), despachável após
publicação em `main`. Evidência (lista de branches antes/depois) será anexada
ao evidence doc consolidado da rodada. Estado: **AGENDADO**, não executado.
