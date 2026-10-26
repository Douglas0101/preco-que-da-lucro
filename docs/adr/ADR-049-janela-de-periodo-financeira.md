# ADR-049 — Janela de período financeira: fuso de negócio e intervalo semiaberto

- Status: **ACEITA** — ratificação registrada em 2026-10-26 sob instrução do dono do produto, com base nas
  medições de F1 (RED), F2 (GREEN) e F3 (UI & E2E) do WP `dashboard-periodo-2026-10-26`. A ratificação está
  declarada no `PROGRESS.md` e o pacote de prova em `docs/evidence/dashboard-periodo-2026-10-26/`.
- Data: 2026-10-26.
- Escopo: projeção de leitura do dashboard (`/inicio`) e as duas agregações de vendas por período. Não há
  migração, coluna nova nem mudança de contrato de banco.
- Evidência: `docs/evidence/dashboard-periodo-2026-10-26/` (`SPEC.md`, `captures/f1-*`, `f2-*`, `f3-*`).

## Contexto

O seletor **Mês / Trimestre / Ano** de `/inicio` apresentava três problemas medidos, não hipotéticos:

1. **Janela sem limite superior (P1).** `salesRepository.summaryForPeriod` e `itemSummaryForPeriod` filtravam
   apenas `occurredAt >= from`. Medido no PG17 local: uma venda datada em `2027-01-15` **satisfaz** o
   predicado de outubro (`true`), e o RED de banco mostrou a venda do mês seguinte contada dentro do mês
   corrente (`{revenue:'20.0000', count:1}`) e a do ano seguinte contada nos três períodos (`'40.0000'`).
2. **Fronteira no fuso do processo (P2).** `periodStart` usava `setHours/setDate/setMonth` locais. Em
   produção (runner UTC) o início de outubro vira `2026-10-01T00:00Z`, que é `2026-09-30 21:00` em São Paulo:
   vendas do fim do dia 30/09 entravam em outubro. Sob `TZ=America/Sao_Paulo` o mesmo código **passa** — o
   defeito é invisível na bancada, e foi por isso que o RED foi capturado sob `TZ=UTC`.
3. **Período não exibido e períodos misturados (P3/P4).** O SDD §2.4 exige "o período financeiro padrão é
   mensal, **sempre exibido**", e o §11.7 determina que análise com período diferente de mês deve somar
   competências mensais ou usar política versionada. A tela dizia apenas "no período selecionado" e mostrava
   **despesa fixa mensal** ao lado de faturamento **trimestral**, sem rótulo de unidade.

No mesmo WP foram corrigidos dois efeitos de apresentação: a troca de período desmontava a página inteira
(inclusive o seletor, causando a perda de foco da DBT-165) e o estado `empty` era rotulado "DADOS
INCOMPLETOS", contra a distinção de três estados do ADR-041 §3.

## Decisão

1. **Intervalo semiaberto `[from, to)`**, com `to` = início do período seguinte. `to` é exclusivo; o último
   dia exibido ao usuário é `to − 1 ms`. Isso impede dupla contagem na virada e torna impossível que uma
   venda futura entre na janela corrente.
2. **Fuso do negócio explícito**: `BUSINESS_TIME_ZONE = "America/Sao_Paulo"`, resolvido por
   `Intl.DateTimeFormat` com `timeZone: BUSINESS_TIME_ZONE` e offset calculado em **duas passadas** (o offset
   depende do instante e o instante depende do offset). Nenhuma dependência nova.
3. **`window` atestado pelo servidor**: o payload do dashboard carrega `window: { from, to }` em ISO-8601, e o
   cliente **nunca** calcula a janela — ele só formata o que recebeu. O rótulo e o número não podem divergir.
4. **Um único par de fronteiras por leitura**, usado nas duas agregações (`summaryForPeriod` e
   `itemSummaryForPeriod`), como já exigia o ADR-041 §2.
5. **Apresentação separada por natureza do dado**: métricas cadastrais/unitárias (produtos, despesas fixas por
   mês, maior margem unitária) ficam no grupo invariante; faturamento e margem consolidada, no grupo do
   realizado, junto do seletor e do rótulo da janela.

## Alternativas rejeitadas

