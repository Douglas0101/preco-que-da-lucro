# Chat em produção — domínio principal e backend

## 1. Resultado observado

**Teste autenticado do chat: PENDENTE de acesso e de prontidão do backend.** O usuário pediu produção no domínio principal e confirmou lançamento na quinta-feira. O domínio cadastrado e ativo no hPanel é `diretrizprecifica.com`. A página pública abre no Chrome; Entrar leva a `/login`, sem sessão nesta execução. Foi solicitado ao operador que entre nessa aba sem transmitir senha ou chave ao agente.

O operador respondeu que irá conferir a conexão no hPanel/Neon e pediu credenciais de teste para entrar. Nenhuma credencial de QA de produção foi confirmada nesta sessão. A conta da bancada isolada não é uma conta desse portal. A opção pública Criar conta abre os campos nome, e-mail, senha e confirmação, com senha mínima de dez caracteres; nenhum campo foi preenchido e o cadastro não foi enviado. O formulário foi deixado para intervenção humana. Esse cadastro pertence à área de assinaturas e, por si, não prova acesso ao chat Nitro.

O domínio principal serve o site Hostinger Horizons e uma área de assinaturas. A autenticação pública desse site usa PocketBase em `/hcgi/platform`; a descoberta anônima de métodos retornou JSON200 com senha habilitada. Isso demonstra a disponibilidade do endpoint de métodos, sem comprovar login ou chat. O bundle observado não possui os marcadores de TanStack Start, Better Auth, DeepSeek ou a rota novo-produto do repositório. As quatro rotas `/`, `/api/health/live`, `/api/health/ready` e `/api/auth/get-session` retornaram HTML200 idêntico, SHA256 b3546636a9de3e90f7fdaa557617d7ae6c43ef677a2ad33741035850e321ec6c. Portanto, essas rotas no domínio principal não expõem o contrato JSON do backend Nitro verificado localmente. Não inferir de uma landing page200 que o chat funciona.

O hPanel mostra a aplicação Node separada `darkgray-pony-545965.hostingersite.com`, repositório preco-que-da-lucro, branch main, commit exibido d4b93953, implantação Concluído em 2026-10-01, Node 24.x/Nitro, auto-deploy desativado e aviso de domínio não conectado. O probe final dessa aplicação mediu live 200/JSON ok e ready 503/JSON not_ready/Postgres unavailable. O probe de sessão retornou 500/HTML. Houve falhas de transporte intermediárias, conservadas sem atribuir causa por inferência. O backend não está pronto para aprovar chat autenticado.

A consulta posterior dos logs de execução do hPanel identificou a falha concreta da sessão: `password authentication failed for user 'neondb_owner'`. O evento `request.failed` identifica GET `/api/auth/get-session`, às 2026-10-06T01:23:43.766Z, na última implantação exibida. Os logs também registram a falha de readiness e o aviso de resolução de IP do Better Auth. Nenhuma senha ou connection string foi lida. A causa observada é rejeição da autenticação de banco; o segredo correto, o endpoint e eventual rotação precisam ser conferidos pelo operador, sem atribuir a falha a variável ausente.

As condições já pertencem às dívidas ABERTAS DBT-73 (Hostinger readiness/sessão) e DBT-78 (contrato do domínio principal); este pacote renova a observação, sem duplicar IDs ou fechá-los. A aplicação publicada é anterior ao patch local do chat e não foi reimplantada por este teste.

## 2. Evidência e identidade

