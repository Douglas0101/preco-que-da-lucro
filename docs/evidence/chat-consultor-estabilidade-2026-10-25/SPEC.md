# SPEC — Chat consultor (Simon): revisão de estabilidade PC/Mobile (2026-10-25)

Pacote de evidência da revisão técnica de estabilidade do chat consultor (rota `/novo-produto`,
painel flutuante global e primitivas de chat), com foco em desktop e mobile e no contrato do
`AGENTS.md`. **Não é um work package de produto com lane S6 dedicada**: é a revisão do Lead sobre
trabalho de sessão ainda não commitado, com correções e medições falsificáveis.

## Fato-fonte

- Pedido direto do dono nesta sessão (2026-10-25): “faça uma profunda revisão técnica para
  estabilidade real do sistema quando PC/Mobile conforme @AGENTS.md”.
- Trabalho revisado: chat redesenhado no padrão AI Elements, launcher flutuante global
  (`src/components/consultor-chat-dock.tsx`), rota `/novo-produto` como workspace e remoção de
  “Precificação” do menu (`src/components/app-shell.tsx`) — tudo no worktree `develop`, sem commit
  nesta revisão.
- Norma de referência: `AGENTS.md` (gate local `npm run check`, matriz Playwright por engine,
  axe, orçamento de bundle, ADR-042 cobertura mínima de 60% em código novo, evidência em
  `docs/evidence/`, `MANIFEST.sha256`).

## Problema (medido antes da correção)

1. **IDs duplicados no composer**: `src/components/consultor-chat.tsx` usava
   `id="novo-produto-mensagem"` nas variantes `page` e `panel`; dois mounts gerariam `id` repetido
   no DOM (rótulo `htmlFor` e `aria-describedby` ambíguos).
2. **Sem `safe-area` no mobile**: launcher e composer do painel encostavam na borda inferior, sob o
   home indicator do iOS (`consultor-chat-dock.tsx`, formulário do painel).
3. **Launcher sobre conteúdo**: botão fixo no canto inferior direito cobria o último CTA/linha de
   páginas roláveis no mobile (`app-shell` só tinha padding `py-6`).
4. **Falha de chunk sem fronteira**: o chat é `React.lazy`; rejeição de import (rede instável)
   estourava o render sem fallback recuperável.
5. **Teste E2E frágil**: asserção na saudação do herói, que só existe sem histórico — o fixture E2E
   restaura conversa; o helper de settle de animações era ilimitado e travou 30 s no chromium sob
   a matriz paralela.
6. **Defeito mobile pré-existente em `/produtos`** (achado pela matriz, não introduzido pelo chat):
   em 390 px o bloco `min-w-0 flex-1` colapsa a 0 px porque as ações ficam na mesma linha; o span
   `font-bold truncate` fica com largura 0 e o Playwright o reporta `hidden`.
7. **Condição de bancada**: `npx vitest run --coverage` deixa `coverage/` na raiz; o
   `m02:secrets-audit` enumera os HTMLs como “evidence-auditor-or-test-not-consumer” e sai
   `2/INCOMPLETE`, derrubando o `npm run check` (CI roda em job limpo, o defeito é local).

## Contrato (invariantes falsificáveis após a correção)

- Página e painel **nunca** compartilham `id` de controle: página usa `novo-produto-mensagem`,
  painel usa `simon-mensagem`; ambos com `aria-describedby` próprio.
- Diálogo do painel: `axe` sem violações `critical`/`serious`; `Esc` fecha e devolve foco ao
  launcher; `AlertDialog` aninhado de reset não desmonta o painel.
- Falha de chunk mostra `role="alert"` + botão “Tentar novamente”, sem derrubar o shell.
- Em 390 px: título do produto em `/produtos` tem largura > 0; espaço reservado impede o launcher de
  cobrir o último CTA; painel ocupa a largura da viewport; composer respeita `safe-area`.
- `/novo-produto` continua acessível por URL, com título “Precificação · Preço que Dá Lucro”, e o
  launcher some nela; o menu de navegação não contém “Precificação”.
- Gate: `npm run check` exit `0`; matriz Playwright nos quatro projetos exit `0`; cada arquivo novo
  com cobertura de linhas ≥ 60% (ADR-042, proxy local).

## Mudanças

Correções desta revisão (arquivos fechados):

- `src/components/consultor-chat.tsx`: ids por variante (`simon-mensagem` / `novo-produto-mensagem`),
  `pb` com `env(safe-area-inset-bottom)` no painel.
- `src/components/consultor-chat-dock.tsx`: `bottom` com safe-area; `CatchBoundary` + componente de
  falha recuperável ao redor do `Suspense` do chunk.
- `src/components/app-shell.tsx`: padding inferior condicional (`pb-24 md:pb-20`; mantém o
  workspace do chat em `pb-6 md:pb-10`) para reservar a faixa do launcher.
