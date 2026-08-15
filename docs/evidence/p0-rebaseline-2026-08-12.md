# Rebaseline P0 — 2026-08-12

| Campo          | Evidência                                                                 |
| -------------- | ------------------------------------------------------------------------- |
| Branch inicial | `develop` em `ecf8a13`                                                    |
| Check local    | 5 arquivos/176 testes antes deste lote; todos verdes                      |
| Build produção | Verde, sem warnings observados                                            |
| Bundle entry   | 231.411 bytes                                                             |
| Grafo inicial  | 419.934 bytes                                                             |
| Audit npm      | 0 vulnerabilidades                                                        |
| E2E funcional  | 18 execuções Chromium/Firefox/mobile verdes                               |
| WebKit local   | Não iniciou: host sem `libavif.so.16`; CI instala dependências Playwright |

Esta evidência atualiza, mas não reescreve, o snapshot histórico de 09/08. Os comandos executados foram:

```bash
npm run check
BUILD_RELEASE_CHANNEL=production npm run build
npm audit --audit-level=high
npm run test:e2e
```

## Estado funcional confirmado

- SEC-001 e FIN-001 a FIN-005 estavam implementados no ponto inicial.
- FIN-005 foi publicado em `origin/develop` após os gates acima.
- O renderer do chat continua sem HTML executável.
- O bundle permanece abaixo do budget bloqueante de 500.000 bytes.
- O E2E revelou warnings Base UI `nativeButton`; são dívida real de semântica e permanecem no lote de UX/hardening.

## Débitos que continuam abertos após este lote financeiro

- PostgreSQL/Neon, migrations e isolamento tenant;
- Better Auth e retirada de token do `localStorage`;
- BFF, services/repositories e eliminação de consultas diretas;
- taxonomia de erros e validação runtime das tools;
- timeout, idempotência, auditoria e budget da IA;
- observabilidade, headers e rate limiting;
- dry run de migração e cutover remoto.

O cutover remoto não pode ser declarado concluído sem URLs Neon, acesso read-only à origem, credenciais Google e Resend.
