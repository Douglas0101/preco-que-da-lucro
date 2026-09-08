# Navegação manual local — 2026-08-29

Status do relatório: `PARTIAL / LOCAL-VERIFIED` (jornada parcial, atestada pelo
operador; rotas restantes não visitadas nesta rodada).

Registrada em `2026-08-29T12:45:36-03:00` pelo orquestrador a partir do relato
estruturado do operador humano. É a primeira jornada manual de navegação com
resultado positivo desde o bloqueio `OPEN-01` (`CONFIGURATION-MISSING/BLOCKED`,
IAB indisponível) de 2026-08-28 — executada pelo caminho humano paralelo
reservado pelo processo (runbook A1, lado app), sem depender do Browser in-app.
Nenhum gate consumido; nenhuma mutação de código, banco ou histórico.

## Pré-condições declaradas pelo operador

- Cache do navegador limpo.
- Servidor reiniciado para a sessão.
- Login com conta de **administrador interna**. Nenhuma credencial é
  reproduzida neste relatório (política: segredos fora de evidência).
- Horário exato da sessão não capturado (atestado do operador); ocorreu antes
  do momento de registro acima.

## Verificação de ambiente no momento do registro (máquina, pelo orquestrador)

```text
GET http://127.0.0.1:4173/             → 000 (connection refused)
GET http://127.0.0.1:4173/api/health/live  → 000
GET http://127.0.0.1:4173/api/health/ready → 000
GET http://127.0.0.1:3000/             → 000
GET http://127.0.0.1:5173/             → 000
```

Nenhum servidor de preview escutando nas portas usuais no momento do registro
(`ss -tln` mostra apenas serviços do sistema). Estado objetivo do registro;
não invalida a sessão atestada — indica apenas que o servidor não segue no ar.

## Jornada executada (USER-ATTESTED)

| Passo                                       | Resultado                    | Classe          |
| ------------------------------------------- | ---------------------------- | --------------- |
| Login com admin interno                     | Sessão estabelecida sem erro | `USER-ATTESTED` |
| `/inicio` (shell autenticado)               | Carregou sem erro funcional  | `USER-ATTESTED` |
| Console/rede durante a jornada              | Nenhum erro visível          | `USER-ATTESTED` |
| Despesa sentinela (criar + remover)         | Não executada                | `NOT-PERFORMED` |
| Diálogo de reset do chat (abrir + cancelar) | Não executado                | `NOT-PERFORMED` |
| Demais rotas da allowlist                   | Não visitadas nesta rodada   | `NOT-VISITED`   |

## Cobertura resultante por superfície

| Superfície          | Manual 2026-08-28 (IAB) | Manual 2026-08-29 (operador) | E2E automatizado (32/32, 2026-08-28) |
| ------------------- | ----------------------- | ---------------------------- | ------------------------------------ |
| `/` (landing)       | `BLOCKED`               | não visitada nesta rodada    | PASS                                 |
| `/auth` (login)     | `BLOCKED`               | **OK** (login efetivado)     | PASS (credencial inválida/controles) |
| `/inicio`           | `BLOCKED`               | **OK**                       | PASS (shell/falha financeira)        |
| `/produtos`         | `BLOCKED`               | `NOT-VISITED`                | sem assertão direta específica       |
| `/novo-produto`     | `BLOCKED`               | `NOT-VISITED`                | PASS (histórico/sessão)              |
| `/precos`           | `BLOCKED`               | `NOT-VISITED`                | sem assertão direta específica       |
| `/despesas`         | `BLOCKED`               | `NOT-VISITED`                | PASS (403 member)                    |
| `/ponto-equilibrio` | `BLOCKED`               | `NOT-VISITED`                | sem assertão direta específica       |
| `/simulacoes`       | `BLOCKED`               | `NOT-VISITED`                | PASS (simulação manual)              |
| `/diagnostico`      | `BLOCKED`               | `NOT-VISITED`                | PASS (premissas/erro financeiro)     |

## Delta contra o runbook A1 (correspondência de 2026-08-29)

| Passo A1                                             | Estado                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| 1. Servidor no ar (`db:up` + preview)                | Atendido na sessão (`USER-ATTESTED`); no registro, servidor parado |
| 2. Sondas de health 200/200                          | Não capturadas durante a sessão (jornada visual, sem sondas)       |
| 3. Rotas `/produtos`, `/precos`, `/ponto-equilibrio` | Pendente — não visitadas nesta rodada                              |
| 4. Despesa sentinela + reversão                      | Pendente — `NOT-PERFORMED`                                         |
| 5. Diálogo de reset cancelável                       | Pendente — `NOT-PERFORMED`                                         |

## Limites e não-promoções (RFC 8174)

- Esta jornada **NÃO** constitui veredito de produto: `product_verdict`
  permanece `NO-VERDICT` (cadeia `GENESIS-2026-08-28 → CHK-2026-08-29-0300`).
- **NÃO** promove M-02, gates, CI remoto, readiness Neon ou P8.
- Evidência `USER-ATTESTED` **NÃO** substitui a suíte automatizada; complementa
  (a jornada manual cobre superfícies sem assertão direta na suíte atual — as
  três rotas acima continuam pendentes de jornada).
- Nenhuma credencial, token ou cookie foi inspecionado, capturado ou registrado.

## Gatilho de retomada

Com o servidor novamente no ar: completar `/produtos`, `/precos`,
`/ponto-equilibrio` (prioridade — sem cobertura direta de suíte) e, se
autorizado, `/despesas` + sentinelas (despesa criar/remover, diálogo de reset
cancelável), capturando console/rede. Quando o IAB estiver disponível, a
jornada supervisionada completa pode substituir a manual.
