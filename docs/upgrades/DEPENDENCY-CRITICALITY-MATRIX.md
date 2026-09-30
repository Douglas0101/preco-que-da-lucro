# Matriz de Criticidade de Dependências

> Fonte única da verdade: [`scripts/dependency-policy.json`](../../scripts/dependency-policy.json).
> Esta tabela é a **leitura** desse arquivo, não uma segunda fonte. Se as duas divergirem, quem
> está errado é este documento — o guard aplica o JSON, não a tabela.

## O que a matriz é

Cada pacote que o produto não pode deixar de ter recebe três coisas:

- **criticidade** — `critical`, `high` ou `medium`, que define o fluxo de aprovação;
- **faixa aprovada** — `min` e `max` **inclusivos** em `major.minor.patch`;
- **motivo** — por que o pacote está na matriz, com a invariante ou seção do plano que o prende.

A faixa vem de `scripts/dependency-policy.json`. Quem a aplica é o guard de atualização
(`npm run guard:upgrade`, implementação em [`scripts/lib/upgrade-guard.ts`](../../scripts/lib/upgrade-guard.ts)),
que compara spec, lockfile e `node_modules` contra ela e reprova o que estiver fora.

## Convenção de faixa: `major.99.99` é coringa

O teto `1.99.99` não significa "a versão 1.99.99". Ele significa **toda a linha do major**: um
componente `99` no `max` é coringa, e a partir dele o teto deixa de discriminar. Sem essa
convenção o arquivo seria ilegível — `@tanstack/react-start` é `1.168.0 .. 1.99.99`, e lido como
trio cru, `min > max`.

Na prática, a faixa é o intervalo semiaberto `[min, próximo major depois do major de min)`.
Para `1.168.0 .. 1.99.99` isso é `[1.168.0, 2.0.0)`: `1.200.0` cabe, `1.99.5` **não** (99 < 168,
ou seja, abaixo do piso), e `2.0.0` não.

## A matriz

| pacote                     | criticidade | faixa aprovada       | política                      | motivo                                                                                                               |
| -------------------------- | ----------- | -------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `drizzle-kit`              | critical    | `0.31.0 .. 0.31.99`  | `^0.31.10` (lock `0.31.10`)   | toolchain de migration; `defineConfig` exigido por `drizzle.config.ts`; INV-012 (migrations reproduzíveis)           |
| `drizzle-orm`              | critical    | `0.45.0 .. 0.45.99`  | `^0.45.2` (lock `0.45.2`)     | ORM; toda query parametrizada e tipada depende dele (INV-001, INV-003, INV-008)                                      |
| `pg`                       | critical    | `8.23.0 .. 8.99.99`  | `^8.23.0` (lock `8.23.0`)     | driver do runtime e das migrations; `pooled`/`direct` importam para PgBouncer em transaction mode                    |
| `@neondatabase/serverless` | critical    | `1.1.0 .. 1.99.99`   | `^1.1.0` (lock `1.1.0`)       | conexão Neon; INV-011 (Neon é substituível) pressupõe o driver estável                                               |
| `zod`                      | critical    | `4.4.0 .. 4.99.99`   | `^4.4.3` (lock `4.5.2`)       | validação runtime de toda tool da IA e dos contratos BFF (INV-014, IA-001 §6.10)                                     |
| `decimal.js`               | critical    | `10.6.0 .. 10.6.99`  | `10.6.0` (lock `10.6.0`)      | aritmética do Financial Engine; regra de rounding muda entre majors e altera resultado financeiro (INV-004, FIN-003) |
| `@tanstack/react-start`    | critical    | `1.168.0 .. 1.99.99` | `^1.168.26` (lock `1.168.49`) | framework em Release Candidate; server functions, cookies e CSP dependem dele (§2.2)                                 |
| `@tanstack/react-router`   | critical    | `1.170.0 .. 1.99.99` | `^1.170.16` (lock `1.170.32`) | rotas e loaders; `beforeLoad` é UX, não fronteira de segurança (§2.1)                                                |
| `react`                    | critical    | `19.2.0 .. 19.99.99` | `^19.2.0` (lock `19.2.8`)     | runtime de UI; refs, ARIA e handlers do design system dependem da versão                                             |
| `react-dom`                | critical    | `19.2.0 .. 19.99.99` | `^19.2.0` (lock `19.2.8`)     | runtime de UI; par com `react` e com o budget de bundle                                                              |
| `better-auth`              | critical    | `1.6.0 .. 1.99.99`   | `^1.6.27` (lock `1.7.2`)      | sessão e cookies; downgrade altera HttpOnly/Secure/SameSite e rotação (AUTH-002..005)                                |
| `@tanstack/react-query`    | high        | `5.101.0 .. 5.99.99` | `^5.101.1` (lock `5.102.8`)   | camada de server state; downgrade costuma trazer query-key e `staleTime` divergentes                                 |
| `vite`                     | high        | `8.0.0 .. 8.99.99`   | `^8.0.16` (lock `8.2.2`)      | bundler e preset Nitro; muda o formato de saída que o deploy consome                                                 |
| `typescript`               | medium      | `5.8.0 .. 5.99.99`   | `^5.8.3` (lock `5.9.3`)       | `typecheck` é gate; um minor pode introduzir erro novo em todo o projeto                                             |
| `vitest`                   | medium      | `4.1.0 .. 4.99.99`   | `^4.1.10` (lock `4.1.11`)     | runner da suíte; matcher ou ambiente mudados alteram o veredito dos testes                                           |

