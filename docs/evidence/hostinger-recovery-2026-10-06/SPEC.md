# Recuperação do backend publicado (endpoint Neon morto) e teste manual com conta de QA

## Fato-fonte

O operador abriu a sessão com a URL do app publicado
(`https://darkgray-pony-545965.hostingersite.com/`), pediu teste manual do sistema e informou,
depois, que estava sem as credenciais de teste. Diante disso, autorizou explicitamente criar uma
conta de QA em produção e pediu o caminho, pela visão de computer user, para criar a conta e para
adicionar a chave do DeepSeek.

## Problema

O app publicado respondia `ready` 503 (`postgres: unavailable`) e `get-session` 500, com a mensagem
`password authentication failed for user 'neondb_owner'` nos logs de runtime. A leitura ingênua
apontava senha errada; era preciso determinar a causa raiz real e reparar sem ler nenhum valor de
credencial, além de verificar se o teste autenticado era possível.

## Contrato

1. Reparo provado por comportamento: `ready` 200 com `postgres: ok` e `sign-in` com credencial
   inválida devolvendo 401 JSON — não 500 HTML.
2. Nenhum valor de credencial lido, registrado ou usado; apenas nomes, hosts, comprimentos e
   booleanos.
3. Escopo de escrita declarado item a item, com limpeza oferecida e retida por decisão do operador.
4. Nada de publicação, DNS, migration, push ou rotação de credencial por este pacote.
