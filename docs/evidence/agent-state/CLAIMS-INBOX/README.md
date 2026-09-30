# CLAIMS-INBOX — protocolo (missão SDD 2026-09-15)

**Escritor:** o squad do item (1 arquivo por claim, no **seu** worktree/branch). **Leitor/integrador:** MAESTRO.

## Formato do arquivo `<id>.md`

```markdown
# CLAIM — <id>

- **wp / squad / branch / commit:** <wp> · <squad> · <branch> · <sha curto>
- **spec_ref:** <§ e INVs>
- **status pleiteado:** DONE | PARTIAL | NS (com a razão do não-upgrade)
- **cadeia SDD:**
  1. SPEC-CARD: `docs/evidence/agent-state/SPEC-CARDS/<arquivo>.md`
  2. TEST-FIRST: <testes escritos antes + prova de falha inicial (saída)>
  3. IMPLEMENT: <arquivos tocados, `arquivo:linha`>
  4. EVIDENCE: <comando exato + saída colada (não resumida)>
  5. (este arquivo)
  6. ADVERSARIAL: (preenchido pelo verificador designado pelo MAESTRO — deixar vazio)
  7. LEDGER: (preenchido pelo MAESTRO — deixar vazio)
- **limites declarados:** <regime CONTROLLED/OBSERVED, o que não foi executado e por quê>
- **propostas de integração:** <ex.: linha exata para `package.json`, atualização de registry — quem aplica é o MAESTRO>
- **rollback:** `git revert <sha>`
```

## Regras

- **Não** escrever no ledger, QUEUE.md ou PROGRESS.md.
- Evidência sem comando+saída colada = claim rejeitada (o adversarial vai reconferir do zero).
- Status pleiteado ≠ status promovido: só o MAESTRO promove, após veredicto adversarial.
- Qualquer divergência da spec ⇒ `SPEC-DELTAS/<id>.md` **antes** do merge (parar o item, não improvisar).
