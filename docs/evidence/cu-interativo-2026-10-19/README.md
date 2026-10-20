# Sessão interativa de computer user — 2026-10-19

Pacote **não selado**. Sessão de browser conduzida pelo **MCP Playwright** contra a bancada `:4173` (build atual, IA zerada), a pedido do dono ("abra o navegador e comece a testar o sistema").

## Como a sessão entrou (sem expor credencial)

O login foi feito pelo **formulário real** (`/auth` → E-mail / Senha / Entrar). As credenciais vieram do arquivo de fixture (0600, `.artifacts/e2e-local.env`) por um **broker efêmero em loopback**, consumido **pela própria página** — nada foi impresso no chat, nada foi gravado em arquivo do repositório e o broker foi encerrado logo após o login. As capturas carregam apenas a identidade de fixture `teste@example.test`, já pública em `docs/observability/COMPUTER-USER-OBSERVABILITY.md`.

## O que foi exercitado e medido

| rota                   | medição                                                                                                                                                                                                         |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/auth`                | login real pelo formulário → redireciona a `/inicio`                                                                                                                                                            |
| `/inicio`              | `Olá! 👋`; badges REAL=1 e DADOS INCOMPLETOS=1; 0 × `R$ 0,00`; 0 × NaN/Infinity; `—` presente                                                                                                                   |
| `/produtos`            | 2 produtos com badges corretos; gatilhos **36×36** com recipiente opaco e focáveis por teclado; gatilho "Editar composição de <produto>" nomeando o alvo                                                        |
| `/produtos/composicao` | `h1` "Composição do produto"; aviso "Nada aqui depende do assistente"; **edição manual real**: rendimento 10 → **12** salvo e relido como 12 (UI → DB → UI), depois **restaurado para 10** (DB `version` 1 → 2) |
| `/despesas`            | gatilho 36×36 persistente e focável; diálogo com aviso de irreversibilidade; ação com `bg-destructive` real; `ESC` fecha e devolve o foco                                                                       |
| `/diagnostico`         | `h1` "Meu Diagnóstico"; sem alerta; 0 × `R$ 0,00`; 0 × NaN                                                                                                                                                      |
| `/simulacoes`          | `h1` "Simulações"; badge SIMULAÇÃO=1; 0 × `R$ 0,00`; 0 × NaN                                                                                                                                                    |

Contraste do texto muted medido por **canvas** (não por regex — a cor está em `oklch`): `rgb(108,108,119)` sobre branco = **5,19:1 (AA)** em todas as rotas.

**Console: 0 erros e 0 avisos.** Rede: nenhuma resposta ≥400 na navegação. Os únicos itens de console são os avisos **report-only** de CSP já conhecidos (inline scripts do SSR + estilos) e uma sugestão de `autocomplete` do DOM.

## Achado adversarial (errata do DBT-126)

A sessão **derrubou** a conclusão anterior: o "contraste 2,79–3,8:1" que o axe reportava no WebKit recompõe exatamente o token real composto com branco a **α = 0,850 / 0,701** — o axe amostrou o texto **durante a animação `enter`** do alerta. Com o alerta assentado: **6 medições no WebKit = 0 violação** e o probe de 3 engines deu **0/0/0**. O defeito real é **assertion flaky**, não contraste. Ver journal **L964** e o registry `DBT-126` (higiene/alta).

## Capturas (bytes crus, selados de formatação)

`playwright-mcp/` — logs de console, snapshots de acessibilidade das rotas, `cu-composicao.png` (print full-page da composição), `webkit-fade-probe.json` (6 medições) e `axe-3engines.json` (varredura do axe em chromium/firefox/webkit). Todo o diretório está selado de formatação (`.prettierignore`), porque captura bruta é prova e não se reformata.

## Limites declarados

- O MCP dirige **Chromium**; WebKit e Firefox foram exercitados por script (Playwright CLI), não pelo MCP.
- Única mutação de dados: a edição reversível de rendimento, restaurada ao valor semeado.
- `cu-composicao.png` é captura **crua** (não passou pela redação do gate visual); a varredura de padrões de segredo no pacote deu **vazio**.
- Nenhum commit, push, deploy ou alvo remoto.
