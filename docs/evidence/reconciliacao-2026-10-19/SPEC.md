# SPEC — reconciliação de ledger e de custódia (2026-10-19)

> **Natureza:** este `SPEC.md` foi publicado em **2026-10-21**, na sessão de selagem, e **descreve o
> pacote tal como ele já existia**. O `README.md` do pacote é o registro do resultado.
>
> **Selo:** `MANIFEST.sha256` + este `SPEC.md` publicados na sessão de selagem de 2026-10-21. O **S6
> adversarial de contexto limpo NÃO foi executado** — o `README.md` do pacote declara o pacote como
> "não selado" e nada de selo foi simulado.

## 1. Fato-fonte

- Pedido de reconciliação **após a Fase 2a** (pacote `docs/evidence/fase2a-2026-10-18/`).
- Journal `docs/evidence/agent-state/PROGRESS.md`: errata append-only **L959** (aliases `L936-MENU` /
  `L937-MENU`), veredito canônico **L957** e adendo **L958**.
- Registry `docs/evidence/agent-state/DEBTS.md`: **DBT-125** (orçamento de bundle).
- `README.md` §5–§17 (tabela de conflitos e o que permanece vermelho) — a fonte primária.

## 2. Problema (medido)

Quatro conflitos concretos de ledger e de custódia:

1. **IDs duplicados no journal:** `L936` 2× (▶/▶) e `L937` 2× (✔/✔) — MCP em 05:30/05:52Z e menu em
   05:50/06:05Z.
2. **Dois vereditos para o mesmo intent:** `L956` → `L957` ✔ e `L958` ✔.
3. **Custódia dividida entre árvores:** o pacote só existe na árvore `develop`; `b1dd8`/`093d6` estão no
   mesmo HEAD e vazias; `a9e17` é ancestral.
4. **`format:check` vermelho:** `src/styles.css` (WIP de redesign de outra sessão) falhava no Prettier.

## 3. Contrato (invariante falsificável)

> O journal é **append-only**: nenhuma linha é reescrita; a duplicidade de IDs é resolvida por **alias
> nomeado**, e não por apagar. Um intent tem **um** veredito canônico (L957) e os adendos ficam
> **identificados como tal** (L958). A custódia do pacote fica **num só lugar**, declarada. A correção de
> formatação é **mecânica**: o conteúdo sem espaços do arquivo é **byte-idêntico** antes e depois.

## 4. Mudanças

| item                               | decisão                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| IDs duplicados no journal          | errata append-only **L959**: MCP mantém `L936`/`L937`; menu recebe os aliases `L936-MENU`/`L937-MENU`; **nada reescrito** |
| dois vereditos para o mesmo intent | `L957` = fecho canônico; `L958` = adendo de verificação independente                                                      |
| custódia dividida entre árvores    | a custódia **permanece** na árvore `develop`; nada foi movido para branch local `cline/*`                                 |
| `format:check` vermelho            | formatação **mecânica** de `src/styles.css`; sha256 sem espaços **idêntico** antes/depois                                 |

## 5. DoD (critérios binários, com o artefato que os prova)

| critério                                                       | artefato                          |
| -------------------------------------------------------------- | --------------------------------- |
| bundle: WIP vs baseline limpo, delta e atribuição da rota nova | `captures/bundle-attribution.txt` |
| lockfile: saída bruta do guard (exit 1)                        | `captures/lockfile-guard.txt`     |
| formatação só de espaços (sha256 sem espaços antes = depois)   | `captures/format-proof.txt`       |

Números medidos em `captures/bundle-attribution.txt`: grafo inicial **500.608** contra orçamento
**500.000** (**+608**); baseline limpo em `HEAD` **484.235** (PASS); a rota nova contribui **126 bytes**
(chunk lazy fora do grafo) e removê-la ainda deixaria **500.482** (**+482**).

## 6. Testes (e o que ficou vermelho, nomeado)

- `captures/format-proof.txt`: `tr -d "[:space:]" < FILE | sha256sum` — **before** e **after** com o
  mesmo digest `34e44f084e3d66cc8311d727f475489cd65f65cc9977166c9a993c40b81c4bc0`, e
  `npm run format:check → exit 0`.
- `captures/lockfile-guard.txt`: saída bruta de `m02:lockfile-guard` com `status: "fail"` — o lockfile do
  worktree (`a245989…`) difere do HEAD (`4ad2e2b…`) porque `package.json`/`package-lock.json` carregam
  WIP de outra sessão. O remédio sugerido (`git checkout -- package.json package-lock.json`)
  descartaria esse WIP e **não foi aplicado**.
- `captures/bundle-attribution.txt`: `check:bundle` **FAIL** no WIP (500.608) e **PASS** no baseline
  limpo (484.235).

## 7. Riscos e limites declarados

- `m02:lockfile-guard` **continua vermelho (exit 1)** e `check:bundle` **continua vermelho (+608)** —
  ambos por WIP alheio, registrados como **DBT-125**.
- **Nenhum** limite de bundle foi elevado, **nenhum** teste removido ou afrouxado, **nenhuma** ADR criada.
- O **e2e não foi reexecutado** nesta reconciliação: o valor de **46 passed** é o medido pela Fase 2a e
  repetido por L958 — não é uma medição nova deste pacote.
- **S6 adversarial não executado.**
- Nenhum commit, push, migration, deploy ou alvo remoto.

## 8. Rollback

Nada a desfazer em Git: a reconciliação produziu uma **errata append-only** no journal (L959) e uma
formatação mecânica de um arquivo. Nenhuma migration, branch ou estado remoto foi criado.
