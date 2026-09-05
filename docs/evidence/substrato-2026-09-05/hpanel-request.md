# Pedido de acesso hPanel — bloqueio A4 metade 2

- **Data:** 2026-09-05 · **Bloqueador:** BLOCKER-EXT-01 · **Prazo solicitado:** 3 dias úteis
- **Registrado em:** `EXECUTION-STATE-PROGRAM.md` (entrada datada desta rodada)

## Pedido (texto pronto para envio)

> Preciso de acesso operacional ao hPanel (Hostinger Cloud Startup) para executar
> o deploy e o smoke do produto web que já está publicado em git (branch `main`,
> CI verde). O acesso necessário é:
>
> 1. **Deploy:** upload/git deploy do artefato Node (`node .output/server/index.mjs`),
>    comando de start customizado, versão de Node ≥ 24.15.0.
> 2. **Variáveis de ambiente:** criação/edição de variáveis secretas por
>    ambiente (`DATABASE_URL`, `DATABASE_DRIVER`, `BETTER_AUTH_URL`,
>    `BETTER_AUTH_SECRET`, `AUTH_TRUSTED_ORIGINS`, `RESEND_API_KEY`,
>    `AUTH_EMAIL_FROM`, `AI_GATEWAY_*`). Nunca registramos os valores;
>    precisamos apenas do direito de criar/validar presença.
> 3. **Logs e processo:** consulta a logs stdout/stderr, processo persistente
>    com reinício automático, restart manual.
> 4. **Rede/porta:** variável de porta injetada pela plataforma, host de bind,
>    timeout de proxy > 60 s.
> 5. **Acesso remoto ao DB (apenas leitura/administrativo):** confirmação de que
>    o plano não exige uso do PostgreSQL da Hostinger; o banco canônico é
>    PostgreSQL 17 externo (Neon) via `DATABASE_URL` pooled.
>
> Dependências do pedido: domínio já apontado; plano ativo. Sem esses acessos,
> o deploy (A4), a janela de vigilância (A5 24–72h) e os gates B3/B4 ficam
> parados — o caminho crítico do programa inteiro depende deste desbloqueio.
> Prazo: 3 dias úteis a partir do acesso, com execução assistida em sessão
> compartilhada, se preferencial.

## Dependências

- Plano Hostinger ativo (em contratação desde 2026-08-24 — estado informado).
- Domínio/DNS confirmados (item UNVERIFIED do checklist hPanel).

## Registro no ledger

| ID             | Bloqueio                        | Fase afetada       | Ação de desbloqueio     |
| -------------- | ------------------------------- | ------------------ | ----------------------- |
| BLOCKER-EXT-01 | Acesso hPanel (deploy/env/logs) | A4/A5/B3/B4/Fase C | Pedido acima + prazo 3d |

## O que muda no pedido com o smoke ensaiado (resposta ao critério 4)

O smoke de substrato (`npm run smoke:substrate`) já prova o lado do banco
read-only; o pedido hPanel pode então focar exclusivamente na camada de
aplicação (itens 1–4) e não precisa incluir acesso ao banco da Hostinger —
exceto a confirmação negativa do item 5. Se o smoke falhar na janela, o item 5
sobe para acesso administrativo completo.
