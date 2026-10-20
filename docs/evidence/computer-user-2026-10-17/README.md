# Sessão computer-user local — testes e observabilidade (2026-10-17)

**Escopo/autorização do dono:** "no modo computer user abra no sistema localmente para
testes e observabilidade". Sem push, commit, deploy, merge, alias ou toque em
`main`/produção. WIP alheio preservado.

## Bancada montada

- PG Docker local (`:5432`, `docker-compose.yml`) já de pé; `npm run e2e:prepare` semeou a
  fixture E2E (owner `teste@example.test` + member `teste+member@example.test`; o seeder
  limpa apenas o tenant/UUIDs E2E).
- `npm run build` + `npm run preview -- --host 0.0.0.0 --port 4173` (o bind amplo permite o
  browser MCP, que roda em container, alcançar a bancada via `host.docker.internal`).
- O preview roda no **ramo controlado de IA** (chave do provedor inválida em runtime),
  espelhando o CI, onde não há provedor. O ramo live já havia sido observado na primeira
  rodada da suíte visual (respostas reais do modelo no chat, sem regressão de honestidade).
- Browser MCP (`mcp/playwright`, container): interceptação de rota
  `http://127.0.0.1:4173/**` → `http://host.docker.internal:4173` com **override de `Host`**
  preservado como `127.0.0.1:4173`. Sem o override, o CSRF do TanStack Start (compara
  `Origin` × host da requisição) devolvia `403 Forbidden` em todo `_serverFn` — mecanismo
  confirmado por sonda no host (`Origin` ok + `Host` trocado ⇒ 403; `Host` correto ⇒ 405 da
  própria função). Com o override: sonda 405, passe limpo com 0 respostas ≥400.

## Testes executados

| Suíte                                | Projetos           | Resultado                        |
| ------------------------------------ | ------------------ | -------------------------------- |
| `e2e/ui-stack.spec.ts` (completo)    | chromium+mobile    | **22/22 PASS**                   |
| `e2e/visual` (`npm run test:visual`) | chromium+mobile    | **10/10 PASS**                   |
| Sessão MCP (walk + drawer + chat)    | 1440×900 e 390×844 | 15+ verificações, achados abaixo |

Primeira rodada do spec completo (antes das correções): 16/22, com 6 falhas em 3 testes × 2
projetos — todas de **contraste axe** exceto uma de ambiente. Causas medidas e desfechos:

1. `/inicio`, botões de período inativos: `text-muted-foreground` `#71717b` sobre
   `bg-muted` `#f4f4f5` = **4.39:1** (< 4.5 AA). Correção: token `--muted-foreground`
   `oklch(0.552 → 0.536)` = **4.72:1** medido (canvas sRGB, script local).
2. `/inicio`, badge "DADOS INCOMPLETOS": `text-amber-300` sobre branco = **1.44:1**.
   Correção: `text-amber-700 dark:text-amber-400` (padrão do repo).
3. Drawer mobile, subtítulo "seu consultor financeiro": token claro sobre superfície escura
   do drawer = **3.41:1**. Correção: `text-sidebar-foreground/60` (escala do sidebar).
4. `BUG-CHAT` (texto do ramo controlado) falhava com provedor **live** (o modelo responde e
   a redação esperada não aparece) — **acoplamento ambiente do teste, não defeito de
   produto**: no rig controlado passa (4/4 rodadas chromium+mobile no total).

## Sessão computer-user (MCP)

- Login pela UI em `127.0.0.1:4173`; walk das 8 seções do menu superior com **pill ativa
  correta em todas** (item → rota → `aria-current`), 9 itens no nav (snapshot a11y em
  `playwright-mcp/cu-09-*.yml`).
- Mobile: drawer abre com a mesma lista, `Escape` fecha, nav horizontal ausente (< lg).
- Chat (`/novo-produto`), ramo controlado: mensagem → **"⚠️ Um serviço necessário está
  indisponível."** (desfecho honesto, sem figura fabricada; `Forbidden` bruto não aparece
  após o fix do rig). Estado do formulário: Enviar habilitado com texto, desabilitado vazio
  (sem estado travado).
- Passe limpo pós-fix (`/inicio`, `/produtos`, `/simulacoes`, `/diagnostico`, `/inicio`):
  **0 erros de console, 0 respostas ≥400** (`cu-08-*.json`).
- Durante a fase pré-fix, o dashboard exibiu o estado honesto de falha de dados
  ("Não foi possível carregar o resumo financeiro" + referência `DASH-49580D17`) em vez de
  números — comportamento correto do contrato, causado pelo rig, e registrado aqui.

## Achados fora do gate (DBT-123)

- `/produtos`: `text-success` `#2ec97a` sobre branco = **2.15:1** e badge âmbar-600
  `#e17100` sobre branco = **3.19:1** — nenhum teste axe cobre `/produtos` hoje.
- `/novo-produto`: log do chat é região rolável **sem foco** (`scrollable-region-focusable`).
- Detalhe com alvos e proporções em `captures/axe-fora-do-gate.txt`.

## Limites declarados

- O log de console do MCP (`cu-06`) é **cumulativo da sessão do servidor** (desde 05:35Z):
  contém os 403 pré-fix e ruído do dev `:8080` de antes desta sessão; a medição isolada
  pós-fix é o `cu-08`.
- Um `POST /api/vitals [500]` foi observado **uma vez** no log do preview em fase pré-fix do
  rig e não reapareceu no passe limpo; sem reprodução, fica como observação (não presumido).
- Redação: varredura dos captures por padrões de segredo/PII — sem achado (só o texto do
  próprio assistente cita "senha/token"). PNG sem OCR é o mesmo limite declarado do gate
  visual (ADR-033).
- O preview segue **de pé** em `http://127.0.0.1:4173` (login de fixture `teste@example.test`)
  para inspeção manual; encerra com a sessão do agente.

## Artefatos

- `playwright-mcp/cu-01..cu-10` — screenshots (desktop menu, mobile drawer, chat), snapshots
  a11y (drawer, menu, página do chat), console, passe limpo e walk de seções.
- `captures/axe-fora-do-gate.txt` — achados ungated.
- `MANIFEST.sha256` — integridade dos artefatos deste pacote.
