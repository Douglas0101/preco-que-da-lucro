# Engines — checklist de reconciliação 24.6 → 24.15 (F-1, rodada 2026-09-12)

**Rodada:** produção `preco-que-da-lucro` · **Frente:** F-1 ENGINES · **Data:** 2026-09-12
**Artefato canônico do checklist** referido pela cláusula (b) do §4 do [ADR-028](../adr/ADR-028-node-engines-24-6-fallback.md) e espelhado no §2/Anexo A daquele ADR — **fonte da verdade: este arquivo**; divergência futura corrige o ADR, nunca o contrário.
**Contrato de coleta:** somente leitura, sem `npm`/`npx`/`tsx`; nenhum valor de env/segredo.

## 1. Método (reprodutível)

1. **Ranges:** varrer `package-lock.json` → `packages[*].engines.node` e avaliar **cada range contra `24.6.0`** com validador próprio **calibrado por casos-conhecidos** antes de confiar no resultado:
   - `>=6.9.0` → ✓ aceita 24.6.0
   - `^22.22.2 || ^24.15.0 || >=26.0.0` → ✗ exclui 24.6.0
   - `^20.19.0 || >=22.12.0` → ✓
   - `*` → ✓
     Universo: **758 entradas**, **549 com `engines.node`**.
2. **APIs/flags:** grep em `src/`, `scripts/`, `e2e/` por `node:sqlite|DatabaseSync|fs\.glob|globSync|--experimental-|process\.getBuiltinModule|registerHooks|Error\.isError|Promise\.try|Uint8Array\.(from|to)Base64|Math\.sumPrecise|RegExp\.escape|Float16Array|navigator\.locks|navigator\.storage|using \(|Symbol\.dispose` → **zero ocorrências**.
3. **Gates:** grep por `engines` em `scripts/`, `src/`, `e2e/`, `.github/` → **zero ocorrências** (nenhum gate valida versão de Node).
4. **Workflows:** `.github/workflows/*.yml` → `node-version-file: .nvmrc` (`ui-stack.yml:40-42`, `neon-pr-branch.yml:81-83`, `neon-preview.yml:27-29`, `neon-readiness.yml:143-145`).

## 2. Checklist

| #   | Fonte (arquivo:linha)                                                                                                           | Achado                                                                                                                       | Exclui 24.6.0? | Veredito                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------- |
| A1  | `package.json:7-9` · `package-lock.json:76`                                                                                     | `engines.node = ">=24.15.0"` (root)                                                                                          | **SIM**        | blocker declarado — alvo do relaxamento               |
| A2  | `package.json:130` · `package-lock.json:8677,8707`                                                                              | `jsdom@30.0.1` (dev) `engines.node = "^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0"`                                                 | **SIM**        | blocker **oculto** — sobrevive ao relaxamento do root |
| A3  | `package-lock.json` (outras 548 entradas com `engines.node`)                                                                    | maiores pisos de runtime: TanStack Start `>=22.12.0`, `undici >=22.19.0`, `kysely >=22.0.0`, `nitro ^20.19.0 \|\| >=22.12.0` | NÃO            | OK em 24.6.0                                          |
| A4  | `src/` · `scripts/` · `e2e/`                                                                                                    | sem APIs acima do piso (mesma lista do método, item 2)                                                                       | NÃO            | nenhum floor de API > 24.6.0                          |
| A5  | `check-hostinger-runtime.mjs` · `m02-lockfile-guard.mjs` · `env-guard.mjs`                                                      | nenhum gate lê versão de Node                                                                                                | NÃO            | nada a alterar em scripts                             |
| A6  | `.github/workflows/` (4 usos de `setup-node`)                                                                                   | `node-version-file: .nvmrc` → 24.15.0                                                                                        | NÃO            | CI permanece em 24.15                                 |
| A7  | `package.json:6`                                                                                                                | `packageManager: npm@11.14.1` (imposto só por corepack)                                                                      | NÃO            | assimetria conhecida (alvo: npm 11.5.1)               |
| A8  | `README.md:25,78` · `hpanel-homologacao.md:7` · `a4-matriz-hipoteses.md:21` · `cutover-A4.md:265` · `hostinger-cloud-node.md:9` | documentam `Node >= 24.15` e "teto < 24.15 = ABORT geral"                                                                    | NÃO (doc)      | emendar no PR de ratificação                          |
| A9  | `AGENTS.md`                                                                                                                     | não fixa versão de Node                                                                                                      | NÃO            | sem alteração                                         |

## 3. Achado A2 — piso oculto do `jsdom` (não previsto)

- `jsdom@30.0.1` está em `devDependencies` (`package.json:130`, spec `^30.0.1`) e é `devOptional` no lock (`package-lock.json:8677`); é exigido por `vitest` (peer `jsdom: "*"`) e usado por `vitest.config.ts:11` (`environment: "jsdom"`).
- `engines.node` de `30.0.0`/`30.0.1` = `^22.22.2 || ^24.15.0 || >=26.0.0` → **Node 24.6.0 não satisfaz**; com `engine-strict=true` isso é `EBADENGINE` **fatal**, exatamente como no root.
- Packument no cache npm local (285 versões estáveis): a última linha que aceita 24.6.0 é **`jsdom@29.1.1`** (2026-04-30, `engines.node = "^20.19.0 || ^22.13.0 || >=24.0.0"`); a quebra entra em **`30.0.0`** (2026-07-27).
- `vitest@4.1.11` aceita qualquer `jsdom` (peer `*`) → pin `~29.1.1` **não cria conflito de peer**, mas exige lock sincronizado e `npm run test` verde no CI (24.15) antes do merge.

## 4. Veredito

- O piso > 24.6.0 **existe** (contraria a expectativa conservadora de "nenhum floor"): é **declarado** no `root` e **também** presente em `jsdom` (dev).
- **Runtime e build de produção são compatíveis com 24.6.0**: nenhuma dependência de produção exige > 24.6.0 e nenhuma API > 24.6.0 é usada no repo.
- Logo, `engines: ">=24.6.0"` é tecnicamente sustentável, porém **não suficiente sozinho**: com `engine-strict=true` e `jsdom@30.0.x` na árvore, o `npm ci` no alvo continuaria falhando mesmo após relaxar o root. A cláusula D3 do ADR-028 (pin de `jsdom` ou equivalente) é o que fecha a lacuna.
- **Remedição obrigatória no PR canônico:** `nvm use 24.6.0 && npm ci` **não executada** nesta rodada (sem `npm`/`npx` por contrato) — é critério de verificação do ADR-028 §8.2.

## 5. Referências

- `docs/adr/ADR-028-node-engines-24-6-fallback.md` (§2 espelho, §3 decisão, §4 cláusulas, §8 verificação)
- `docs/evidence/hpanel-homologacao-2026-09-12/01-node-version.md` (item 1 FAIL `EBADENGINE`; teto v24.6.0 / npm 11.5.1)
- `package.json:6-9,130` · `.npmrc:1-2` · `.nvmrc:1` · `package-lock.json:76,8677,8707`
