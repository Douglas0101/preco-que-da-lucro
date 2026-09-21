# SPEC — WP-R5 `F-ambient-state`

**Data:** 2026-09-21 · **Branch:** `mission/r5-ambient-state` · **Base:** `eef2238`
**Autor:** MAESTRO · **S6:** lane adversarial de contexto limpo

---

## 1. Fato-fonte

| fato                                                                                                                  | ponteiro                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Análise avançada que abriu o WP (§3 taxonomia de exit codes, §4 classe "estado ambiente", §5 triagem do `.gitignore`) | análise de 2026-09-20 entregue na sessão (não há arquivo em disco — proveniência declarada)                                     |
| Defeito reproduzido do symlink versionado por `git add -A`                                                            | `PROGRESS.md` L137 (WP-R1): `7716f63` versionou `deepseek-harness`; corrigido com `git rm --cached` + amend local antes do push |
| Risco declarado e nunca fechado                                                                                       | `PROGRESS.md` L111: "o symlink `deepseek-harness` nao rastreado e nao ignorado"                                                 |
| Incidente que expôs a classe                                                                                          | `PROGRESS.md` L139: heavy `81cc7ed@35534879029` **failure**; fix `8a981f6` provado em `clone --depth 1`                         |
| Contrato do checklist a estender                                                                                      | `docs/evidence/_templates/work-package.md:60` (item 16) e `scripts/m02-work-package-guard.mjs:17` (`EXPECTED_ITEMS = 16`)       |

## 2. Problema (medido nesta abertura, não inferido)

### 2.1 `.gitignore` derivado no worktree

```text
$ git status --porcelain
 M .gitignore
$ git log -1 --format='%h %ci' -- .gitignore
225a162 2026-09-12 23:41:25 -0300      # último commit que tocou o arquivo
$ stat -c '%y' .gitignore
2026-09-20 17:27:41 -0300              # mtime do conteúdo atual
```

O arquivo que **controla o que o git enxerga** está modificado e não versionado. O mtime
(20:27:41Z) cai **25 s depois** do commit `8a981f6` (20:27:16Z) e 13 min antes de `eef2238`
(20:40:48Z) — ou seja, a edição nasceu **dentro da própria sessão do WP-R4** e nunca foi
commitada. Não é processo externo.

**Impacto medido (não presumido):**

| verificação                                    | comando                                                             | resultado                                                                                                                                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| padrões que casam arquivo hoje                 | `git check-ignore -v` por padrão                                    | `.mcp.json`=0 · `.cursor/`=0 · `.gemini/`=0 · `.kimi/`=0 · `.kimi-code/`=0 · **`deepseek-harness`=1**                                                                                                                                                     |
| descoberta das ferramentas de prova é por git? | `git grep -n 'ls-files\|--porcelain' eef2238 -- scripts/ src/test/` | **0 ocorrências na base** — `m02-seal` descobre por `readdirSync` (`scripts/m02-seal.mjs:20,63`). No HEAD deste WP o mesmo grep devolve **2**, e ambas são a **precondição nova** (comentário + a chamada de `git status`), nenhuma usada para descoberta |
| selos existentes ainda verificam sob a deriva  | `node scripts/m02-seal.mjs --dir <selo>`                            | R4 **OK 17 arquivos** · R1 **OK 13 arquivos**                                                                                                                                                                                                             |
| arquivo selado × arquivo rastreado             | manifesto × `git ls-files --error-unmatch`                          | R4 **17/17 rastreados, 0 órfãos** · R1 **13/13, 0 órfãos**                                                                                                                                                                                                |

**Conclusão:** a deriva **não contaminou** nenhum selo (descoberta é filesystem-based e os
arquivos selados estão todos rastreados). O risco é **latente e recorrente**, não consumado:
o defeito do symlink já se materializou uma vez (L137) e volta a cada `git add -A`.

### 2.2 `m02-seal` converte indeterminado em veredito

```js
// scripts/m02-seal.mjs:185-187
function gitAncestor(a, b) {
  return spawnSync("git", ["merge-base", "--is-ancestor", a, b]).status ?? 1;
}
```

`merge-base --is-ancestor` devolve `0` (é ancestral), `1` (não é) e `128` (revisão inválida);
`spawnSync().status` é `null` se o processo não sobe. O `?? 1` mapeia **falha de spawn para
"não é ancestral"**, e os consumidores (`auditAncestry`, `auditRun`) comparam `=== 0` — logo
`128` e `null` produzem **veredito** ("não é ancestral") quando o correto é **erro de
precondição**. É o isomorfismo exato do WP3-N1: um negativo que "reprova" pelo motivo errado.

### 2.3 Não existe precondição de estado ambiente

O selo assume worktree estável e histórico completo — exatamente os dois pressupostos que
falharam em R0 (worktree sem `npm ci`), R4 (clone raso) e na deriva do `.gitignore`.

## 3. Contrato (invariantes falsificáveis)