| Alternativa                                                       | Por que não                                                                                                                                                                                    |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lte(occurredAt, fim)` com `fim = 23:59:59.999`                   | Frágil a microssegundos: o banco guarda precisão maior que milissegundos, e um `occurred_at` em `23:59:59.9995` ficaria fora da janela por um arredondamento. O semiaberto não tem essa borda. |
| Manter `setHours/setDate/setMonth` e "garantir" o servidor em BRT | A fronteira passaria a depender de configuração de host, não de contrato. O RED sob `TZ=UTC` já mostra o desvio; a garantia seria uma promessa operacional sem teste.                          |
| Biblioteca de datas (`date-fns-tz`, `luxon`, `moment`)            | Viola a restrição de não adicionar dependência para uma operação que `Intl` resolve; `Intl` já é o caminho usado na formatação do app.                                                         |
| Calcular a janela no cliente                                      | O relógio e o fuso do browser não são os do servidor; o rótulo poderia descrever uma janela diferente da consulta.                                                                             |
| Multiplicar despesas fixas por 3/12 no trimestre/ano              | Presumiria meses futuros não realizados de um período em curso. A escolha foi rotular a unidade ("por mês") e manter o card invariante.                                                        |

## Consequências

- **`periodStart` não foi removido.** A premissa do prompt de execução ("único consumidor era o teste") não se
  confirmou: `periodStart`/`periodEnd` continuam como atalhos finos sobre `periodWindow`, exportados por
  `src/lib/period-window.ts`. O que saiu foi o **re-export local** em `dashboard.service.ts`; o teste passou a
  importar do módulo puro. Um único consumidor real (o serviço) usa `periodWindow` diretamente.
- **`window` é aditivo e não quebra consumidores**, mas o **shape guard ainda não o exige** nem compara
  `payload.period` com o período pedido: um payload sem `window` derruba o render (medido no teste de
  componente). A lacuna foi **fechada** em 2026-10-26 — ver **DBT-176** (FECHADA): o guard exige
  `window` (datas ISO com `from < to`) e compara `payload.period` com o período pedido.
- **Sem migração**: nenhuma coluna, índice ou constraint muda; `transactionSites`/`directDatabaseFiles` não se
  movem por esta decisão.
- **Fixture determinística**: os testes de banco ganharam quatro tenants de fronteira com instantes calculados
  por oráculo independente (offset literal `-03:00`), não por `now()` arbitrário.
- **Regime de horário de verão**: o Brasil não observa DST desde 2019. Se reintroduzir, `Intl` segue o tzdata do
  runtime (comportamento correto) e o oráculo do teste, que usa `-03:00` literal, **falha alto** — o que é o
  comportamento desejado para uma mudança de regime.

## Prova

| Requisito                                                                           | Teste            | Onde                                                |
| ----------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------- |
| Mês/trimestre/ano com fronteira em BRT (`03:00Z`)                                   | T1–T3            | `src/test/period-window.test.ts`                    |
| Colapso de janeiro é intencional (mês = trimestre = ano)                            | T4               | idem                                                |
| Relógio vem do argumento, nunca da parede                                           | T5               | idem                                                |
| Offset travado em fevereiro                                                         | T6               | idem                                                |
| Fonte sem mutadores de relógio local, com controle negativo do regex                | T7a–T7c          | idem                                                |
| Dezembro vira o ano                                                                 | T8               | idem                                                |
| Trimestre = 3 meses (defeito medido em F2)                                          | T9               | idem                                                |
| Ano = 12 meses                                                                      | T10              | idem                                                |
| Venda do mês seguinte fora do mês; futura fora dos três; ano anterior fora dos três | D1–D5            | `src/test/dashboard-consolidated-margin.db.test.ts` |
| `window` do payload igual ao oráculo BRT                                            | D (venda futura) | idem                                                |
| Exclusão por período ponta a ponta pelo formulário                                  | E1               | `e2e/sales-dashboard.spec.ts`                       |
| Janela exibida por período + selo de coincidência                                   | E2               | idem                                                |
| Foco preservado na troca (DBT-165)                                                  | E3               | idem                                                |
| `empty` ≠ `incomplete`                                                              | E4               | idem                                                |
| Integridade da janela durante o placeholder (`aria-busy`)                           | E5               | idem                                                |
| Controle negativo da matemática (`to` em 1 mês)                                     | mutação T9/T10   | `captures/f2-mutation-to-rejects.txt`               |
| Controle negativo do foco/placeholder (sem `keepPreviousData`)                      | mutação E3/E5    | `captures/f3-negative-control-*.txt`                |

Medições: unitário **12/12** sob `TZ=UTC`, `Asia/Tokyo` e `America/Sao_Paulo`; banco **8/8**; e2e focado
**7/7** em chromium; matriz completa **133 passed / 3 skipped / 0 failed** com E3/E5 verdes em chromium,
firefox, webkit e mobile; suíte unitária **2470/2470**.

## Limites declarados

- **Caminho de erro**: uma leitura que falha ainda substitui o painel pelo card de erro, e nesse caminho o
  seletor desmonta. O contrato de foco vale no caminho normal.
- **Selo de coincidência**: `Coincidente com o mês atual` é um predicado de **calendário** no cliente (mesmo
  fuso do servidor) sobre a janela atestada — não é um cálculo de janela.
- **`incomplete` no dashboard** não é simulado no e2e (exigiria produto sem custo + venda); está provado no
  banco (`state: incomplete`) e no visual de produto. O e2e assere o negativo: vazio nunca mostra "DADOS
  INCOMPLETOS".
- **Escopo de leitura**: a decisão vale para as duas agregações do dashboard. `salesService.list` mantém
  `from/to` opcionais (lista operacional, não KPI) e não foi reescopada por esta ADR.

## Referências

- ADR-041 — margem consolidada sobre vendas registradas (três estados; par de fronteiras único).
- ADR-018 — Decimal, unidades e arredondamento. ADR-032 — Decimal string no wire.
- `SDD.md` §2.4 (período sempre exibido) e §11.7 (análise com período ≠ mês).
- DBT-165 (foco na troca de período — fechada), DBT-176 (guard sem `window`/`period` — **fechada em
  2026-10-26** após o achado P2 do review do PR #72, com controle negativo).
- `docs/evidence/dashboard-periodo-2026-10-26/` — SPEC, README e capturas.