- `src/routes/_authenticated/produtos.tsx`: ações do card com `max-sm:w-full max-sm:justify-end`
  (título deixa de colapsar em 390 px).
- `src/test/novo-produto-chat.test.tsx` (+4 testes: clipboard, falha de envio, loading, “Ver
  produto”, metadados, id do composer), `src/test/consultor-chat-dock.test.tsx` (+ axe no diálogo,
  reset aninhado, “Ver produto”, id do painel), novo
  `src/test/consultor-chat-dock-failure.test.tsx` (fronteira de chunk).
- `e2e/ui-stack.spec.ts`: teste do painel passou a usar o histórico do fixture; axe do diálogo;
  título da rota; settle de animações com teto de 2 s.
- `docs/evidence/chat-consultor-estabilidade-2026-10-25/`: este pacote (SPEC, README, captures,
  MANIFEST).

Não muda: contratos BFF/CSP/banco, URL `/novo-produto`, endpoints, migrations, dependências,
catálogo de componentes (`check:ui-stack`) e nenhuma ADR.

## DoD

1. `npm run check` exit `0` com suíte completa, build e `check:bundle` — capture 02.
2. `npx vitest run <testes de chat> --coverage` com cada arquivo novo ≥ 60% de linhas — capture 03.
3. `playwright test` (chromium, firefox, webkit, mobile) exit `0` — capture 07.
4. Teste do painel verde nos quatro projetos (histórico restaurado, `Esc`, foco, launcher oculto na
   rota) — capture 06/07.
5. `/produtos` mobile com título visível (largura > 0) — capture 05 + medição.
6. `m02:work-package-guard` verde sobre este diretório e `MANIFEST.sha256` verificado por
   recomputação (`checked === discovered = 15`). O `m02-seal --write` fica **bloqueado pela
   precondição de worktree derivado** (capture 14) e deve ser reexecutado após o commit da sessão.
7. Condição de bancada do `coverage/` declarada e removida antes do gate — capture 04.

## Testes (RED/GREEN e falsificação)

- `simon-mensagem` / `novo-produto-mensagem`: as asserções falham se os ids voltarem a ser iguais.
- Reset aninhado: falha se o `AlertDialog` fechar o `Sheet` ou se o foco sair do diálogo.
- Falha de chunk: sem `CatchBoundary` o teste recebe erro de render em vez de `role="alert"`.
- E2E do painel: falha se o launcher duplicar na rota, se o menu voltar a listar “Precificação” ou se
  o histórico do fixture não carregar.
- `/produtos` mobile: a medição de largura do título é 0 px antes da correção e 116 px depois
  (390 × 844, Chromium).
- Condição de bancada: `coverage/` presente ⇒ `m02:secrets-audit` INCOMPLETE/exit 2; ausente ⇒
  COMPLETE_WITH_LIMITS/exit 0.
- Limite declarado: não houve lane S6 adversarial independente; os pares RED/GREEN acima são a
  falsificação disponível.

## Riscos e limites declarados

- **Teclado em aparelho real** (iOS/Android) não é testado: emulação não abre teclado virtual; o
  painel usa `h-full` + `safe-area` via CSS, mas `visualViewport` do iOS pode cobrir o composer.
- **`env(safe-area-inset-*)`** é emulado por CSS; hardware com notch não foi exercitado.
- **Foco automático** no composer ao abrir o painel pode abrir o teclado no mobile (comportamento
  aceito para chat; declarado).
- **ADR não criada**: a superfície global do consultor pode exigir ratificação futura; os contratos
  arquiteturais vigentes (BFF/CSP/DB/RLS) não mudaram. Fica como decisão pendente, não presumida.
- **Matriz local** rodou em uma única máquina (host), não no runner do CI; o CI continua autoridade.
- **Cobertura**: medição local direcionada é proxy do `new_coverage` do Sonar; o veredito real é do
  CI/CE (ADR-042).
- **WIP alheio**: o worktree tem alterações de outras sessões; os gates rodaram sobre o worktree
  inteiro e o verde as inclui, sem que tenham sido revisadas aqui.
- **Fixture**: o teste do painel depende da mensagem “Mensagem restaurada do histórico E2E.” criada
  por `scripts/e2e/seed-auth.ts`; mudança no seed exige atualizar o teste.
- **Selo de work package pendente:** `m02-seal --write` exige worktree limpo fora do pacote; com o
  WIP herdado e esta sessão não commitada, ele sai `2` (capture 14). O MANIFEST manual está
  verificado, mas a selagem oficial só roda depois do commit.

## Rollback

- Reverter apenas os arquivos desta revisão (lista em “Mudanças”); não há migration, alteração de
  schema, deploy ou mudança de URL.
- O pacote de evidência é removível (`docs/evidence/chat-consultor-estabilidade-2026-10-25/`).
- O chat continua disponível pela rota `/novo-produto` mesmo se o launcher for revertido.