Os 12 pacotes `critical` exigem Downgrade Request aprovado para qualquer rebaixamento. `high` e
`medium` (3 pacotes) geram finding **informativo**, que aparece no relatório do guard mas **não**
reprova o build — a própria mensagem diz isso, para o veredito não ser ambíguo.

## DOMPurify não está na matriz — de propósito

A matriz **não** inclui `dompurify` nem qualquer outra biblioteca de sanitização de HTML, e a
ausência é deliberada, não uma lacuna.

O SEC-001 (XSS no chat) foi resolvido pelo **caminho preferencial** do plano mestre (§6.1), e esse
caminho não tem sink de HTML:

```text
Markdown → parser → AST → componentes React permitidos
```

A implementação está em [`src/lib/chat-markdown.tsx`](../../src/lib/chat-markdown.tsx). O
renderizador produz apenas text nodes e `<strong>`; o React escapa por construção e **não existe
caminho para `dangerouslySetInnerHTML`** em nenhuma hipótese — há teste de regressione em
[`src/test/chat-markdown.test.tsx`](../../src/test/chat-markdown.test.tsx) que falha se essa
propriedade aparecer.

O plano lista "HTML → sanitização → render" como **alternativa**, a usar só se HTML precisasse ser
aceito. Como o caminho preferencial eliminou a necessidade de aceitar HTML, não existe dependência
de sanitização a pinar. Pinar uma faixa para `dompurify` sugeriria que a proteção do chat depende
da versão daquela biblioteca, o que é falso: a proteção é a ausência do sink.

Se um dia o chat passar a aceitar HTML, essa decisão muda e o pacote entra na matriz como
`critical`, no mesmo PR que introduz o HTML.

## O que fica fora da matriz, e por quê

O guard cobre 15 pacotes. O `package.json` declara 63. A cobertura é **de propósito** e vale
declará-la: um guard que finge cobertura total é pior do que um guard que diz onde não olha.

| grupo                                  | exemplos                                                                    | por que fica fora                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Wrapper/adapter de pacote já pinado    | `@better-auth/drizzle-adapter`, `@tanstack/router-plugin`                   | a versão acompanha o pacote `critical` que ela envolve; pinar os dois duplicaria a mesma decisão em dois lugares      |
| Camada de dependência do `better-auth` | `@hookform/resolvers`                                                       | acompanha a linha do `better-auth`, que já é `critical`                                                               |
| Infra de teste e e2e                   | `@playwright/test`, `@testing-library/*`, `jsdom`, `axe-core`, `fast-check` | protegida por construção: uma mudança que quebra o runner aparece como teste vermelho, não como incidente de produção |
| Utilitários sem fronteira              | `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`        | trocar de versão não muda semântica de dado nem de fronteira                                                          |
| Estilização                            | `tailwindcss`, `@tailwindcss/vite`, `tw-animate-css`                        | saída é CSS; o gate de UI stack (`npm run check:ui-stack`) cobre a violação de contrato                               |
| Observabilidade e envio                | `@opentelemetry/*`, `@vercel/analytics`, `resend`, `web-vitals`             | a falha se manifesta como telemetria ausente, não como decisão errada                                                 |
| Infra de build e DX                    | `eslint`, `typescript-eslint`, `prettier`, `tsx`, `nitro`, `jsdom`          | `lint`, `format:check` e `typecheck` já são gates; o guard acrescentaria um segundo lugar para a mesma regra          |

A linha que separa os dois grupos é: **o pacote está na matriz quando um downgrade dele pode
produzir um resultado errado ou uma fronteira de segurança quebrada sem que nenhum teste
existente fique vermelho.** `decimal.js` está dentro (rounding muda o resultado financeiro) e
`tailwind-merge` está fora (mesma saída, sem fronteira) — é a mesma pergunta nos dois casos.

## Como a matriz é exercida

```bash
npm run guard:upgrade
```

O guard confere, por pacote: estrutura da política, presença no `package.json`, faixa da spec,
versão resolvida no lockfile, versão instalada em `node_modules` e rebaixamento contra o `HEAD`.
Saída JSON em stdout; código de saída `0` (pass), `1` (violação) ou `2` (precondição — política
ausente/malformada, manifest ilegível, git indisponível). A política de aprovação e o fluxo de
Downgrade Request estão em [`UPGRADE-POLICY.md`](./UPGRADE-POLICY.md).
