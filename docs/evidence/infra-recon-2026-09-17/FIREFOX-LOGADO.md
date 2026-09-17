# Reconhecimento com o **Firefox logado do dono** — 2026-09-17

> **Por que existe:** o dono determinou que a navegação autônoma use o **Firefox onde o ecossistema e a
> infraestrutura estão logados** (hPanel, Vercel, Neon, GitHub). Este artefato registra o **método**
> (reprodutível), o que ficou **acessível**, o que ficou **bloqueado** e os **fatos de infraestrutura**
> capturados — sem registrar cookie, token, connection string ou qualquer valor secreto.

## 1. Método (reprodutível) — Firefox com o perfil do dono

- O MCP `playwright` do harness sobe **Chromium** (`@playwright/mcp`, sem os logins do dono) — não serve para a infraestrutura.
- O Firefox do dono é **Flatpak** (`/app/lib/firefox/firefox`), perfil ativo em
  `~/.var/app/org.mozilla.firefox/config/mozilla/firefox/zqd7gpjd.default-release`.
- **Técnica usada:** copiar o perfil para um scratch (`/tmp/ff-profile`, 768 MB; exclui `cache2`/`startupCache`/locks)
  e abrir com o **Firefox do Playwright** via `firefox.launchPersistentContext(profile)` — os logins vêm do
  próprio perfil (cookies + `key4.db`), **sem** tocar a sessão viva do dono (o Firefox dele continua aberto, intocado).
- Scripts do reconhecimento: `/tmp/ff-session/{nav2,infra,neon2,neon3,neon4}.mjs` (descartáveis; o método está descrito aqui).
- **Regra de segurança aplicada:** navegação **read-only**; nenhum modal de "Connection string"/token foi aberto;
  nada foi copiado do DOM que pudesse conter valor secreto.

## 2. O que ficou acessível × bloqueado

| alvo                   | estado           | observação                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Vercel**             | ⚠️ **parcial**   | sessão **válida** (a conta `douglasultimatesouza-5127s-projects` abriu e `document.cookie` tinha 1.325 chars), mas o SPA entra em **error boundary** ("Something went wrong") em todas as rotas testadas (`/dashboard`, `/account/tokens`, projeto) — inclusive após limpar `sessionStorage`. **H-2 (token) não é automatizável por aqui** |
| **hPanel (Hostinger)** | ❌ **bloqueado** | **Cloudflare Turnstile** ("Just a moment… / Performing security verification") — reproduzido em **headless e headed** (janela real no Wayland do dono, 25 s de espera). Igual ao registrado em `SESSION-LIMIT.md` (2026-09-12). **Limite declarado — nenhuma tentativa de contorno**                                                       |
| **Neon Console**       | ✅ **acessível** | org `org-purple-snow-18870527`, projeto lido por completo (§3)                                                                                                                                                                                                                                                                             |
| **GitHub**             | ➖ não testado   | já coberto por MCP/`gh` quando necessário                                                                                                                                                                                                                                                                                                  |

## 3. Fatos de infraestrutura capturados (Neon — autoritativos, do console)

| campo                 | valor                                                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projeto               | `preco-que-da-lucro-g3-pg17` · id **`damp-forest-57346541`** · AWS US East 2 (Ohio) · criado 2026-08-17                                                        |
| **Plano**             | **Free** ← causa-raiz do H-4                                                                                                                                   |
| **History retention** | **6 hours** (o SDD §16.6 exige **≥ 7 dias**)                                                                                                                   |
| Postgres              | **17** · Default compute `0.25 ↔ 2 CU`                                                                                                                         |
| Branch default        | **`production`** = `br-snowy-violet-aymcvvvv` · **Expires: Never** · criada 2026-08-17                                                                         |
| Branches              | **4** (contagem do console)                                                                                                                                    |
| Compute de produção   | endpoint **`ep-long-violet-aye9g0bn`** — **é exatamente o prefixo que o `env-guard` hard-deny** e para onde aponta o `DATABASE_URL_UNPOOLED` do achado **B-3** |
| Uso                   | Storage 33,58 MB · History 226,13 kB · Network 18,34 MB · Compute 1,77 CU-hrs (desde 31/08)                                                                    |
| Serviços              | Postgres database (1 db, 1 compute) · **BetterAuth habilitado** · Object storage · Functions (AI Gateway: requer upgrade)                                      |
| Rede                  | IP restrictions: **None set** · VPC: not configured                                                                                                            |

## 4. Decisões que isto destrava

1. **H-4** deixa de ser incógnita: a janela de 6 h **é consequência do plano Free**. Para cumprir §16.6 (≥ 7 d) o projeto precisa ir para **Launch** (billing do dono, ~US$1–3/mês) — ou assinar a exceção P9. Ação **do dono** (billing), agora com o número na mão.
2. **B-3 confirmado em severidade:** a variável de produção que vive no ambiente herdado aponta para o **compute de produção** (`ep-long-violet-aye9g0bn`). Reforça a regra `env -u` (AGENT-ENV-NOTES §10) e a opção **A** escolhida pelo dono.
3. **H-2 permanece humano:** sem o dashboard do Vercel não há inventário de env/aliases/proteção; o caminho é o dono criar o token (~1 min) **ou** autorizar a CLI com um token já existente.
4. **H-6 permanece humano:** o Turnstile resiste ao contexto automatizado (agora com evidência nova, headed incluído); o runbook de 2 min no Firefox do dono segue válido.
5. **§42 (Neon produção):** o estado lido (plano, retenção, branch default, IP restrictions) alimenta o gate; **nada** foi mutado no Neon.

## 5. Evidência

Capturas em `screenshots/` (apenas UI de dashboard; conferidas sem token/connection string):
`neon-projects.png` (lista/uso), `neon-overview.png` (branch/plano/projeto), `neon-settings.png` (retenção de 6 h e Postgres 17),
`vercel-retry.png` (error boundary do SPA — prova do bloqueio), `hpanel-headed.png` (Turnstile em modo headed).