| Observação                                         | Captura                                                                                                        | Classe                                                                 |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Node main/commit/aviso de domínio/auto-deployoff   | playwright-mcp-production/01-hpanel-overview.json e .png                                                       | REMOTE-OBSERVED, metadados do painel                                   |
| Domínio cadastrado ativo                           | playwright-mcp-production/02-registered-domain.json                                                            | REMOTE-OBSERVED                                                        |
| Página principal e tela login                      | playwright-mcp-production/03-main-domain-home.json,04-main-login.json e .png                                   | REMOTE-OBSERVED, Chrome                                                |
| API do domínio principal devolve HTML igual à home | captures/http-observed.json                                                                                    | REMOTE-OBSERVED, GET anônimo                                           |
| Readiness503/Postgresunavailable e live200         | captures/node-health-final.json                                                                                | REMOTE-OBSERVED, GET anônimo e TLS normal                              |
| Sessão500 e falhas de rede                         | captures/http-observed.json,captures/node-runtime-qualified.json                                               | REMOTE-OBSERVED; falha de transporte não é veredito de saúde           |
| Falha de autenticação PostgreSQL nos logs          | playwright-mcp-production/05-runtime-logs.json e .png                                                          | REMOTE-OBSERVED, logs da execução no hPanel; sem valores de credencial |
| SDK/rotas do site Horizons                         | captures/public-login-bundle.json,public-auth-origin.json,public-route-observation.json,public-auth-paths.json | Código público observado, sem token/sessão                             |
| Métodos de autenticação do Horizons                | captures/horizons-auth-methods.json                                                                            | REMOTE-OBSERVED; não prova autenticação                                |

A abertura da opção pública Criar conta está em `playwright-mcp-production/06-account-access.json` e `.png`: formulário visível e sem cadastro submetido. O pedido de conferência de credenciais e a resposta do operador estão qualificados em `captures/operator-handoff.json`, sem afirmar configuração aplicada.

Uma única rechecagem anônima e limitada, após o handoff, está em `captures/node-after-handoff.json`: às 2026-10-06T02:05:31Z, readiness voltou HTTP 503/JSON/Postgres unavailable e sessão HTTP 500/HTML. Os dois corpos possuem os mesmos hashes das observações anteriores. A última conferência da aba pública constatou novamente o formulário Entrar, somente por visibilidade de headings; nenhum valor digitado foi lido.

Errata do harness: no primeiro http-observed.json, o campo status de readiness foi sobrescrito pelo status da aplicação, ficando not_ready. Esse campo inicial não prova o código HTTP. A captura node-health-final.json separa httpStatus503 e applicationBody.statusnot_ready. As capturas anteriores ficam preservadas.

## 3. Caminho de correção preparado

Antes de editar produção, confirmar qual caminho de acesso deve ligar o portal Horizons ao aplicativo Nitro. O estado atual permite identificar os dois destinos; não autoriza escolher uma troca do domínio, remover a landing page ou alterar DNS por inferência.

No backend, o operador deve conferir a `DATABASE_URL` da aplicação Node contra a conexão pooled da branch `production` no Neon, incluindo endpoint, usuário e credencial. A entrada e submissão do valor seguem Via A, conforme AGENTS.md; foi solicitado esse handoff sem pedir o segredo no chat. A observação de rejeição de senha torna essa conferência o primeiro reparo operacional. Não usar a conexão da fixture local ou da branch develop. `DATABASE_ADMIN_URL` é exclusiva de administração/migration e não entra no processo Web.

Após a configuração ser aplicada pelo caminho operacional autorizado, revalidar `/api/health/ready` com HTTP 200 e JSON de prontidão, e `/api/auth/get-session` com contrato JSON legítimo, antes do login e do chat. A falha de senha não prova qual valor estava configurado nem permite ao agente escolher ou substituir uma credencial. A consulta dos logs não executou rotação, mudança de env ou redeploy. O aviso de IP do Better Auth é uma condição adicional observada; seu impacto não foi validado neste teste e não é atribuído como causa do erro de banco.

O consumidor novo de DeepSeek deve ser publicado como parte do mesmo SHA main aprovado no circuito de release. O runbook deepseek-web.md proíbe mudar o runtime antigo de main para uma variável que só o candidato conhece. DEEPSEEK_API_KEY é inserida/submetida pelo operador Via A no backend; URL/modelo são os nominais já validados em desenvolvimento. A chave não pertence ao site público Horizons. Qualificação completa exige resposta real e uso medido no tenant autorizado; a conta de produção precisa estar autenticada. Não copiar a chave de DeepSeek-API.txt para o transcript.

