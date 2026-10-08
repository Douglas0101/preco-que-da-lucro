# Neon readiness com recurso descartável

Execute `neon-readiness.yml` exclusivamente em `develop`, no SHA validado localmente.
O inventário de origem precede a seleção `no-legacy-source` ou a autorização de uma
origem legada somente leitura. Os dois IDs permanentes e o default são conferidos;
produção nunca é destino de testes.

O helper `scripts/ci/neon-resource.ts` planeja um nome por run e attempt, proíbe
reuso, inclui expiração de 24 horas na criação e confirma `created=true`, parent,
ID, default e timestamps antes de qualquer fixture. A conexão administrativa é
direta e a conexão de teste é pooled no mesmo endpoint/banco/role, com motivo
`ALLOW_REMOTE_DB` por passo. O runner não publica valores dessas variáveis.

A suíte completa `db:test` e o drift `db:check` rodam somente nessa cópia.
Migrations/testes no recurso descartável não autorizam fixtures, rollback ou
higiene em `develop` permanente, nem em `production`. Preservar o schema Auth
existente; bootstrap permanente exige ensaio aprovado, inventário e gate protegido.

O cleanup é um job independente com `always()`, inclusive após falha ou timeout
do job de testes. Antes de deletar, observa novamente identidade e ownership.
Closure exige DELETE aceito, GET 404, inventário paginado sem o ID e sem o nome,
e os dois IDs permanentes íntegros. Confirmar também a ausência pelo conector
Neon independente. Nenhum ID retornado ou cleanup skipped prova descarte.

Se o provisionamento não retornar ID mas um recurso com o nome existir, o helper
escala e não presume ownership. TTL é a proteção residual, não prova de limpeza.
HTTP 422 descreve payload/estado sem identificar sozinho a causa; a resposta bruta
não pode expor credenciais. Não inferir quota ou cascata da preview sem evidência.

Artefatos por run/attempt: `neon-readiness-*` e `neon-readiness-cleanup-*`.
Sem reviewer obrigatório no environment, classifique o run como ensaio autorizado,
nunca como aprovação protegida de uma mudança permanente ou de produção.
