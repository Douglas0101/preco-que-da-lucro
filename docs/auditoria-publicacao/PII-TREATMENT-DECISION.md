# Decisão de Tratamento de PII Local

## Data

2026-09-25

## Contexto

A auditoria de segurança para publicação pública encontrou PII em artefatos locais de preservação. A verificação metadata-only, sem imprimir nomes ou emails, confirmou:

- `399` arquivos `.patch` sob `docs/evidence/local-ci/` com headers `From:` de identidade pessoal;
- `22` bundles Git `.bundle` presentes localmente;
- `421` arquivos `.patch` no total, dos quais `2` são rastreados e `419` foram cobertos pelo ignore após a mudança;
- `0` bundles rastreados;
- `0` caminhos `.patch`/`.bundle` aparecendo no `git status --porcelain` após a mudança.

A PII identificada é local. Este documento não afirma que o histórico remoto esteja ou não contaminado; os scans completos de histórico ainda não foram executados.

## Stop condition acionada

O ciclo anterior foi interrompido conforme o protocolo de segurança ao encontrar PII local. A execução posterior retoma apenas a contenção local autorizada: isolar e ignorar, sem remover, publicar ou confirmar o histórico remoto.

## Opções avaliadas

1. **Isolar e ignorar — escolhida.**
2. Sanitizar localmente.
3. Remover completamente.
4. Mover para diretório externo.

## Decisão: Isolar e Ignorar

### Justificativa

1. **Segurança:** artefatos locais deixam de aparecer como candidatos no `git status` e não são incluídos por adição acidental.
2. **Preservação:** os artefatos permanecem disponíveis para desenvolvimento e recuperação local.
3. **Reversibilidade:** a decisão não apaga dados; pode ser revisitada.
4. **Escopo:** a ação não exige remover arquivos, alterar worktrees ou modificar remoto.

### Implementação

1. `.gitignore` recebeu padrões para `.patch`, `.bundle`, diretórios de preservação, `release/` e relatórios raw de auditoria.
2. Os artefatos continuam no disco.
3. Nenhum arquivo sensível foi removido.
4. Nenhum snapshot público foi criado.
5. A proteção é de prevenção de inclusão acidental; não é controle de histórico público e não substitui scans de segredo/PII.

## Riscos mitigados

- Reduz a exposição acidental em `git status` e operações locais de stage.
- Evita que snapshots criados por processos operacionais padrão incluam esses artefatos.
- Mantém a proteção local reversível e sem perda de dados.

## Riscos residuais

- A PII continua na máquina local.
- Uma máquina comprometida pode expor os artefatos.
- Arquivos já rastreados permanecem rastreados, independentemente do `.gitignore`.
- `git add -f` pode contornar a proteção.
- Não há comprovação de que o histórico, issues, releases, assets ou logs remotos estejam limpos.

## Limitações

- Esta decisão **não** torna o histórico Git público seguro.
- Scans Gitleaks, TruffleHog e histórico manual ainda não foram executados.
- A revisão humana das superfícies de evidência é necessária antes de qualquer rota de publicação.
- Rota A permanece bloqueada.
- Rota B permanece condicionada a sanitização, scan final e aprovação humana.
- Rota C — permanecer privado — é a postura segura enquanto o gate não é satisfeito.

## Próximos passos

1. Aguardar decisão humana sobre a disposição dos artefatos locais.
2. Autorizar ou rejeitar os scans completos de histórico.
3. Classificar os resultados sem imprimir PII/segredos.
4. Manter o repositório privado até o gate final e a aprovação explícita.

## Evidência

- `.gitignore:145-169` — padrões de isolamento.
- `docs/evidence/agent-state/PROGRESS.md:L177` — intenção do ciclo.
- `PII-TREATMENT-REPORT.md` — relatório de validação e estado final.
- Push: não.
- Billing: não.
- Publicação: não.
- Remoção: não.
