# Teste do chat em bancada local

Pedido: testar o chat no Chrome e corrigir falhas reproduzidas.

Escopo: bancada local existente em 4174, PostgreSQL 17 em loopback 41922, conta de fixture. Conferir resposta real do DeepSeek, execução de ferramentas, persistência, custos conhecidos, restauração de histórico e estado do compositor. Preservar o WIP inicial e o histórico de fixture; nenhuma limpeza ou reseed. Chave já presente no processo Web; não abrir DeepSeek-API.txt.

Write-set: este pacote e acréscimos append-only ao PROGRESS.md. Código e testes de chat só entram no write-set se houver defeito reproduzido e registrado.

Resultado esperado: turnos reais, cadastro com dados informados, ausências preservadas e ledger de uso liquidado com custo conhecido. Em cenário positivo, mensagem de erro controlada, erro de transporte, ferramenta falha ou persistência incorreta reprova. Em cenário negativo de proveniência/não-finito, a orientação segura do backend é o resultado esperado, seguida de controle positivo real sem bloqueio. Precondição indisponível não é sucesso.

Esta execução é QA local; não promove release nem afirma validação de runtime publicado.

## Fato-fonte

Turno 3 real no Chrome em `playwright-mcp-chat/turns-before-fix.json`; `finish_product` não devolve cálculo. Regras 2 e 8 em `src/lib/chat-execution.server.ts` proíbem matemática pelo modelo. DBT-93; S6 N4/DBT-94 para NaN/Infinity projetados.

## Problema

A resposta apresentou a soma dos custos como R$ 10,00 sem fonte calculada. Um prompt sozinho não bloqueia o valor antes de sua persistência.

## Contrato

Antes de retornar e persistir texto final, valores BRL e percentuais numéricos têm uma fonte explícita no usuário ou em campo financeiro de resposta bem-sucedida de ferramenta. O contrato reconhece as notações registradas R$/BRL, real/reais, % e por cento com numeral decimal iniciado por dígito; os exemplos legítimos são 0,5% e R$ 0,50. Formas sem zero inicial (,5% e R$ ,50) são recusadas, não normalizadas como 5 ou 50. NaN/Infinity no texto projetado são bloqueados independentemente da fonte. Outros formatos não recebem garantia de proveniência desta checagem. Resposta anterior de assistente não autoriza outro número. Valor sem fonte substitui a resposta por orientação segura, mantendo o ledger do consumo real.

## Mudanças

`src/lib/ai/financial-output-grounding.ts`; `src/lib/chat-execution.server.ts`; `src/lib/chat-markdown-parser.ts`; `src/lib/chat-markdown.tsx`; `src/test/chat-financial-grounding.test.ts`; `docs/evidence/agent-state/DEBTS.md`; append-only PROGRESS; este pacote; contrato em `AGENTS.md`; `docs/specs/M-02/matrix.yaml` e `matrix.generated.yaml` regeneradas para os dois deslocamentos de linha do arquivo de chat.

## DoD

Controle negativo falha nos bytes do pai; integração aceita fontes explícitas e rejeita soma/arredondamento/percentual ausente; gate local completo aprovado; reteste no Chrome e readback de histórico/ledger; manifest estrito e revisão independente com contexto limpo.

## Testes

RED/GREEN via fluxo real de execução com dublês de transporte e persistência observada; variantes de fonte BRL/percentual/ferramenta e ausência. Regressões S6 para sinal antes e depois da moeda, BRL/real/por cento e projeção idêntica ao renderer do chat, incluindo NaN/Infinity ocultados por negrito, zero-width e NFKC; decimal sem zero inicial é recusado. Reteste ao vivo para resposta, restauração e cadastro.

## Riscos

Validação numérica não avalia a semântica de cada frase nem substitui autorização de mutação. A fonte do histórico é limitada ao recorte que o chat já carrega. Campos financeiros novos de ferramentas exigem registro explícito. Outros formatos monetários escritos por extenso estão fora deste contrato. DBT-90/91/92 permanecem questões independentes. Sem CI do patch enquanto não publicado.

## Rollback

Reverter somente o patch próprio de chat-execution e remover o helper/teste próprios, preservando toda custódia e WIP inicial. Nenhuma migration, alteração de chave ou dado de produção.

## Estado terminal

REJECTED no S6, residual N3 após duas rodadas. O DoD de proveniência de fonte user não foi alcançado por estes bytes; parecer integral em captures/s6-terminal-rejected.txt. Reparo prossegue em ../chat-source-literal-2026-10-05, com novo RED/GREEN e revisão independente.
