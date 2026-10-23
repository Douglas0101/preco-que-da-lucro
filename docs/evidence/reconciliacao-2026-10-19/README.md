# Reconciliação de ledger e de custódia — 2026-10-19

Pacote de evidência **não selado** (sem `MANIFEST.sha256` e sem S6 adversarial; a cerimônia de selo não foi simulada). Ele registra a reconciliação pedida após a Fase 2a, com medições e capturas brutas.

## O que foi reconciliado

| conflito                           | medição                                                                                    | resolução                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| IDs duplicados no journal          | `L936` 2× (▶/▶) e `L937` 2× (✔/✔): MCP em 05:30/05:52Z e menu em 05:50/06:05Z              | errata append-only **L959**: MCP mantém `L936`/`L937` (a §1 já os cita); menu recebe os aliases `L936-MENU`/`L937-MENU`; nada foi reescrito |
| dois vereditos para o mesmo intent | `L956` → `L957` ✔ e `L958` ✔                                                               | `L957` é o fecho canônico; `L958` é adendo de verificação independente                                                                      |
| custódia dividida entre árvores    | pacote só na árvore `develop`; `b1dd8`/`093d6` no mesmo HEAD e vazias; `a9e17` é ancestral | custódia permanece na árvore `develop`; nada movido para branch local `cline/*`                                                             |
| `format:check` vermelho            | `src/styles.css` (WIP de redesign) falhava no Prettier                                     | formatação mecânica do arquivo; sha256 sem espaços idêntico antes/depois                                                                    |

## O que permanece vermelho (nomeado, não escondido)

- `m02:lockfile-guard` exit 1: o lockfile do worktree (`a245989…`) difere do HEAD (`4ad2e2b…`) porque `package.json`/`package-lock.json` carregam WIP de outra sessão. O remédio sugerido (`git checkout -- package.json package-lock.json`) descartaria esse WIP e **não** foi aplicado.
- `check:bundle` exit 1: grafo inicial **500.608** contra orçamento **500.000** (**+608**). Baseline limpo em `HEAD` mede **484.235** (PASS), então o excesso é do WIP. A rota nova contribui **126 bytes** (chunk lazy fora do grafo); removê-la ainda deixaria **482** acima. Registrado como **DBT-125**.

## Capturas

- `captures/bundle-attribution.txt` — WIP vs baseline limpo, delta e atribuição da rota.
- `captures/lockfile-guard.txt` — saída bruta do guard (exit 1).
- `captures/format-proof.txt` — prova de que a formatação foi só de espaços.

## Limites declarados

- Nenhum commit, push, migration, deploy ou alvo remoto.
- Nenhum limite de bundle foi elevado, nenhum teste removido ou afrouxado, nenhuma ADR criada.
- O e2e não foi reexecutado nesta reconciliação; o valor de 46 passed é o medido pela Fase 2a e repetido por L958.
