# hPanel — LIMITE DECLARADO: sessão automatizada bloqueada por Cloudflare (2026-09-12)

- **Estado:** o Web App **foi criado** (`darkgray-pony-545965.hostingersite.com`) com **11 env vars** (CP-G2 CLEAN) e o 1º build **falhou** por `EBADENGINE` (item 1 — ver `01-node-version.md`).
- **Bloqueio:** após uma rajada de navegações automatizadas, o hPanel passou a redirecionar para `auth.hostinger.com/login` com **challenge Cloudflare** ("Executando verificação de segurança"), inclusive em modo **headed** e com espera de 45s. Os cookies do dono **não expiraram** (`jwt` válido até 2026-09-15 00:43), então o bloqueio é anti-bot, não de credencial.
- **Decisão (mandato):** canal negado pelo sistema = **limite declarado**, nunca contorno agressivo. Não houve tentativa de burlar o challenge.

- **Observação (2026-09-12T09:08Z):** após ~4h de cooldown, **uma** sondagem headed carregou a home autenticada; a navegação seguinte (novo contexto de automação) foi desafiada de novo. O bloqueio é **intermitente** e dirigido à automação (não à credencial). Estratégia adotada: **parar de insistir**.

## Ação humana — H-6 (caminho mais rápido, ~2 min, no seu Firefox)

1. Abrir <https://hpanel.hostinger.com/websites/darkgray-pony-545965.hostingersite.com> no **Firefox do dono**.
2. **Variáveis de ambiente** → **Adicionar variável de ambiente** → chave `NPM_CONFIG_ENGINE_STRICT`, valor `false` → salvar (o salvar já redispara o deploy).
3. **Implantações** → **Reimplantar** (acompanhar o build).
4. Ainda em **Variáveis de ambiente**, adicionar `BETTER_AUTH_URL` = `https://darkgray-pony-545965.hostingersite.com` e `AUTH_TRUSTED_ORIGINS` = o mesmo valor → salvar (novo redeploy).
5. Me avisar — eu retomo a verificação **11/12** e capturo as evidências por item.

**Detector:** `h6-watch.sh` **v3** (bg task rastreada) — sinal forte = **mudança do hash do `jwt`** no perfil (seu re-login); então faz **uma** sondagem headed. Zero sondagem especulativa.

## Retomada prevista (após H-6)

1. Adicionar `NPM_CONFIG_ENGINE_STRICT=false` (workaround do item 1) nas variáveis do app.
2. Reimplantar e capturar o log (esperado: build passa; registrar `node -v` exato).
3. Definir `BETTER_AUTH_URL`/`AUTH_TRUSTED_ORIGINS` = `https://darkgray-pony-545965.hostingersite.com` e redeployar.
4. Executar os 11 itens com evidência por item em `docs/evidence/hpanel-homologacao-2026-09-12/`.

## O que NÃO foi feito (por bloqueio, não por falha)

- Build verde (workaround pendente de sessão), SSL/domínio (CP-G3), itens 2–11.
- Nenhuma mutação de domínio/DNS. Nenhum secret transcrito. O app permanece em preview com os 11 nomes publicados.
