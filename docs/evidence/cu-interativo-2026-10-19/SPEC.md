# SPEC — sessão interativa de computer user (2026-10-19)

> **Natureza:** este `SPEC.md` foi publicado em **2026-10-21**, na sessão de selagem, e **descreve o
> pacote tal como ele já existia**. O `README.md` do pacote é o registro do resultado.
>
> **Selo:** `MANIFEST.sha256` + este `SPEC.md` publicados na sessão de selagem de 2026-10-21. O **S6
> adversarial de contexto limpo NÃO foi executado** — o `README.md` do pacote declara o pacote como
> "não selado" e nada de selo foi simulado.

## 1. Fato-fonte

- Pedido do dono, em sessão: _"abra o navegador e comece a testar o sistema"_ — ledo pelo **MCP
  Playwright** contra a bancada local `:4173`.
- Journal `docs/evidence/agent-state/PROGRESS.md` **L964** e o registry `docs/evidence/agent-state/DEBTS.md`
  (**DBT-126**, higiene/alta) — a errata do achado de contraste está registrada nos dois.
- `README.md` §25–§27: a sessão **derrubou** a conclusão anterior do DBT-126.

## 2. Problema (medido)

O DBT-126 registrava que o WebKit reprovava `expectNoBlockingAxeViolations` com contraste **2,79–3,8:1**
em `/simulacoes`. A sessão mediu que esse número **não** era o contraste do estado assentado: o axe
amostrou o texto **durante a animação `enter`** do alerta, e o valor medido recompõe exatamente o token
real composto com branco a **α = 0,850 / 0,701**. Com o alerta assentado, **6 medições no WebKit = 0
violação** e o probe de 3 engines deu **0/0/0** ⇒ o defeito real é **assertion flaky**, não contraste.

## 3. Contrato (invariante falsificável)

> O contraste do texto `muted` é medido por **canvas** (não por regex — a cor está em `oklch`), sobre o
> estado **assentado** do alerta; com o alerta em `α` de animação o valor medido é outro e não pode ser
> lido como contraste do produto.

Corolário registrado: `rgb(108,108,119)` sobre branco = **5,19:1 (AA)** em todas as rotas da sessão.

## 4. Artefatos (o que o pacote contém — sem promessa de trabalho futuro)

Diretório `playwright-mcp/` (bytes crus, selados de formatação por `.prettierignore`):

| artefato                                                  | papel                                                   |
| --------------------------------------------------------- | ------------------------------------------------------- |
| `chat-ao-vivo.txt`                                        | registro do chat ao vivo                                |
| `console-2026-10-19T03-55-24-222Z.log`                    | log de console (1 de 4)                                 |
| `console-2026-10-19T03-56-44-686Z.log`                    | log de console (2 de 4)                                 |
| `console-2026-10-19T04-01-23-383Z.log`                    | log de console (3 de 4)                                 |
| `console-2026-10-19T04-01-54-111Z.log`                    | log de console (4 de 4)                                 |
| `page-2026-10-19T03-55-24-580Z.yml` … `04-02-06-912Z.yml` | snapshots de acessibilidade (6 arquivos)                |
| `cu-composicao.png`                                       | print full-page da composição                           |
| `webkit-fade-probe.json`                                  | **6 medições** de contraste no WebKit, alerta assentado |
| `axe-3engines.json`                                       | varredura do axe em chromium/firefox/webkit             |

## 5. DoD (critérios binários, com o artefato que os prova)

| rota                   | medição registrada                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/auth`                | login real pelo formulário → redireciona para `/inicio`                                                                                                    |
| `/inicio`              | `Olá! 👋`; badges REAL=1 e DADOS INCOMPLETOS=1; 0 × `R$ 0,00`; 0 × NaN/Infinity; `—` presente                                                              |
| `/produtos`            | 2 produtos com badges corretos; gatilhos **36×36** com recipiente opaco e focáveis por teclado                                                             |
| `/produtos/composicao` | `h1` "Composição do produto"; edição manual real: rendimento 10 → **12** salvo e relido (UI → DB → UI), depois **restaurado para 10** (DB `version` 1 → 2) |
| `/despesas`            | gatilho 36×36 persistente e focável; diálogo com aviso de irreversibilidade; `bg-destructive` real; `ESC` fecha e devolve o foco                           |
| `/diagnostico`         | `h1` "Meu Diagnóstico"; sem alerta; 0 × `R$ 0,00`; 0 × NaN                                                                                                 |
| `/simulacoes`          | `h1` "Simulações"; badge SIMULAÇÃO=1; 0 × `R$ 0,00`; 0 × NaN                                                                                               |

**Console: 0 erros e 0 avisos.** Rede: nenhuma resposta ≥400 na navegação. Os únicos itens de console
são os avisos **report-only** de CSP já conhecidos e uma sugestão de `autocomplete` do DOM.

## 6. Testes (e o que o pacote prova sobre o instrumento)

- `axe-3engines.json` — varredura do axe em **3 engines** ⇒ **0/0/0** violações.
- `webkit-fade-probe.json` — **6 medições** no WebKit com o alerta assentado ⇒ **0 violação**.
- O achado adversarial do pacote é **sobre o próprio instrumento**: o axe amostrou durante a animação e
  produziu um falso positivo de contraste.

## 7. Riscos e limites declarados

- O MCP dirige **Chromium**; WebKit e Firefox foram exercitados **por script** (Playwright CLI), não
  pelo MCP.
- Única mutação de dados: a edição reversível de rendimento, **restaurada** ao valor semeado.
- `cu-composicao.png` é captura **crua** (não passou pela redação do gate visual); a varredura de
  padrões de segredo no pacote deu **vazio**.
- **S6 adversarial não executado.**
- Nenhum commit, push, deploy ou alvo remoto.

## 8. Rollback

Nada a desfazer em Git: a sessão não versionou código. O estado mutado (rendimento de um produto de
fixture) foi restaurado dentro da própria sessão e reconferido no banco.
