# Onda 1 — execução local (2026-10-20)

Pacote de evidência da execução da **Onda 1** do `PLANEJAMENTO.md` e das dívidas locais
DBT-125/DBT-126, autorizada pelo dono em 2026-10-20. **Nada remoto foi tocado** — sem
Hostinger/hpanel, Vercel, Neon remoto, deploy, push ou migration.

## Escopo executado

| Item                                       | Resultado                                                                                                                               | Evidência                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **DBT-125** — bundle acima do orçamento    | **FECHADA**: grafo inicial **451.284 B** (orçamento 500.000; entry 219.682; gzip 149.045)                                               | `captures/build-onda1-after.txt`                                            |
| **DBT-126** — flake de contraste no WebKit | **FECHADA**: 10/10 sob 2 workers + suíte completa 4 projetos 92/92                                                                      | `captures/dbt126-webkit-10x.txt`                                            |
| **UI-01** — anti-barrel                    | Regra `no-restricted-imports` para `@/components/ui`/`index`; zero barrels no código                                                    | `captures/ui01-deep-imports.txt`                                            |
| **UI-03** — OKLCH + dark sem JS            | Tokens OKLCH no `:root`; dark aplicado por classe, sem runtime; axe 0 bloqueantes em light e dark                                       | `captures/ui03-dark-mode-axe.txt`, `screenshots/ui03-*-{light,dark}.png`    |
| **UI-05** — `keepMounted` no Avatar        | **N/A medido**: não existe primitivo Avatar nem imagem de avatar no header                                                              | `captures/ui05-avatar-stability.txt`                                        |
| **UI-06** — pureza de render               | Zero `Math.random` em `components`/`routes`; `Date.now()` restante só em handlers de erro; `age_days` de `/precos` derivado no servidor | `captures/ui06-purity-audit.txt`                                            |
| **DT-04** — constantes `Decimal`           | `DECIMAL_ZERO`/`DECIMAL_ONE` congeladas e usadas nos laços; zero literais em produção                                                   | `captures/dt04-decimal-reuse.txt`, `captures/dt04-decimal-reuse-bench.json` |
| **OB-02/OB-03** — OTel lazy + batch        | Sem endpoint o SDK não inicia (0,15 ms); lote 10 s/512/5 s validado por teste                                                           | `captures/ob02-ob03-otel.txt`                                               |

## Decisões medidas

- **`cn` venceu `clsx` + `tailwind-merge` no grafo inicial.** A troca para `clsx`+`tailwind-merge`
  foi medida em build real: o chunk do botão subiu de **38.710** para **39.786 B**. O `cn@0.4.0`
  foi restaurado e os dois pacotes antigos saíram das dependências diretas.
- **O ganho grande veio de mover o `<Toaster>` do root para os layouts que realmente usam toast**
  (`/auth` e `_authenticated`). O `sonner` saiu do entry inicial: **265.408 → 219.682 B** no entry
  e **500.608 → 451.284 B** no grafo. A landing não usa toast.
- **`age_days` é derivado uma vez no servidor** e viaja no payload de `listPurchasePrices`; o
  render de `/precos` deixou de chamar `Date.now()`. O golden de read models foi congelado no tempo
  (`vi.setSystemTime`) para o campo não virar falha de calendário.

## O que NÃO foi feito (delta nomeado do Gate 1)

- A meta de **−15%** de bundle do Gate 1 **não foi atingida**: o ganho medido foi **−6,8%** contra
  o baseline limpo (`484.235 → 451.284 B`). O restante depende de **UI-02** (lazy de componentes
  > 50 KB por rota) e **UI-04** (interaction splitting), da Onda 2.
- **DT-02** (decimal.js-light) não foi executado: exige paridade bit-a-bit sob PBT e é uma troca
  de risco alto para o motor financeiro.
- Web Vitals de produção e cold start não foram medidos (sem deploy).
- A Onda 1 foi executada sobre o WIP de redesign que já estava na árvore; o WIP foi commitado em
  checkpoints temáticos, sem descartar nada.

## Limites de custódia

- Evidências brutas de browser desta pasta são capturas de bancada local; não são prova de
  produção. Nenhum token/credencial foi persistido.
- O `MANIFEST.sha256` cobre os artefatos desta pasta.
