# Grant repair - 2026-09-08T00:39:36.456Z

- source branch: `br-snowy-violet-aymcvvvv` · target branch: `br-solitary-breeze-ayxae7tq` · target-kind: `drill-branch`
- modo: APPLY em branch efemera | read-only source: true
- motivo: C-02 A2 grant repair: roles-before-grants in fresh drill branch
- resultado: **PASS** | current role do alvo: `neondb_owner`
- roles requeridas antes de grants: ["app_runtime","authenticated","neondb_owner"]
- roles ausentes no alvo: [] · mismatches: []
- grants: source=367 | target_before=189 | missing=178 | extra=0 | mismatched=0
- statements: 179 · sha256 SQL: `05647429a34ccc83b868c73f26548dc1e64ddab443986fc0bc9f066f8d164c72`
- comparacao apos reparo: {"pass":true,"tables_compared":27,"failures":[]}

O artefato nunca cria senha, owner privilegiado ou role LOGIN ausente; roles LOGIN/privileged faltantes exigem provisionamento externo antes dos grants.
