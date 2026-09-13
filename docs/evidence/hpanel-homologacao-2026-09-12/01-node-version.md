# hPanel — Item 1 (Node >= 24.15.0): FAIL documentado + workaround

- **Data:** 2026-09-12 · **Web App:** `darkgray-pony-545965.hostingersite.com` (preview) · **Commit:** `ef2110e7`
- **Veredito do item 1:** **FAIL** — o teto de Node da plataforma é **v24.6.0**, abaixo do exigido `>=24.15.0`.

## Evidência (log de build, 17 linhas)

```text
npm error code EBADENGINE
npm error engine Unsupported engine
npm error engine Not compatible with your version of node/npm: undefined
npm error notsup Required: {"node":">=24.15.0"}
npm error notsup Actual: {"npm":"11.5.1","node":"v24.6.0"}
ERROR: Failed to install dependencies
```

- Duração: 32s · Estado: `Falha na construção` · Repositório: `preco-que-da-lucro` · Branch: `main`
- Causa: `.npmrc` do repo tem `engine-strict=true` + `package.json engines.node >= 24.15.0`; o runtime de build da Hostinger usa Node **24.6.0**.
- Doc oficial confirma apenas seleção por **major** (`docs.hostinger.com/node.js/build-settings.md` → Node 18/20/22/24) — não há escolha de patch.

## Workaround aplicado (documentado, reversível)

- Variável de ambiente do Web App: **`NPM_CONFIG_ENGINE_STRICT=false`** (não-secreta), que sobrepõe o `.npmrc` (precedência npm: CLI > env > `.npmrc`).
- Justificativa: permitir `npm ci` no Node 24.6.0 enquanto o teto da plataforma não alcança 24.15.0.
- **ADR pendente (ratificação):** relaxar `engines.node` para `>=24.6.0` (ou `>=24`) é a correção canônica; o workaround por env é o caminho mínimo sem alterar o contrato do repo. Registrado como desvio autorizado pelo mandato ("minor < 24.15 → ADR ou workaround documentado, nunca silêncio").

## Notas

- CI local usa Node 24.15+ (`.nvmrc`) e permanece verde — o FAIL é específico do alvo Hostinger.
- Item 1 do runbook de homologação: `docs/runbooks/hpanel-homologacao.md:7`.
