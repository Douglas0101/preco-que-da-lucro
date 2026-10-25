# Fase 4 — chat no staging com branch Neon efêmera: BLOCKED

## Status

**Nada foi executado.** Não há branch Neon criada, não há env de staging alterada, não há redeploy, não há teste autenticado e não há violação de CSP medida. A frase de autorização exigida pelo prompt não foi recebida:

> “Aprovo o teste do chat no staging com branch Neon efêmera.”

## Estado medido que condiciona o plano

| Item            | Medição                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Staging         | `staging.diretrizprecifica.com` → `dpl_7cdy` (`develop@12de0bf`), **302** para Vercel Authentication no acesso anônimo |
| CSP             | `Content-Security-Policy-Report-Only`, `script-src 'self'`, **sem nonce** (`src/lib/security-headers.ts`)              |
| ADR-043         | §Decisão 1: **não** introduzir nonce; `src/test/security-headers.test.ts:93` trava `not.toContain("nonce-")`           |
| MessageScroller | usa style attribute dinâmico; sob report-only não é bloqueado, mas pode gerar relatório                                |
| Neon produção   | 20 migrations; **nunca** alvo de teste                                                                                 |
| Base de fixture | `ci-fixture-base` (`br-wandering-sky-ayxm5e5s`), zero linhas, permanente; filhos `parent-data` são zero-row            |
| Auth            | login humano Via A ou usuário sintético semeado no branch efêmero                                                      |

## Por que a premissa de nonce do prompt não vale

O prompt afirma que “o shadcn documenta que o MessageScroller aceita nonce quando há CSP”. Neste repositório a decisão é o oposto: a ADR-043 decidiu **não** usar nonce, a CSP é estática e a política está em report-only. Introduzir nonce para “fazer o teste passar” violaria três travas (ADR-043, `security-headers.ts`, teste) e o contrato de segurança. O teste deve medir o comportamento **sob a política vigente**, não mudar a política para o teste.

## Plano correto (quando G4 for aprovado)

1. **Criar branch efêmera** no projeto Neon `damp-forest-57346541` como filha `parent-data` de `ci-fixture-base` (zero linhas), com TTL de 24 h e nome identificando a execução. Nunca filha de `production`.
2. **Aplicar migrations + seed sintético** na branch (`npm run db:migrate` + seed de auth/E2E), sem dados de produção. Verificar `app_runtime` e RLS com o probe.
3. **Criar um preview novo** a partir de `develop` (não reutilizar `dpl_7cdy`) com `DATABASE_URL`/`DATABASE_ADMIN_URL` apontando para a branch efêmera. Env de Vercel é imutável por deployment: “apontar o staging” exige um deployment novo, não um patch no existente.
4. **Executar Playwright autenticado** contra a URL do preview novo:
   - login com usuário sintético (Via A ou credencial de teste já suportada por `E2E_AUTH_*`);
   - abrir `/novo-produto`;
   - enviar uma mensagem e verificar `scrollAnchor`, composer e ausência de `csp.violation`;
   - coletar console e `report-to` (`/api/csp-report`) durante a sessão;
   - nenhum produto persistido fora da branch efêmera.
5. **Coletar evidência bruta** (console, respostas, screenshot redigido) antes de qualquer cleanup.
6. **Cleanup sempre**: deletar o preview e a branch Neon; provar ausência com GET 404; registrar identidade e timestamp. Falha de cleanup é falha do teste, não aviso.

## Critérios de aceite (a medir, não presumir)

- [ ] Branch efêmera criada, identificada e com TTL.
- [ ] Migrations + RLS probe verdes na branch.
- [ ] Preview novo serve o chat autenticado.
- [ ] Mensagem enviada e `MessageScroller` funcional (scrollAnchor/composer).
- [ ] **Zero** `csp.violation` no console e no endpoint de relatório durante a janela.
- [ ] Branch deletada com prova 404.
- [ ] Produção intocada (nenhuma query de escrita, nenhum alias movido).

## Riscos

- A janela de teste pode revelar violações de CSP que a ADR-043 já declarou (2× `<script>` inline do SSR; style attribute do MessageScroller). Sob report-only elas não bloqueiam, mas o aceite “zero violações” pode falhar — e isso é um achado, não um motivo para afrouxar a CSP.
- Criar preview novo consome build/cota e pode exigir envs de auth/IA; sem `DEEPSEEK_API_KEY` o chat não responde de verdade.
- O prompt mistura “staging” com “preview”: o alias de staging é um deployment preview fixo; não é um ambiente mutável.
- A branch Neon filha da base vazia não tem dados; sem seed, o chat não tem tenant/produto para operar.

## Gate

> **G4:** “Aprovo o teste do chat no staging com branch Neon efêmera” — autoriza somente os passos 1–6 acima, com cleanup obrigatório e sem tocar produção.
