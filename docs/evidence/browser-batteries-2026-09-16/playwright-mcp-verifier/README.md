# `playwright-mcp-verifier/` — capturas do papel ADVERSARIAL (contexto separado)

Este diretório **não** é evidência da bateria: são as capturas cruas produzidas pelo agente verificador
adversarial durante a falsificação das alegações de `../CICLO-3-BATERIAS-UI.md`, mais **uma** captura do
STEWARD que se revelou da sessão errada.

| item                                                      | proveniência                                                                                                                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page-*.yml` / `console-*.log` (janela `02:57–03:07` UTC) | agente adversarial (`VERDICT-ADVERSARIAL.md`)                                                                                                                   |
| `nas2c3-produtos-TENANT-B-0302.yml`                       | tentativa de recaptura do STEWARD **na sessão do tenant B** — preservada porque é raw legítimo da visão de B (insumo do §32c), e renomeada para dizer a verdade |

O servidor MCP Playwright é **compartilhado** entre a sessão principal e os subagentes; por isso as
capturas dos dois papéis caem no mesmo scratch do MCP. A partição foi feita pelo manifesto de
integridade da bateria (`../playwright-mcp.sha256`) e **não** é limpa em dois arquivos:
`page-2026-09-17T03-02-42-506Z.yml` e `page-2026-09-17T03-03-39-996Z.yml` são navegações do
**STEWARD** (a primeira saiu na sessão do tenant B) que caíram nessa janela. Composição do diretório:
**26** capturas do verificador (12 `page-*` + 14 `console-*`) + **3** do STEWARD (os 2 `page-*` acima
+ `nas2c3-produtos-TENANT-B-0302.yml`) + este `README.md` = **30 entradas**. Nenhum arquivo foi
reescrito nem reformatado.
