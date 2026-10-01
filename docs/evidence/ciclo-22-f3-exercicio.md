# Ciclo 22 — F3: exercício do gatilho `pull_request` do `sonar.yml`

Documento de exercício. A PR que o contém é **descartável**: existe para exercitar o gatilho
`pull_request` do workflow Sonar e o seu controle negativo, e é fechada sem merge.

**Por que a PR é para `develop` e não para `main`:** `origin/main` **não tem** `sonar.yml` (medido) —
os 7 PRs abertos vão todos para `main` e nenhum deles exercita o gatilho.

**Por que o exercício vem DEPOIS do fix de atribuição:** uma PR analisada sem
`sonar.pullrequest.key/branch/base` produziria análise de branch gravada como `main` — verde com a
atribuição errada.
