# Templates de assinatura — H-3, H-5 e P9 (prontos para assinar)

> **Status:** `TEMPLATE — NADA ASSINADO`. Nenhuma assinatura foi emitida por agente
> (§13.6, Onda 4). Estes instrumentos existem para o operador humano preencher, datar e
> assinar; enquanto o campo `Assinatura` estiver vazio o dia-D continua **ARMADO / NÃO
> EXECUTÁVEL** (`docs/runbooks/dia-d-2026-09-12.md` §0, P1/P8/P9).
> **Registro:** depois de assinado, o carimbo entra no ledger (`EXECUTION-STATE-PROGRAM.md`)
> com data UTC; o instrumento assinado é anexado em `docs/evidence/` na rodada do dia-D.

---

## 1. H-3 — G-VER-v2 (destino híbrido / autorização do dia-D)

- **Instrumento existente:** `docs/evidence/G-VER-v2-memo-2026-09-12.md` §4.
- **O que a assinatura autoriza:** destino híbrido (Vercel interino + hPanel canônico), conforme
  §2 do memo. **Não** autoriza mutação de domínio/DNS (isso é H-5 + D-0), nem dispensa snapshot < 24 h.
- **Insumos que o humano precisa trazer antes de assinar:**

| #   | Insumo                                                                                   | Fonte que produz                                                                       |
| --- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | Contagem de homologação (hoje n/11; item 1 Node `EBADENGINE` aberto)                     | `docs/evidence/hpanel-homologacao-2026-09-12/`                                         |
| 2   | Trio de snapshot externo < 24 h (`created_at` + sha256) e ID/validade do snapshot nativo | `npm run m02:readiness` (`snapshot-fresco`); ledger; `.artifacts/backup-drill/<data>/` |
| 3   | SHA congelado de `main` do dia                                                           | `git rev-parse main` + ledger                                                          |
| 4   | Estado dos P1…P9 do runbook (verde/aberto, com motivo)                                   | `docs/runbooks/dia-d-2026-09-12.md` §0 e §5                                            |

- **Bloco de assinatura (a preencher, sem edição de agente):**

```text
G-VER-v2 — destino híbrido aprovado: Vercel interino · hPanel canônico · pós-go-live conforme §2.
SHA de main conferido:  ______________________  (git rev-parse main)
Triagem P1..P9 conferida em: ______________________  (data UTC)
Nome (humano, legível): ______________________
Data (UTC): ______________________
Assinatura: ______________________
```

- **Aberto depois de assinar:** item 1 da homologação (Node ≥ 24.15) continua FAIL até o alvo
  receber a versão exigida; P2 (freeze) e P6 (11/11) seguem gate do dia-D.

---

## 2. H-5 — Assinatura do go-live (domínio + SSL + A5)

- **Instrumento:** este template (não existia). Habilita §1.4 (associar domínio), §1.5 (SSL) e
  §1.8 (carimbos) do runbook.
- **O que a assinatura autoriza:** apontar o host canônico decidido em D-0 (aditivo, DNS-only) e
  abrir a A5 0h/24h/72h. **Não** autoriza tocar NS/MX/SPF/DKIM/DMARC (§1.4 invariantes 1–2).
- **Insumos que o humano precisa trazer antes de assinar:**

| #   | Insumo                                                                     | Fonte que produz                                               |
| --- | -------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Data e hora UTC da janela (início)                                         | decisão humana; nenhum detector                                |
| 2   | Host canônico decidido em D-0 (apex e/ou `www`)                            | `docs/evidence/hpanel-preview-2026-09-09.md` §7 (D-0)          |
| 3   | Host de preview que fica como alvo de rollback (§2, R1)                    | `docs/evidence/G-VER-v2-memo-2026-09-12.md`                    |
| 4   | Trio < 24 h + snapshot nativo válido **no dia** (re-medidos, não herdados) | `npm run m02:readiness`; `npm run m02:snapshot -- --out-dir …` |
| 5   | Lista de residuais aceitos (ex.: `RESEND_*` ausente ⇒ §1.7 parcial)        | `docs/runbooks/dia-d-2026-09-12.md` §1.7, §5                   |
| 6   | P9 (exceção de PITR) assinada — sem ela a A5 0h deve abortar (§3)          | §3 deste arquivo                                               |

- **Bloco de assinatura (a preencher):**

```text
Dia-D — go-live autorizado: associação de domínio + SSL + abertura da A5 0h/24h/72h.
Janela (UTC, início): ______________________
SHA publicado (main): ______________________
Host canônico (D-0): ______________________   Alvo de rollback (preview): ______________________
Snapshot < 24 h conferido no dia: sim [ ] não [ ]    ID snapshot nativo: ______________________
Residuais aceitos nesta janela (listar): ______________________
Nome (humano, legível): ______________________
Data (UTC): ______________________
Assinatura: ______________________
```

- **Aberto depois de assinar:** R3 continua sendo o elo fraco (sem rollback por commit no hPanel —
  `docs/evidence/hpanel-docmap-2026-09-12.md:257,259`); o ensaio de R3 no preview é N/A por
  custódia (H-2/H-6) e permanece residual declarado.

---

## 3. P9 — Exceção formal de PITR (BAK-01b)

- **O que é:** exceção assinada pelo operador para operar com PITR **< 7 dias** (hoje 6 h —
  `docs/evidence/neon-prontidao-2026-09-13.md`), exigida pelo §16.6. **Exceção não é
  conformidade**: o requisito continua aberto como BAK-01b até H-4 (plano pago + 7 dias).
- **Efeito:** com P9 assinada, o carimbo `Tráfego: EXISTE` (§1.8 / N-10) pode ser emitido; sem
  P9 e sem BAK-01b fechada, a janela 0h deve **abortar**.
- **Insumos que o humano precisa trazer antes de assinar:**

| #   | Insumo                                                       | Fonte que produz                                     |
| --- | ------------------------------------------------------------ | ---------------------------------------------------- |
| 1   | Janela de PITR medida (segundos/dias)                        | `npm run m02:pitr-check` (somente leitura)           |
| 2   | Trio < 24 h + `m02:backup-verify` do drill em branch isolada | `npm run m02:snapshot` / `npm run m02:backup-verify` |
| 3   | Memo de PITR com endpoints oficiais e limite por plano       | `docs/evidence/neon-pitr-memo-2026-09-12.md`         |
| 4   | Prazo de validade da exceção e dono do acompanhamento        | decisão humana                                       |

- **Bloco de assinatura (a preencher):**

```text
P9 — exceção formal de PITR (BAK-01b), válida até: ______________________ (data UTC)
Janela medida em: ______________________  valor: ______ s (< 604800 s do SDD §16.6)
Compensação nesta janela: snapshot externo trio < 24 h [ ] + snapshot nativo [ ] + drill verificado [ ]
Reconheço que o requisito de 7 d permanece ABERTO (H-4) e que isto NÃO é conformidade.
Nome (humano, legível): ______________________
Data (UTC): ______________________
Assinatura: ______________________
```

- **Aberto depois de assinar:** H-4 (upgrade + janela de 7 d + re-medição) e o drill de PITR em
  projeto/branch descartável.

---

## 4. O que o agente NÃO fez (e por quê)

- Não assinou nada: as três assinaturas são ações humanas sem detector automático
  (`docs/evidence/F-CONS-consolidacao-2026-09-12.md` §4).
- Não preencheu data, nome, SHA ou ID de snapshot: seriam valores inventados.
- Não tocou o ledger: o carimbo pós-assinatura é do supervisor/operador.