| id           | invariante                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **INV-R5-a** | O selo **asserta** sua precondição de estado ambiente: `git status --porcelain -z --untracked-files=all` não tem entrada fora do próprio diretório do selo, e o repositório é resolvido a partir do **diretório do selo** (`git -C <dir>`), nunca do cwd. Violação ⇒ **exit 2** (precondição), nunca exit 1 (veredito). `-z` é o que torna o parsing correto: o porcelain textual cita caminhos não-ASCII (`"caf\303\251.txt"`) e usa `->` para rename, ambos ambíguos. |
| **INV-R5-b** | O selo distingue **PROVADO** de **INDETERMINÁVEL** na ancestralidade: `0` = ancestral provado · `1` = não-ancestral provado · `128`/spawn-nulo/revisão não resolvida = **erro de precondição (exit 2)**, nunca veredito.                                                                                                                                                                                                                                                |
| **INV-R5-c** | `.gitignore` está versionado e o symlink `deepseek-harness` não é rastreável por `git add -A`; a política vive no contrato (`AGENTS.md`), não num diff anônimo.                                                                                                                                                                                                                                                                                                         |
| **INV-R5-d** | O checklist anti-vacuoso tem **17 itens**, e o guard enforça **forma e piso de não-vacuidade** — contagem, sequência, aridade, e as colunas de demonstração e origem não vazias nem degeneradas — nas três superfícies (`check`, `verify` do `ui-stack`, `ci-light`). **Não** enforça vacuidade semântica: um texto longo e vazio de conteúdo passa pelo guard e é objeto do S6 (limite L4).                                                                            |

## 4. Mudanças (lista fechada)

| arquivo                                           | mudança                                                                                               |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `.gitignore`                                      | **land** do bloco já presente no worktree (MCP configs + `deepseek-harness`), com a motivação da §2.1 |
| `scripts/m02-seal.mjs`                            | precondição de worktree (§3 a) e taxonomia de exit codes na ancestralidade (§3 b)                     |
| `src/test/m02-seal.test.ts`                       | casos RED/GREEN dos dois invariantes + falsificação do indeterminável                                 |
| `scripts/m02-work-package-guard.mjs`              | `EXPECTED_ITEMS` 16 → 17                                                                              |
| `docs/evidence/_templates/work-package.md`        | item 17 + linha de origem no apêndice A                                                               |
| `src/test/m02-work-package-guard.test.ts`         | fixture 16 → 17                                                                                       |
| `AGENTS.md`                                       | item 17 na âncora do contrato + garantia de cobertura                                                 |
| `docs/evidence/wp-r5-ambient-state-2026-09-21/**` | SPEC, README, capturas, `MANIFEST.sha256`                                                             |

**Não muda:** nenhum código de runtime, nenhuma migration, nenhum schema, `package.json`
intocado, `:5432` intocado, `origin/main` intocado.

## 5. DoD (binário, com prova)

| #   | critério                                                                          | prova                                          |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1   | `git status --porcelain` limpo fora do selo, com `.gitignore` commitado           | `git status --porcelain` vazio no HEAD do land |
| 2   | selo com worktree derivado **reprova com exit 2** e mensagem que nomeia o caminho | caso de teste + captura                        |
| 3   | SHA inexistente na ancestralidade ⇒ **exit 2**, não exit 1                        | caso de teste + captura                        |
| 4   | caso invertido legítimo (objetos existem, relação falsa) continua **exit 1**      | caso existente preservado                      |
| 5   | guard reprova template com 16 itens e passa com 17                                | `m02:work-package-guard` + teste               |
| 6   | `npm run check` exit 0 no HEAD integrado                                          | captura `gate-local.log.txt`                   |
| 7   | selo próprio com `checked === discovered` e `D ≠ L`                               | `m02-seal` no diretório do WP                  |
| 8   | CI verde no commit selado, `run@sha` com ≥ 1 check aplicável                      | `gh run list` filtrado por SHA                 |

## 6. Testes — RED/GREEN e falsificação

| invariante | RED (defeito presente)                                               | GREEN (defeito corrigido)          | falsificação                                                                                      |
| ---------- | -------------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------- |
| INV-R5-a   | worktree com ` M .gitignore` fora do selo ⇒ selo **passa** (defeito) | ⇒ **exit 2** nomeando `.gitignore` | remover a linha derivada e ver o selo voltar a passar — o par discrimina a **causa**, não o exit  |
| INV-R5-b   | SHA inexistente ⇒ **exit 1** ("não é ancestral")                     | ⇒ **exit 2** ("não determinável")  | o caso invertido com objetos presentes continua exit 1 — se ambos virarem 2, a taxonomia colapsou |
| INV-R5-d   | template com 16 itens ⇒ guard **reprova**                            | template com 17 ⇒ guard passa      | remover o item 17 do template real e exigir reprovação por contagem                               |

**Regra do §3 da análise, mecanizada:** fixture controlada elimina o indeterminável; o
fail-closed garante que, se ele reaparecer, **não vira veredito**.

## 7. Riscos

| risco                                                                                             | disposição                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A precondição de worktree tornar o selo inutilizável no fluxo normal (worktree sujo durante o WP) | mitigado por desenho: a asserção exclui o próprio diretório do selo; o fluxo canônico já commita o conteúdo **antes** de selar (padrão do R4: `cc3ae9b` → `af29293`) |
| `git status --porcelain` ser sensível a `.gitignore` (a própria classe do WP)                     | declarado: entradas ignoradas não aparecem em `--porcelain`; o WP landa o `.gitignore` **e** o versiona, fechando a recursão                                         |
| Falso verde por repositório sem git                                                               | precondição falha alto (exit 2) se `git status` não rodar                                                                                                            |
| Item 17 exigir atualização de fixtures antigas                                                    | verificado: só o template real e a fixture do guard referenciam a contagem                                                                                           |

## 8. Rollback

`git checkout develop && git branch -D mission/r5-ambient-state`. Nada entra em `develop`
antes do Gate C; nenhuma migration, nenhum estado externo. O land do `.gitignore` é
revertível por `git revert` do commit que o versiona.
