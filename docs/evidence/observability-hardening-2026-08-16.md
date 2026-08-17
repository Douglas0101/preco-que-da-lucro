# Boyle — Auditoria de observabilidade e hardening — 2026-08-16

## Resultado

**PARCIAL; sem autorização de produção.** A auditoria encontrou instrumentação
útil já existente, mas não evidência suficiente para declarar observabilidade
mínima completa para o ciclo de migração/cutover.

## Matriz de lacunas

| Área                 | Evidência observada                                                                          | Lacuna / critério para aceite                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| HTTP                 | `src/start.ts:101-117` registra request, status, duração e correlation ID                    | adicionar teste de contrato para propagação e formato do correlation ID                       |
| Banco                | há instrumentação de operação, sem correlação completa por query e sem spans SQL individuais | validar spans DB com correlação, duração e erro sem SQL sensível                              |
| IA                   | há span/operação de IA                                                                       | incluir correlação, duração, resultado seguro e redaction de endpoint/prompt                  |
| Métricas financeiras | métricas genéricas de operação                                                               | medir cálculo concluído, incompleto, inválido, latência e `engine_version`                    |
| Memória              | não foi encontrada métrica específica                                                        | definir contadores/histogramas e limites de cardinalidade                                     |
| Redaction            | logger trata Bearer, URLs de banco, e-mail e chaves sensíveis                                | cobrir exceções de spans, payloads de IA e PII por teste automatizado                         |
| Exporter             | inicialização fail-open evita derrubar a aplicação                                           | testar exporter indisponível durante request/export e comprovar ausência de segredo nos logs  |
| Health               | endpoints live/ready existem                                                                 | adicionar testes de contrato e distinção entre dependências essenciais e opcionais            |
| Headers/CSP/CSRF     | configuração de CSP, HSTS, headers e CSRF existe                                             | adicionar verificação automatizada dos headers e da política em cada ambiente                 |
| UX states            | loading, erro e retry existem em partes da UI                                                | padronizar estados, badges factual/estimado, skeleton/CLS e sem fallback silencioso para zero |

## Próximo lote local

1. Criar testes de contrato para HTTP/DB/IA, redaction, health, headers e
   exporter indisponível.
2. Definir nomes, unidades, labels permitidos e SLOs das métricas financeiras
   e de memória.
3. Instrumentar RUM mínimo para erro, latência, navegação financeira e
   distinção entre dado factual e estimado.
4. Reexecutar a matriz local e anexar logs sanitizados, sem credenciais ou PII.

## Dependências e aceite

- Depende da conclusão do ciclo P1 sem sobrepor o patch de queries.
- Aceite somente com testes reprodutíveis, redaction verificado e exporter
  indisponível sem impacto funcional indevido.
- Este relatório não altera código, não valida Neon e não autoriza migração ou
  cutover.
