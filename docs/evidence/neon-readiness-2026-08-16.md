# G3 — Neon readiness — 2026-08-16

## Resultado

**BLOQUEADO por credenciais ausentes.** Nenhuma conexão Neon, branch
ephemeral, migration, drift, RLS ou smoke foi executado neste ciclo.

## Verificação sanitizada

- O workflow exige `secrets.NEON_API_KEY` e `vars.NEON_PROJECT_ID`.
- A verificação do ambiente local encontrou ambos ausentes.
- A consulta dos nomes de secrets/variables do repositório não encontrou
  nenhum nome `NEON_*`.
- O workflow `31991005108` registrou a detecção de configuração e o boundary;
  as etapas de checkout, criação de branch Neon, instalação, migration, drift
  e exclusão da branch ficaram `skipped`.
- Não é possível inferir, apenas por essa consulta, se há credenciais em nível
  de organização ou ambiente; o próprio runtime, porém, não recebeu os dois
  valores necessários.

## Como desbloquear com segurança

1. Disponibilizar `NEON_API_KEY` como secret e `NEON_PROJECT_ID` como variable
   pelo canal seguro de CI/ambiente; nunca colar valores em issue, prompt,
   log, commit ou evidência.
2. Executar o workflow de preview sem alterar produção.
3. Validar conexão administrativa direta e runtime pooled separadamente,
   migrations, drift zero, RLS, smoke autenticado e redaction.
4. Registrar somente status, SHA, IDs de run e resultados sanitizados.

## Critérios de aceite

G3 só passa com conexão real verificável, migration aplicada/reproduzível,
drift zero, RLS e smoke aprovados, sem skips nas etapas substantivas e sem
segredos expostos.
