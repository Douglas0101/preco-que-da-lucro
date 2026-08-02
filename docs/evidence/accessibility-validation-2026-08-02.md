# Evidência de Acessibilidade - 2026-08-02

## Escopo Automatizado

- Playwright executado em Chromium, Firefox, WebKit e emulação Pixel 7.
- Três jornadas por projeto: landing pública, limite de autenticação e shell autenticado com contrato Supabase controlado.
- Resultado: 12 de 12 testes aprovados.
- Axe executado nas jornadas pública e autenticada com tags WCAG 2.0/2.1 A e AA.
- Resultado Axe: zero violações `critical` ou `serious`.
- Ordem de foco verificada para Google, e-mail, senha e envio; `/inicio` sem sessão redireciona para `/auth`; uma sessão persistida redireciona `/` para `/inicio`; server functions autenticadas recebem o bearer da sessão; controles compostos não geram `a button`, `button a` ou `button button`.

Comando reproduzível em host com dependências Playwright instaladas:

```bash
npm run test:e2e
```

O CI instala Chromium, Firefox e WebKit com `playwright install --with-deps` antes de executar a matriz completa.

## Orca no ZorinOS

| Campo          | Evidência                                                          |
| -------------- | ------------------------------------------------------------------ |
| Sistema        | Zorin OS 18.1, base Ubuntu Noble                                   |
| Leitor de tela | Orca 46.1                                                          |
| Navegador      | Firefox Gecko 153.0 fornecido pelo Playwright                      |
| Modo           | Firefox headed, um worker, speech habilitado                       |
| Resultado E2E  | 3 de 3 jornadas aprovadas                                          |
| Log local      | `/tmp/opencode/orca-validation.log`                                |
| SHA-256 do log | `c897d893e7918567c6df681ad260cd15159fbc64754a91b22855b54691e59a62` |

Observações confirmadas no log:

- O título da landing foi anunciado como "Preço que Dá Lucro - descubra o preço certo do seu produto" e seu carregamento foi concluído.
- O CTA foi anunciado como "Começar agora, link".
- A área autenticada expôs os landmarks de conteúdo complementar e navegação.
- "Meus Produtos" foi anunciado como link.
- O fluxo de foco expôs "Continuar com Google" como botão, "E-mail" como campo de entrada e "Senha" como campo de senha.

Esta execução é suplementar. Ela não substitui os pares obrigatórios de plataforma e tecnologia assistiva abaixo.

## Evidência Externa Pendente

| Plataforma | Tecnologia assistiva | Navegador       | Jornadas mínimas                                         | Status   |
| ---------- | -------------------- | --------------- | -------------------------------------------------------- | -------- |
| Windows 11 | NVDA estável         | Chrome estável  | Landing, autenticação, shell, menu, formulário e diálogo | Pendente |
| Windows 11 | NVDA estável         | Firefox estável | Landing, autenticação, shell, menu, formulário e diálogo | Pendente |
| macOS      | VoiceOver            | Safari estável  | Landing, autenticação, shell, menu, formulário e diálogo | Pendente |

Cada execução externa deve anexar data, versões, operador, resultado por jornada, defeitos encontrados, reteste e gravação ou log quando permitido. O gate de release permanece bloqueado até essas três linhas terem evidência aprovada.

## Limites

- O estado autenticado automatizado valida o contrato de UI com respostas Supabase controladas e comprova o transporte do bearer até a requisição da server function; não comprova a aceitação server-side do token nem o sucesso do handler e não substitui um teste externo com credenciais e backend reais.
- A execução local do WebKit exigiu bibliotecas Ubuntu extraídas temporariamente porque o host não permite `sudo`; isso não altera o repositório nem o sistema.
- O log Orca permanece fora do Git por conter eventos do desktop além da aplicação. Apenas o hash e as observações sanitizadas são versionados.
