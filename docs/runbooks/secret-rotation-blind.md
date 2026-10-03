# Runbook — rotação cega das seis credenciais (Ciclo 26)

DBT-36 abrange **Neon API, Vercel API, Sonar, Context7, DeepSeek e GitHub PAT**.
Via A (ADR-031): valores ficam no cofre/clipboard do operador; o agente recebe apenas
refs, hashes, status bruto e identidade conferida. A rotação precisa terminar antes
da release. GitHub PAT é o último, para manter o canal de engenharia disponível.

## Pré-condições

1. Registrar a revisão e o write-set; preservar WIP fora dele. Rodar `npm run check`.
2. Executar os cinco cenários fictícios com os backends memória **e** Secret Service.
   Ausência de clipboard/cofre é precondição `2`, nunca evidência verde.
3. Enumerar refs já existentes; não sobrescrever ref operacional. Os fictícios não
   são credenciais do provedor e não provam que qualquer chave real foi rotacionada.
4. Mapear consumidores por **nome**: Actions/MCP/cofre/plataformas, identidade do
   recurso, permissões atuais e nome/ID da chave no console. Não ampliar escopo.

```bash
npx tsx scripts/secret-sidecar/cli.ts selftest --backend=memoria --root=<bancada>
npx tsx scripts/secret-sidecar/cli.ts selftest --backend=cofre --root=<bancada>
npx tsx scripts/secret-sidecar/cli.ts list --backend=cofre
```

O autoteste preserva e restaura o clipboard em memória no `finally`. Nenhum valor
real é argumento de linha de comando. A captura do console não passa por screenshot.

## Ordem por credencial

1. O humano copia a credencial antiga para o clipboard e executa `capture <nome>-antigo`.
2. O humano **emite uma nova chave no provedor**, com permissões/consumidores iguais.
   `generate` serve para segredos que a aplicação aceita definir; não fabrica tokens
   API de Neon/Vercel/GitHub/Sonar/Context7/DeepSeek. Capturar a chave emitida em
   `capture <nome>-novo`, registrar hashes distintos e identidade da emissão.
3. O humano atualiza cada consumidor através do console/cofre. Entrada, confirmação
   e submissão de credenciais são humanas conforme a política de browser e Via A.
4. Executar o consumidor aplicável com a nova chave e o probe protegido. Confirmar
   recurso/identidade/escopo; somente então revogar a antiga no console do provedor.
5. Registrar o ID/estado de revogação do provedor, testar a antiga novamente e
   conservar o **status bruto**. Uma revogação sem prova fica pendente.
6. Registrar denylist pelo ref **antigo existente** e remover esse ref do cofre.

```bash
npx tsx scripts/secret-sidecar/cli.ts capture <nome>-antigo
npx tsx scripts/secret-sidecar/cli.ts capture <nome>-novo
npx tsx scripts/secret-sidecar/cli.ts test-provider <nome>-novo --provider=<provedor> --identity=<metadado-publico>
# Depois de nova chave + consumidores observados, revogar no console humano.
npx tsx scripts/secret-sidecar/cli.ts test-provider <nome>-antigo --provider=<provedor> --identity=<metadado-publico>
npx tsx scripts/secret-sidecar/cli.ts denylist <nome>-antigo <sha256_old> <sha256_new>
npx tsx scripts/secret-sidecar/cli.ts delete <nome>-antigo
npx tsx scripts/secret-sidecar/cli.ts verify
```

## Probes e limites declarados

O novo comando usa somente HTTPS em endpoints fixos, recusa redirects, lê o corpo
somente transitoriamente e nunca o persiste/devolve. Ele compara uma chamada
anônima com a autenticada. `0` exige identidade protegida conferida; `1` indica
recusa de autenticação; `2` indica `NO-VERDICT`/precondição. Um `403` pode ser falta
de permissão, e `200` de uma superfície pública não prova autenticação.

| Provedor | Probe protegido                 | Identidade esperada / limite                                                                                         |
| -------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Neon     | `/api/v2/projects/<project-id>` | ID exato do projeto                                                                                                  |
| Vercel   | `/v9/projects/<prj-id>`         | ID opaco exato; repetir o consumidor para cada equipe aplicável                                                      |
| Sonar    | `/api/user_tokens/search`       | Nome emitido presente no catálogo protegido do usuário; autenticação do token e consumidor Actions também observados |
| Context7 | `/api/v2/policies`              | Contrato de identidade da conta/key ainda não medido: `NO-VERDICT`, mesmo com `200`                                  |
| DeepSeek | `/user/balance`                 | Resposta não prova identidade da conta/key: `NO-VERDICT`; saldo nunca registrado                                     |
| GitHub   | `/user`                         | Login esperado e exercício dos escopos reais do consumidor; por último                                               |

Os dois limites de identidade são bloqueadores nomeados de DBT-36. Antes da closure,
medir um endpoint/atestado do emissor que vincule a chave ao owner/escopo e acrescentar
a validação específica. Não adivinhar schema de resposta nem fabricar par `200/401`.
O comando legado `test --kind=http|db` conserva status bruto e o autoteste local;
ele sozinho **não** fecha rotação. Para banco, `28P01/28000` são recusas medidas,
separadas dos códigos de transporte, catálogo ausente e autorização.

Fontes: [Context7 API e políticas](https://context7.com/docs/api-guide),
[DeepSeek balance](https://api-docs.deepseek.com/api/get-user-balance),
[Web API Sonar](https://docs.sonarsource.com/sonarqube-cloud/advanced-setup/web-api).

## Closure, rollback e custódia

Fechar DBT-36 exige os fictícios verdes nos dois backends e, para **cada uma das seis**:
identidade/escopo do emissor, nova chave autenticada, consumidores atualizados,
revogação da antiga comprovada no provedor e probe, hashes/denylist e remoção do
ref antigo. Ausência de um item mantém a dívida `EM_TRATAMENTO`.

Se a nova falhar antes da revogação, conservar a antiga e corrigir/reemitir a nova
com o humano. Depois da revogação, recuperação exige chave emitida válida; devolver
a antiga ao consumidor não restaura uma chave revogada. Falha de limpeza do
clipboard interrompe a sequência e exige limpeza humana.

Nunca enviar valores em chat, argv, logs, commit, screenshot, conexão URL ou corpo
do relatório. Rodar `npm run m02:secrets-audit`, conferir audit/ref list e registrar
cada intenção/resultado no journal com nomes e hashes, preservando WIP e selos anteriores.
