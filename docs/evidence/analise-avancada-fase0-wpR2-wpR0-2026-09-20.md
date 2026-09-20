# Análise avançada — Fase 0 (WP-R2 + WP-R0) — 2026-09-20

> **Proveniência:** texto transcrito da mensagem do operador na sessão de 2026-09-20 (o documento não
> existia em disco — busca com `fd` em repo, `$HOME` e `/tmp` não encontrou). Transcrição sem edição
> de conteúdo; formatação normalizada para o markdown do repositório. Um adendo de verificação desta
> casa está ao final (§6 da errata), separado do texto original.

---

# Análise avançada — Fase 0 (WP-R2 + WP-R0)

## 1. A aritmética reportada fecha em todas as verificações independentes

| Claim          | Verificação                                 |          |
| -------------- | ------------------------------------------- | -------- |
| `(D + ½P)/187` | `161,5/187 = 86,3636…%` → 86,36%            | ✅ exato |
| Contraprova    | `150/187 = 80,2139…%` → 80,21%              | ✅ exato |
| Errata WPs 3–5 | `3 CORR + 14 N = 17`; 3 CORR = 2+0+1        | ✅       |
| Composição NS  | `22 − 9 − 1 = 12`, dedup `24.13 ≡ 25.5`     | ✅       |
| Cauda          | `12 NS + 2 UNV = 14` (7,49% de 187)         | ✅       |
| `15.2 em 6/9`  | o §15.2 do plano lista exatamente 9 tabelas | ✅       |

A retificação do WP3 (N5 = errata do C10) é o tipo de correção encontrada pela própria
reconciliação — aumenta confiança no ledger.

## 2. 🚨 Achado forense: a célula de CI do WP-R2 cita run anterior ao próprio WP-R2

`35484327532` foi citado como run do fecho do bloco; o WP-R2 (`049ebc7` → `a7f1e4a`, posterior) citou
o mesmo run — e IDs são cronológicos (`35484327532 < 35513248913`). Hipóteses: (a) paths filter;
(b) célula stale; (c) trigger não disparou. Sob a doutrina do programa, run ID é _claim_ e precisa de
identidade. Corolário: se arquivos de processo (AGENTS/templates) estiverem fora do trigger, os
arquivos que definem o processo nunca passam por CI. Correções: item 15 do checklist; contract lint
incondicional; errata explícita no journal.

## 3. A taxonomia nova revela densidade real maior que a exposta

17 defeitos em 3 WPs ≈ 5,7/WP (vs. 7 visíveis antes). A classe dominante (harness vacuoso) se mantém
numa população maior. Manter o mapa item↔defeito vivo, com regra de aposentadoria/adição. Meta-métrica:
`0 R · 0 U` em 5 WPs consecutivos — categorias nunca usadas merecem auditoria de calibração.

## 4. O checklist já se auto-aplicou — melhor sinal da rodada

O WP-R0 capturou vacuidade nele mesmo (worktree sem `npm ci`; selo sem `CHECK_EXIT=0`) — a classe do
WP4-N2. A dupla "registro agora → R0b mede e ratifica depois" com placar inalterado é disciplina
correta; o risco é de agenda. **R0b precisa de posição explícita na fila — logo após o WP-R1.**

## 5. "15.2 em 6/9" transforma o spec do DBT-01 de genérico em concreto

Descoberta por catálogo (não lista hardcoded), canário por store, varredura do catálogo inteiro,
fail-by-default quando `count(ai_*)` subir sem a purga cobrir o novo store; registrar quais 3 tabelas
faltam; política de eliminação × PITR documentada junto.

Para o **WP-R1**: schema `id · origem · classe · severidade · closure test (com controle negativo) ·
evidência · status`, parser-compatible; regra: DBT sem closure test entra como NS. Confirmar se o
controle negativo do WP5 está em algum DBT.

## 6. O que não andou

ADR D7 (§19.1 desatualizada — logs OTel JS Stable), ADR tenant/RLS sob pooling, release
develop→main (usar o fecho do DBT-01 como gatilho natural), itens D implícitos (percent, rounding/
alocação, SameSite, budget atômico pós-csf).

## Veredicto

Fase 0 está fazendo o certo na ordem certa: consertar o instrumento antes de medir mais. Fecho
R2/R0 legítimo, com uma ressalva acionável: a citação de CI do WP-R2 — pequena, mas é a classe de
defeito que o programa existe para não deixar passar.

---

## Adendo de verificação desta casa (WP-R3, 2026-09-20)

O achado do §2 foi **confirmado** e a causa-raiz estreitada: a CI pesada **rodou** para o WP-R2
(`35512525965` em `c9d1740`, verde; captura `ci-binding.log.txt`), refutando a hipótese (a).
O defeito foi citação stale: `35484327532` é de `1aad70c` (fecho do Bloco 3). Errata registrada no
journal (L131) e convertida no item 15 do checklist. A aritmética do §1 foi reconferida item a item
na reconciliação (WP-R0) e o `15.2 em 6/9` está medido na captura `estado-ns.log.txt` daquele selo.