O patch local passou `npm run check` com 1883 testes, build/bundle e reteste real. A revisão independente foi retomada após a interrupção externa e terminou com zero rejeições no contrato local, 83 controles e 34 fluxos aprovados; o parecer está no pacote [sucessor](../chat-source-literal-2026-10-05/README.md). O patch permanece local e sem CI de publicação. AGENTS.md exige circuito completo e SHA main aprovado antes de publicação; a revisão local não autoriza deploy. Não foram executados redeploy, DNS, migration, merge, push, emissão/entrada de credencial ou escrita de produto em produção.

## 4. Riscos e limites

Sem sessão de produção, não houve envio de mensagem ao chat publicado. O teste de ferramenta de fixture e o readback PG17 foram somente na bancada loopback. Disponibilidade dos métodos PocketBase não valida senha, assinatura, tenant ou integração com o aplicativo. O header Horizons e o contrato HTML comprovam o destino dessas rotas observadas; não descrevem todas as rotas privadas ou possíveis ligações após login.

## 5. Auto-verificação

KPI de prevenção S6: não medido, S6 deste diagnóstico não iniciado. Não há novo código de produção ou claim de fechamento de release. Os achados atuais são observações de DBT-73/78; não são N de um S6 ainda não realizado.

| #   | Item                 | Resultado                                                                                              |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Controle negativo    | API exige JSON; HTML idêntico à home reprova o contrato, mesmo com200.                                 |
| 2   | Duas direções        | live200 distingue processo vivo de ready503/dependência indisponível.                                  |
| 3   | Identidade           | Domínio principal e hostname Node separados por URL/painel/SHA de corpo.                               |
| 4   | Sintoma              | MIME e conteúdo, não exit code nem status200 isolado.                                                  |
| 5   | Marcador             | Estado de tela por DOM; respostas HTTP observadas, sem aprovação por sleep.                            |
| 6   | Não degenerado       | Hash completo e corpos de tamanhos7956/64/15bytes confrontados.                                        |
| 7   | Estado compartilhado | GET anônimo sem cookie; login é humano e pendente.                                                     |
| 8   | Sentinela            | URLs exatas observadas no hPanel, sem fixture de DB contra produção.                                   |
| 9   | Fingerprint          | Bundle e respostas possuem SHA256; painel identifica main/commit parcial exibido.                      |
| 10  | Descoberta           | Manifesto não vazio cobre a descoberta integral; audit por releitura e sha256sum, sem selo de release. |
| 11  | S6                   | NÃO INICIADO, sem alegação de aprovação independente ou encerramento.                                  |
| 12  | Fail-closed          | Readiness503, sessão500 e login pendente impedem aprovação do chat.                                    |
| 13  | Isolamento           | Sem teste DB, migration, produto, conta nova ou ferramenta mutante em produção.                        |
| 14  | Capturas             | Browser/HTTP/código público qualificados; erros iniciais e de transporte preservados.                  |
| 15  | CI                   | Não aplicável ao GET observado; CI do patch/land/release NÃO VERIFICADO.                               |
| 16  | Sites                | Domínio Horizons, Node, login, métodos auth e endpoints enumerados por descoberta.                     |
| 17  | Ambiente             | Chrome atual autenticado no hPanel; probes com timeout/TLSnormal; sessão do app ausente.               |

## 6. S6 ADVERSARIAL

NÃO INICIADO. Diagnóstico executado pelo principal, com fatos capturados e pendências declaradas; não é selo de produção verde.

## 7. Custódia e continuidade

As abas e o domínio existentes são preservados. A aba https://diretrizprecifica.com/login está marcada para handoff e a última observação mostrou o formulário Entrar; a opção de cadastro foi inspecionada e capturada sem envio. Há dois handoffs solicitados: acesso à conta no domínio principal e conferência da conexão de banco no hPanel/Neon. A resposta do operador é intenção de conferir, sem confirmação de configuração aplicada. Após o login do operador, verificar a área autenticada e o caminho para o aplicativo, antes de mandar um turno sem mutação. Configuração ou publicação exigem a autoridade e os gates aplicáveis, com credenciais inseridas pelo humano. Nenhum dado de produção foi apagado ou semeado.
