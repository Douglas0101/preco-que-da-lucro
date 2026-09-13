# Contrato duplo de build — prova local (2026-09-13)

**Pergunta da FASE 1:** com o preset condicional `nitro: { preset: process.env.VERCEL ? "vercel" : "node-server" }`,
o build local produz **os dois** artefatos exigidos pelos dois alvos — `.output/server/index.mjs` (preset node / hPanel)
**e** `.vercel/output` (Build Output API / Vercel)? Fixo em vez de condicional seria regressão cruzada.

**Veredito: PASS** — ambos os caminhos funcionam com o mesmo código; nenhuma regressão cruzada. O port (FASE 2) está desbloqueado.

## Execução (local, `develop` + WIP `49eaf2b` já com o preset)

| #   | Comando                        | Exit  | Artefato provado                                                       | Tamanho  |
| --- | ------------------------------ | ----- | ---------------------------------------------------------------------- | -------- |
| 1   | `npm run build` (sem `VERCEL`) | **0** | `.output/server/index.mjs`                                             | 21 443 B |
| 2   | `VERCEL=1 npm run build`       | **0** | `.vercel/output/config.json` (+ `functions/`, `static/`, `nitro.json`) | 366 B    |

- Overrides locais sancionados (`AGENTS.md`): `DATABASE_URL`/`DATABASE_ADMIN_URL`/`DATABASE_URL_UNPOOLED` em `127.0.0.1:5432` + `DATABASE_DRIVER=node-postgres` (o `.env` aponta para produção e o `env-guard` faz DENY — nunca contornado).
- Log de referência: `/tmp/b1.log` (build 1) e `/tmp/b2.log` (build 2); ambos terminam com `[nitro] ✔ You can deploy this build using npx nitro deploy --prebuilt`.
- Limpeza: os dois diretórios de build são artefatos regeneráveis e **não** entram em commit.

## Achado colateral (higiene)

- **`.vercel/` não estava no `.gitignore`** → o build com `VERCEL=1` deixou **138 arquivos** como untracked e poluiu o gate local (`prettier --check .` varria `.vercel/output/**`). Correção: adicionar `.vercel/` ao `.gitignore` (padrão recomendado pela própria Vercel) e limpar os artefatos.

## O que isto habilita

- FASE 2 (port do lote P0) pode prosseguir sem risco de trocar um artefato de build pelo outro.
- O deployment do WIP já estava verde (`49eaf2b` → Ready 18 s) e agora há prova local do contrato, não apenas inferência pelo painel.
