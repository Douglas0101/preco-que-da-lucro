# ADR-036 — Computer use autorizado para necessidades humanas em `sonarcloud.io`

- **ID:** ADR-036 · **Rastro:** Ciclo 23 / `DBT-36` · **Data:** 2026-10-01
- **Estado:** **ACEITO** — ratificado pelo MAESTRO no Ciclo 23, com a **Via A** fixada em texto.
- **Tipo:** governança / perímetro de operação
- **Precedente de forma:** `ADR-031-sidecar-cego-injecao-segredos.md`, `ADR-033-computer-user-observability.md`

---

## 1. Fato

Existem necessidades operacionais no `sonarcloud.io` que **só têm superfície humana**: revogar um
token antigo, conferir o estado de um toggle de administração, ler uma tela de configuração. Até aqui
a doutrina do repositório **proibia** o agente de tocar a UI:

- `docs/evidence/agent-state/PROGRESS.md:454` (entrada `L239`) — o incidente de exposição do H-6, que
  fixou que operação em painel de terceiro é ato humano;
- `docs/observability/COMPUTER-USER-OBSERVABILITY.md:160-162` — o limite declarado: **não há OCR**, um
  segredo **pintado em pixels** não é detectado pela redação;
- `docs/adr/ADR-033-computer-user-observability.md:96` — captura por browser **não** é closure test:
  exige sessão interativa e não é reproduzível no CI determinístico.

A proibição era correta para o que ela protegia. O que mudou é que a operação passou a ter uma via em
que **nenhum valor de credencial entra no fluxo do agente** — a Via A do §4 — e sem ela a `DBT-36`
permanece indefinidamente aberta por falta de superfície, não por falta de método.

---

## 2. Decisão

**Fica autorizado o uso de computer use pelo agente, restrito a `sonarcloud.io`, sob os seis
guardrails do §3, e exclusivamente para necessidades cuja superfície é humana.**

Fora desse domínio, a proibição anterior **continua valendo integralmente** — inclusive para o
`hPanel` da Hostinger, onde as operações seguem humanas (`docs/runbooks/rollback-v1.0.0-hostinger.md`).

---

## 3. Os seis guardrails (todos obrigatórios, nenhum opcional)

1. **Ambiente próprio** — a sessão de browser usada é a do agente, nunca a do operador em outro
   contexto; nada de compartilhar perfil com outras finalidades.
2. **Sessão delegada** — o humano **loga** e mantém a sessão; o agente **opera**. A senha **nunca**
   entra no fluxo do agente, em nenhuma hipótese, nem em caso de expiração de sessão (que escala, não
   improvisa).
3. **Blindagem de navegação** — proibido navegar a telas que **exibem valores** de credencial. Vale o
   limite medido do `COMPUTER-USER-OBSERVABILITY.md:160-162`: a redação **não** cobre pixel, então a
   única defesa é não chegar lá.
4. **Confirmação pré-clique** — toda ação **irreversível** é exibida ao MAESTRO **antes** de ser
   executada, com o que será clicado e o efeito esperado.
5. **Executa, não evidencia** — a screenshot **executa** a ação; o **veredito** vem de API/estado
   (`which-analysis`, par 200/401, lista de tokens). É a `ADR-033:96` aplicada: captura de browser não
   é closure test.
6. **Timeline auditável** — cada ação registra `{ts, url, ação, resultado}`, anexada ao fechamento.

---

## 4. Via A — ratificada pelo MAESTRO

> **O valor do token nasce e morre fora do fluxo do agente.**
> Geração do token e `gh secret set` são **humanas**. Validação (200) e revogação (401) são do
> **agente**.

**Consequência estrutural, e é ela que fecha o desenho:** a **revogação do token antigo vai para
computer use por construção**. Revogar via Web API exigiria autenticar com o token **novo** — o que
quebraria a Via A, porque um valor vivo entraria no fluxo. Via UI, com sessão delegada por cookie,
**nenhum valor entra**. O humano segura o valor nas duas pontas em que ele existe; o computer use faz
todo o resto.

---

## 5. O que este ADR supera — e o que ele NÃO supera

| documento                                    | relação                                                                                      |
| -------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `PROGRESS.md:454` (L239, incidente H-6)      | **superado no escopo** `sonarcloud.io`, sob os guardrails; **citado, não apagado**           |
| `COMPUTER-USER-OBSERVABILITY.md:160-162`     | **não superado** — o limite de pixels vira o guardrail 3                                     |
| `ADR-033:96` (screenshot ≠ closure test)     | **não superado** — vira o guardrail 5                                                        |
| `ADR-031` (sidecar cego)                     | **não superado e não tocado** — perímetro próprio; o `sonarcloud.io` entra na allowlist dele |
| `docs/runbooks/rollback-v1.0.0-hostinger.md` | **não superado** — hPanel segue humano                                                       |

---

## 6. ERRATA — citação do prompt que não resolve

O prompt do Ciclo 23 cita a proibição em **`hostinger-operations` L33-37**. Medido: **esse arquivo não
existe** (`docs/runbooks/` tem `hostinger-cloud-node.md` e `rollback-v1.0.0-hostinger.md`). As outras
três citações **conferem** e estão no §1 com os números verificados.

A correção não muda a decisão — muda o rastro. Registrar a citação inexistente como se ela existisse
seria a mesma classe de defeito que este ciclo vem eliminando: **prosa afirmando o que a medição não
sustenta**.

---

## 7. Consequências

- A `DBT-36` ganha superfície de fechamento: par `200`/`401` com a revogação feita na UI.
- O perímetro do computer use é **um domínio**, declarado, auditável e reversível (basta revogar este
  ADR — nada mais depende dele).
- Se a sessão delegada expirar no meio de uma ação irreversível, **escala** — não improvisa re-login,
  porque a senha não entra no fluxo em nenhuma hipótese.
- Enquanto a `DBT-36` não fechar, ela permanece `EM_TRATAMENTO` — sem custo e sem bloquear o ciclo.

---

## 8. Extensão humana para esta sessão — 2026-10-02

O pedido direto do MAESTRO, “@browser analise toda a infraestrutura detalhada para corrigir as
conexões, produção e estabilidade, logins abertos e utilize todo o contexto para as correções”,
autoriza nesta sessão a inspeção e as correções dos provedores vinculados ao projeto: GitHub,
Vercel, Neon e Hostinger, além do SonarCloud. Esta autorização é específica ao trabalho registrado
em `docs/evidence/infra-2026-10-02/README.md`; não se estende automaticamente a sessões futuras.

O pedido de usar os logins abertos autoriza a sessão Chrome delegada existente, identificada como
“🔎 Infraestrutura e estabilidade”, com abas somente dos provedores do projeto. Para esta sessão,
essa instrução humana supera o requisito anterior de perfil separado do guardrail 1. As demais
finalidades do perfil não são inspecionadas. Os guardrails 2–6 e a Via A permanecem: nenhuma senha,
token ou URL de conexão entra no fluxo; páginas que exibem valores são evitadas; exclusões
irreversíveis exigem a confirmação concreta; ações recebem timeline; o veredito vem do estado.

A extensão de browser não altera o contrato de release. O freeze de `main`, o limiar de cobertura
80%, a exigência de CI e a proibição de bypass continuam. Configurar publicação verde ainda exige
a sequência de promoção reconciliada do ADR-038; inspecionar o painel não ratifica essa proposta.
