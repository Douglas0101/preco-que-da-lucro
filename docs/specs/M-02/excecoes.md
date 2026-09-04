# Allowlist M-02

| Categoria | Caminhos permitidos                                       | Condição                            |
| --------- | --------------------------------------------------------- | ----------------------------------- |
| health    | `src/routes/api/health/**`                                | probe operacional sem domínio       |
| auth      | `src/middleware/request-context.ts`, `src/server/auth/**` | identidade, membership e rate limit |
| infra     | `src/db/**`, `scripts/**`, `.migration/**`                | tooling/migrations, nunca UI        |

`src/lib/*.functions.ts`, services e tools de domínio não possuem exceção de persistência.
Clientes AI podem importar clientes HTTP externos, mas não DB/schema.
