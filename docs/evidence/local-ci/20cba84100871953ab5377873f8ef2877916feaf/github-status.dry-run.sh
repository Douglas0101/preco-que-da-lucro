# Dry-run — NADA foi postado. Para postar: LOCAL_CI_POST_STATUS=1 LOCAL_CI_APPROVED=1
# Contexto sempre distinguivel do CI oficial: local-ci/supervised
gh api -X POST repos/Douglas0101/preco-que-da-lucro/statuses/20cba84100871953ab5377873f8ef2877916feaf \
  -f state=success \
  -f context=local-ci/supervised \
  -f description='CI local supervisionado (nao e o CI oficial)'
