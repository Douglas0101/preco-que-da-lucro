# hPanel — LIMITE DECLARADO: sessão automatizada bloqueada por Cloudflare (2026-09-12)

- **Estado:** o Web App **foi criado** (`darkgray-pony-545965.hostingersite.com`) com **11 env vars** (CP-G2 CLEAN) e o 1º build **falhou** por `EBADENGINE` (item 1 — ver `01-node-version.md`).
- **Bloqueio:** após uma rajada de navegações automatizadas, o hPanel passou a redirecionar para `auth.hostinger.com/login` com **challenge Cloudflare** ("Executando verificação de segurança"), inclusive em modo **headed** e com espera de 45s. Os cookies do dono **não expiraram** (`jwt` válido até 2026-09-15 00:43), então o bloqueio é anti-bot, não de credencial.
- **Decisão (mandato):** canal negado pelo sistema = **limite declarado**, nunca contorno agressivo. Não houve tentativa de burlar o challenge.

## Ação humana mínima — H-6

1. Abrir o **Firefox do dono** (perfil já usado pelo helper) e acessar <https://hpanel.hostinger.com/>.
2. Se aparecer a verificação de segurança, aguardar/confirmar até a home carregar ("Olá, Elaine").
3. Isso renova `__cf_bm`/sessão no perfil; o **watcher H-6** detecta e retoma sozinho.

**Detector:** `~/.local/share/pi-fronts/hpanel/h6-watch.sh` (bg task) — aguarda `__cf_bm` fresco no perfil e, então, faz **uma** sondagem headed; ao carregar a home autenticada, escreve `H6-ready.txt` e encerra (notificação automática).

## Retomada prevista (após H-6)

1. Adicionar `NPM_CONFIG_ENGINE_STRICT=false` (workaround do item 1) nas variáveis do app.
2. Reimplantar e capturar o log (esperado: build passa; registrar `node -v` exato).
3. Definir `BETTER_AUTH_URL`/`AUTH_TRUSTED_ORIGINS` = `https://darkgray-pony-545965.hostingersite.com` e redeployar.
4. Executar os 11 itens com evidência por item em `docs/evidence/hpanel-homologacao-2026-09-12/`.

## O que NÃO foi feito (por bloqueio, não por falha)

- Build verde (workaround pendente de sessão), SSL/domínio (CP-G3), itens 2–11.
- Nenhuma mutação de domínio/DNS. Nenhum secret transcrito. O app permanece em preview com os 11 nomes publicados.
