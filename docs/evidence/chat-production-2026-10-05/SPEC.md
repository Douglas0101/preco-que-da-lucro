# Teste do chat publicado no domínio principal

## Fato-fonte

O usuário pediu explicitamente o teste em produção no domínio principal cadastrado na Hostinger/hPanel, confirmou lançamento na quinta-feira e pediu continuidade. QA anterior e correção são locais; não demonstram que o patch foi publicado.

## Problema

Determinar o domínio principal e o destino ativo, abrir o sistema publicado no Chrome e verificar se autenticação e chat real estão disponíveis. O painel inicialmente selecionado mostra a aplicação Nitro em main d4b93953 e avisa que não há domínio conectado; confirmar em Domínios/Sites, sem presumir roteamento pela existência do cadastro.

## Contrato

Testar o destino observado no hPanel e registrar a origem exata de cada evidência. Abrir tela publicada, verificar disponibilidade de autenticação e, havendo sessão válida, enviar turno de diagnóstico sem mutação de produto. Transporte/readiness/autenticação indisponíveis impedem aprovar o chat; não apresentar home200 como sucesso de chat. Nunca usar suíte de DB, migrations ou fixture local contra dados de produção.

## Mudanças

Este pacote e journal append-only. Teste browser e probes HTTP GET limitados. Configuração de domínio, deployment, banco ou credencial somente depois de causa/evidência e autoridade específica aplicável; este pedido não remove os gates de publicação do AGENTS.md. Não criar conta com contrato/termos ou copiar credencial do arquivo.

## DoD

Domínio e aplicação identificados no painel; tela e contratos HTTP observados; chat real aprovado se houver resposta válida com sessão. Se houver bloqueio, capturar sintoma e causa observável, caminho de correção e limite de autoridade/acesso, sem veredito falso. Evidência redigida e manifesto não vazio.

## Testes

Navegação Chrome pelo painel existente e destino publicado. GET /, /api/health/live, /api/health/ready e /api/auth/get-session, sem cookies em capturas. Consulta dos logs de execução do hPanel para qualificar a causa do erro de sessão, sem abrir valores de credencial. Somente um turno inicial de chat que proíba criar/alterar/excluir dados, se a autenticação estiver pronta. A ausência da sessão ou do compositor é condição observada, não resultado aprovado.

## Riscos

Cadastro de domínio não prova conexão à aplicação, deployment Concluído não prova readiness, correção local não prova publicação. Credenciais ficam com o operador e não entram em snapshots/logs. Teste de escrita em conta produtiva não é inferido do teste de disponibilidade. A interrupção externa do S6 local foi seguida de retomada e confirmação do reparo; CI, publicação e fechamento formal das dívidas continuam pendentes.

## Rollback

Sem mutações de infraestrutura ou dados de negócio planejadas. Preservar aba do operador; artefatos são locais e redigidos antes de persistir.
