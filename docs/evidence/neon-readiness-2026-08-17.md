# G3-001 — Neon readiness: boundary e bloqueios

- **Data:** 2026-08-17
- **Task ID:** G3-001
- **Target code SHA:** `2255321045ab9b7bf3905e2db2fea6ae7199c106`
- **PR:** #16, ainda draft; base Git `develop`
- **Implementação:** Orquestrador, com pré-análise operacional registrada
- **Estado:** `BLOCKED`
- **Modo pretendido:** `dry-run`; não executado

## Objetivo e limites

Esta evidência registra a pré-análise do gate Neon sem abrir, copiar ou
imprimir credenciais. Nenhum workflow `neon-readiness.yml` foi executado,
nenhuma branch Neon foi criada ou removida, nenhuma migration foi aplicada,
nenhum banco externo foi consultado e nenhuma alteração de produção ou
cutover ocorreu.

O caminho legado Supabase não foi alegado: a existência ou ausência de uma
fonte `SUPABASE_MIGRATION_DATABASE_URL` não foi confirmada nesta etapa.

## Fatos verificáveis

### Branch Git e referência do workflow

Uma consulta read-only ao repositório remoto confirmou:

- `refs/heads/develop` existe no GitHub em
  `aed4c375a75bde2c1e1bd51bc9a27dd2c78b12c5`;
- `refs/heads/main` existe no GitHub em
  `57f85733a319dc4dd8f495bb65ac935e3273d309`.

Isso não prova que exista uma branch chamada `develop` no projeto Neon. O
workflow `.github/workflows/neon-readiness.yml` contém uma etapa que exige
`github.ref == refs/heads/develop` e, portanto, não deve ser disparado usando a
branch do PR como referência. A instrução do workflow para criar a branch
descartável usa `vars.NEON_PARENT_BRANCH` e cai no valor padrão `develop` quando
a variável não está definida.

### Falha externa já observada

No head anterior publicado (`09df603297f1a36af63ea51038f54ba9c8c67ee`), o
workflow de preview migration falhou no run `32001096597`, job
`95301461066`, no passo `Create ephemeral Neon branch`, com a mensagem
sanitizada `Parent branch develop not found`. A mesma falha foi repetida pelo
run `32002199507`, job `95304532492`, no head
`2255321045ab9b7bf3905e2db2fea6ae7199c106`.

Essa mensagem demonstra somente que o parent `develop` não foi encontrado no
projeto Neon consultado; não identifica qual branch Neon deve ser usada e não
autoriza uma tentativa com um nome arbitrário.

### Disponibilidade de ferramentas e configuração

- O executável `neon` não está disponível no `PATH` deste ambiente.
- Uma tentativa de obter a ajuda via `npx neon@latest --help` foi interrompida
  após não produzir saída; nenhum arquivo de credencial foi aberto.
- O MCP Neon não está exposto como ferramenta nesta conversa.
- Consultas read-only de listagem de secrets/variables do environment
  `neon-readiness` não chegaram à API do GitHub por erro de conexão; portanto,
  não se conclui que qualquer secret ou variable esteja ausente.
- Nenhum valor de `NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_PARENT_BRANCH`, URL
  de conexão ou role foi lido ou registrado.

## Matriz do critério de aceite G3

| Critério                                   | Estado           | Evidência                                                                               |
| ------------------------------------------ | ---------------- | --------------------------------------------------------------------------------------- |
| Configuração recebida por canal seguro     | `NÃO COMPROVADO` | listagem de environment indisponível; nenhum valor foi lido                             |
| Branch Neon descartável criada e removida  | `NÃO EXECUTADO`  | preview abortou antes da criação                                                        |
| URLs direct e pooled distintas             | `NÃO EXECUTADO`  | nenhuma URL externa foi obtida                                                          |
| PostgreSQL major 17 externo                | `NÃO EXECUTADO`  | somente o gate local PostgreSQL 17 foi validado em G1                                   |
| Migrations, `db:test` e `db:check` no Neon | `NÃO EXECUTADO`  | steps posteriores foram impedidos pelo parent inexistente                               |
| RLS, privilégios e smoke autenticado       | `NÃO EXECUTADO`  | sem conexão externa                                                                     |
| Reconciliação legada                       | `NÃO EXECUTADO`  | fonte legada não confirmada                                                             |
| Artifact sanitizado com run/SHA/timestamps | `PARCIAL`        | este documento e os runs de preview registram SHA/run/job; não há artifact de readiness |
| Produção ou cutover alterados              | `NÃO`            | nenhuma ação externa de escrita foi executada                                           |

## Bloqueio e próximo passo seguro

G3 permanece `BLOCKED`. Antes de qualquer workflow de readiness, um operador
autorizado deve descobrir por canal seguro o nome da branch existente no
projeto Neon e configurar `NEON_PARENT_BRANCH` no environment protegido, sem
colocar valores em código, chat, prompt ou artifact. Não é aceitável substituir
o nome por `main`, `develop` ou outro palpite.

Depois dessa configuração, a próxima TaskSpec deve executar somente o
workflow `neon-readiness.yml` na referência Git `develop`, com
`migration_mode=dry-run` e `confirm_apply=false`, confirmar a remoção da branch
descartável e revisar o artifact sanitizado. O workflow não deve ser chamado
na branch do PR porque sua própria etapa `Require develop ref` o rejeita.

`apply`, migração de dados, backup/restore, rollback, produção e cutover ficam
proibidos até que o dry-run e todos os gates G3 sejam comprovados.

## Riscos conhecidos

- O nome de branch Git `develop` e o nome de branch Neon `develop` são domínios
  diferentes; confundi-los reproduz o bloqueio atual.
- A ausência de resposta da API de listagem não é evidência de ausência de
  secrets; é somente uma limitação de observação desta execução.
- Free tier pode impor limites de capacidade, mas não reduz os critérios de
  segurança, major do PostgreSQL, redaction, rollback ou cutover.

**Decisão:** `BLOCKED`; Neon readiness, migração, rollback, produção e cutover
não estão concluídos nem autorizados.

## Revisões independentes

| Revisor     | Papel                                | Verdict   | Resultado                                                                                            |
| ----------- | ------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------- |
| Kierkegaard | Técnico Principal / Git/CI/Evidência | `APPROVE` | separação Git-vs-Neon, rastreabilidade, limites e qualidade documental aprovados; sem blocker        |
| Plato       | Segurança/Auth                       | `APPROVE` | redaction, ausência de secrets/PII/URLs autenticadas e contenção aprovadas; sem finding de segurança |

As aprovações são restritas ao artefato de evidência e não equivalem a
aprovação de readiness, migração, `apply`, produção, rollback ou cutover.

**Decisão final da TaskSpec G3-001:** `APPROVE` para a evidência documental,
com estado operacional `BLOCKED`. O próximo avanço exige descobrir e
configurar com segurança o parent branch real do projeto Neon e executar um
dry-run separado; nenhum valor de credencial deve ser colocado no repositório,
prompt, log ou evidência.
