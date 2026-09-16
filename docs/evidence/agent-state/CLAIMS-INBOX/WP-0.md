# CLAIM — WP-0 (matriz de transições)

- **wp / dono / branch / commit:** `WP-0` · VERIFICADOR-C · develop (sem worktree — docs-only) · `c5d7bfe`
- **spec_ref:** `docs/evidence/agent-state/SPEC-CARDS/WP-0-transicoes.md`
- **status pleiteado:** DONE
- **cadeia SDD:** (1) spec-card ✔ · (2) n/a read-only · (3) implementação = o artefato · (4) E1 = script de recontagem `python3 /tmp/wp0-recontagem.py` reproduzindo a saída byte a byte · (5) este claim (extraído do §8 do artefato, por escopo exclusivo de arquivo)
- **E1 (trecho):** ver §6/§8 de `TRANSICOES-ROUND-2026-09-15.md`.

## §8 do artefato (claim embutido)

## 8. CLAIM — WP-0 (contrato canônico, **embutido** por escopo exclusivo do card)

> O card fixa escopo de arquivo exclusivo: `TRANSICOES-ROUND-2026-09-15.md` (novo) + `RELATORIO-MISSAO-2026-09-15.md` **apenas se houver errata** — "Nada mais". O `CLAIM` canônico vai, portanto, **dentro** deste arquivo (o MAESTRO pode copiá-lo para `CLAIMS-INBOX/WP-0.md` no S5 se quiser o arquivo separado).

- **id / papel / branch / commit:** `WP-0` · VERIFICADOR-C (read-only sobre código; sem worktree, conforme o card) · `develop` (árvore de trabalho principal) · commit deste WP — **ponteiro estável, imune a `--amend`**: `git log -1 --format='%h %s' -- docs/evidence/agent-state/TRANSICOES-ROUND-2026-09-15.md` · base do round `4d500fc`.
- **spec_ref:** `docs/evidence/agent-state/SPEC-CARDS/WP-0-transicoes.md` (lido inteiro) · NAS-2 §3.2 (E1/E2) · NAS-2 §10 · §45 (DoD) · base `plan-recap-2026-09-15/{MEDICAO,ANEXO}-*.md` + `agent-state/{RELATORIO-MISSAO,RECONCILIACAO-BASE}-*.md` + `CLAIMS-INBOX/*` §LEDGER.
- **status pleiteado:** **DONE** (docs-only; não há item do Plano Mestre promovido nem rebaixado por este WP — a régua é auditoria).
- **cadeia SDD:**
  1. **SPEC-CARD:** lido inteiro antes de qualquer escrita; nenhuma divergência ⇒ sem `SPEC-DELTAS/`.
  2. **TEST-FIRST:** n/a (não há código). O análogo é o **falsificador**: a alegação NAS-2 ("2 saídas de DONE + 1 NS→P residual") foi tratada como hipótese a ser reproduzida por busca exaustiva — e **não** é reproduzível a partir da base correta (§4.2). A "prova vermelho→verde" é: assinatura da alegação `(2, 1)` vs assinatura real `(0, 0)`.
  3. **IMPLEMENT:** `docs/evidence/agent-state/TRANSICOES-ROUND-2026-09-15.md` (novo) · `docs/evidence/agent-state/RELATORIO-MISSAO-2026-09-15.md` (§9 ERRATA apensa). Nada mais foi tocado.
  4. **EVIDENCE:** §6 (comando + saída colada integral) e §6.1 (caminho curto em `awk`); o script do §9, **extraído do próprio documento e executado, reproduz a saída colada byte a byte** (`diff` vazio).
  5. (este arquivo)
  6. ADVERSARIAL: (vazio — S6, adversarial aritmético, recontagem do zero sem ler a matriz primeiro).
  7. LEDGER: (vazio — MAESTRO).
- **E1 (evidência provisória deste worktree):**
  - caminho: `docs/evidence/agent-state/TRANSICOES-ROUND-2026-09-15.md` · trecho-chave: §3 (matriz da missão, 12 transições nomeadas, `139/25/21/2 → 147/26/12/2`) e §4.1 (`DONE 54 + 6 − 0 = 60 … residuais (0, 0)`);
  - como reproduzir: `python3 /tmp/wp0-recontagem.py` (script no §9), ou o `awk` do §6.1; a saída esperada é a colada no §6 (`idêntica ao RECONCILIACAO-BASE §2: True`, `base == 139/25/21/2: True`, `final == 147/26/12/2: True`, `resultado da busca: 0`).
- **auto-avaliação de riscos:**
  1. **Fonte do estado final:** a lista nominal depende do §LEDGER dos claims (é lá que o MAESTRO registra as promoções). Se um claim for reaberto/reclassificado, as linhas afetadas precisam de recálculo — o script isola isso em um único dicionário (`MISSION`).
  2. **Convenção de blocos:** a partição A–D usa o intervalo de § do próprio `MEDICAO §1` (com os itens nomeados em A). Ela reproduz **as duas** referências externas (`RECONCILIACAO §2` "Blocos atuais" e `RELATORIO §5`), mas continua sendo uma convenção derivada: mudar a fronteira entre blocos altera a tabela §3.2 (não altera globais nem o veredito).
  3. **Origem da alegação:** a reconstrução do §4.3 é uma **hipótese sustentada por busca exaustiva**, não uma declaração do autor da diretiva. A **refutação** (§4.1/§4.2) não depende dela.
  4. **Sem risco de código:** nenhum arquivo executável, migration, workflow ou teste foi tocado; nenhum gate depende deste artefato.
- **o que explicitamente NÃO foi feito:** sem execução de suíte/build/gates/containers/banco (`:5432` intocado); **sem push**; não escrevi em `QUEUE.md`, `PROGRESS.md`, ledger, `SPEC-CARDS/`, `SPEC-DELTAS/`, `DECISIONS-PENDING/**`, `CLAIMS-INBOX/**` ou em qualquer worktree; **não reclassifiquei nenhum item** (mérito de status é do STEWARD — D3/D4 e §3 do relatório já o fizeram); não re-derivei as evidências `arquivo:linha` de cada claim (é do adversarial de cada WP); a observação sobre o parêntese do `QUEUE.md §Base` (§4.3) fica **registrada**, não corrigida.
- **rollback:** `git revert $(git log -1 --format=%H -- docs/evidence/agent-state/TRANSICOES-ROUND-2026-09-15.md)` (arquivo novo + 1 seção apensa; nenhum efeito em código).
- **propostas de integração (aplica o MAESTRO):** (a) liberar o bloqueio "lacuna contábil em verificação" do `QUEUE.md` (§4.4); (b) corrigir o parêntese do `QUEUE.md §Base` para "6 entradas em DONE (4 NS→D + 2 P→D), 3 NS→P, 0 saídas de DONE" (§4.3); (c) copiar este CLAIM para `CLAIMS-INBOX/WP-0.md`, se quiser o arquivo separado no S5.

---
