# Pré-A4 — critérios antes da execução (2026-09-05)

| Requisito                                               | Fonte                          | Verificação                                                | Estado inicial                                |
| ------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------- | --------------------------------------------- |
| Credenciais segregadas, ausência de órfãs live          | ADR-021 Gates; DB-02/SEC-01    | mapa de consumidores + revogação no emissor                | VIOLAÇÃO; arquivo ausente não prova revogação |
| Backup/restore testado                                  | Plano Mestre §42               | snapshot nativo, restore em branch, contagens/checksums    | DESCONHECIDO nesta execução                   |
| RPO <=15min / RTO <=4h                                  | SDD §6.4 NFR-RES-003           | idade do ponto recuperável / tempo da recuperação completa | VIOLAÇÃO; controle operacional incompleto     |
| Backup criptografado/imutável independente              | SDD NFR-RES-004; §16.6         | custódia, retenção, restore fora do projeto                | VIOLAÇÃO; requer provisionamento separado     |
| Auth/RLS/migrations após restore                        | SDD NFR-RES-005; §16.6         | comparação catálogo + execução como app_runtime + Auth     | DESCONHECIDO                                  |
| PITR >=7d ou alternativa RPO <=15min; backup diário 35d | SDD §16.6                      | configuração e evidência operacional                       | VIOLAÇÃO; retenção atual 6h                   |
| Não ressuscitar exclusões                               | SDD NFR-PRIV-006; §16.6        | reaplicar manifesto/ledger antes da promoção               | DESCONHECIDO                                  |
| Destino livre de fixtures                               | ADR-021; DB-01; autorização A3 | manifesto, ensaio, SQL, recontagem                         | VIOLAÇÃO                                      |
| Paridade/origem decidida                                | ADR-021 §6; M02-D-008          | memo e assinatura G1                                       | DESCONHECIDO                                  |
| Sucedente de Storage                                    | M02-D-006 / EM-01              | ADR e assinatura G2                                        | GAP-DOC                                       |
| A4/A5 e rollback                                        | ADR-021 §7-9; Plano §42        | hPanel 11/11; smoke; 0h/24h/72h                            | DESCONHECIDO; sem runtime                     |
| B3/B4                                                   | Plano §46; ledger S8           | 14 dias com amostra e cobertura                            | DESCONHECIDO; não iniciado                    |
| Gates de evolução preservados                           | Plano §39/§43/§44              | roadmap; atestação só decommission                         | CONFORME por decisão de planejamento          |

## ESTADO DO SUBSTRATO

| Dimensão | Estado                                                                          |
| -------- | ------------------------------------------------------------------------------- |
| Tráfego  | Não existe runtime publicado segundo briefing e ledger; hPanel não homologado   |
| Neon     | Alvo explícito damp-forest-57346541 / br-snowy-violet-aymcvvvv / neondb         |
| Paridade | DESCONHECIDO; G1 pendente                                                       |
| Blockers | DB-01; DB-02/SEC-01; BAK-01; G1/G2; hPanel; Sonar; provisionamento independente |
