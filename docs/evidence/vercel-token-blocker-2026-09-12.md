# Vercel — criação de token pela UI: BLOQUEIO DECLARADO (2026-09-12)

- **Sessão:** válida (dashboard de tokens carrega; conta `douglasultimatesouza-5127`).
- **Objetivo:** token de escopo mínimo para inventário de config (deployments/aliases/env) e fechamento do drift `NEON_AUTH_*`.
- **Bloqueio:** o formulário "Create Token" usa um **combobox customizado** para SCOPE:
  - `input[aria="Select scope"]` alterna entre ausente/não-preenchível entre renders;
  - clique por locator estoura timeout; clique por coordenadas **abre** a lista (opções vistas: `douglasultimatesouza-5127`, `...'s projects (+1)`, `Full Account (Non-SAML)`), mas o submenu/seleção não responde a clique/fill/Enter automatizados;
  - EXPIRATION também exige seleção explícita.
- **Decisão:** **não contornar** (nada de engenharia reversa da UI ou captura de sessão); deferir com instrução humana mínima.

## Ação humana mínima (1 minuto) — alternativa ao H-2

1. Abrir <https://vercel.com/account/settings/tokens> no navegador do dono.
2. **Create Token** → nome `pi-fronts-2026-09-12` → SCOPE: preferir o **projeto `preco-que-da-lucro`** (ou a conta, se o projeto não estiver listado) → EXPIRATION: 30 dias → Create.
3. Copiar o token **uma única vez** para `~/.config/vercel-token` (chmod 600) — **não** colar em chat/artefato.
4. O watcher H-2 detecta o arquivo e eu sigo com o inventário (nomes apenas).

## Estado sem o token (evidência já existente)

- Produção interina: `preco-que-da-lucro-sage.vercel.app` **200/200/200** (live/ready/get-session), evidência de 2026-09-12T03:07–03:08Z.
- Alias canônico `preco-que-da-lucro.vercel.app` → 404 `DEPLOYMENT_NOT_FOUND`; deployment medido sob SSO.
- Deploy de produção do `main` em `ef2110e7`: **success** (2026-09-12T03:15Z+, via GitHub App).
- Pendente de token: target/alias exatos, build settings do dashboard, nomes/ambientes de env e remoção de `NEON_AUTH_*` órfãs.
