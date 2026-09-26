# Pedido ao MAESTRO — exceção de verificação de senha convertida em "senha errada" (`DBT-26`)

> **Por que este arquivo existe e não uma edição no registry:** `DEBTS.md` é do MAESTRO. Este é o
> pedido auditável, com closure test executável. A produção **não** foi editada: a Fase C é de
> verificação, e mudar o veredito de senha é decisão humana.

- **Solicitante:** agente supervisionado, ciclo `SDD-20260925-contract-guard` (Fase C, fatia de invariantes)
- **Data:** 2026-09-25
- **Achado:** `src/server/auth/password.server.ts:19`

## 1. O que o código faz hoje

```ts
export async function verifyPassword(input: { hash: string; password: string }): Promise<boolean> {
  try {
    if (BCRYPT_PREFIX.test(input.hash)) {
      /* … */ return await compare(input.password, normalized);
    }
    return await verifyScrypt(input);
  } catch {
    return false; // ← src/server/auth/password.server.ts:19
  }
}
```

Qualquer exceção de `bcryptjs` ou de `better-auth/crypto` vira `false`, **indistinguível de senha
errada**. Um hash corrompido, um algoritmo legado, uma dependência quebrada em runtime ou um
`input.hash` malformado produzem o mesmo resultado de "usuário digitou a senha errada".

## 2. O que **não** é — para não exagerar o achado

- **Não é bypass de autenticação.** O código falha **fechado**: o acesso é negado. Um atacante não
  ganha nada com isso; a direção do erro é a segura.
- **Não é regressão introduzida neste ciclo.** O `catch` é anterior; a Fase C apenas o tornou visível.

## 3. O que é — e por que é defeito

O plano §1 é explícito: _"Nenhuma otimização de performance deverá mascarar um cálculo incorreto,
uma falha de autorização ou um erro silencioso."_ Aqui o erro de infraestrutura é mascarado por um
veredito de negócio, e o operador **não tem como saber qual dos dois aconteceu**:

- usuário com hash ilegível fica num laço de login sem sinal, e o log de autenticação não distingue
  erro de infraestrutura de credencial inválida;
- uma regressão em `bcryptjs`/`better-auth` se manifesta como "todo mundo esqueceu a senha", que é a
  leitura mais cara de diagnosticar e a mais fácil de ignorar;
- a seção **32 (matriz de segurança)** do plano não tem linha para "erro de verifier", porque ela não
  previa que houvesse essa confusão — a linha que falta é esta.

`src/server/auth/auth-policy.ts` mostra que o repositório **sabe** tratar erro como sinal explícito:
os `catch` de lá viram `{ verdict: "invalid", detail }`, nunca um valor benigno. O path de senha é a
exceção.

## 4. Por que a Fase C não corrigiu

Trocar `boolean` por um resultado discriminado é mudança de assinatura em caminho de autenticação, e
`verifyPassword` tem chamadores. A Fase C foi definida como verificação e teste; a correção muda
comportamento observável e precisa de decisão sobre **o que a UI e o log de autenticação fazem com o
novo caso**.

## 5. Linha proposta

```text
id: DBT-26
origem: Fase C varredura de catch · `SDD-20260925-contract-guard` · `src/server/auth/password.server.ts:19`
classe: robustez
severidade: média
closure test: src/test/auth.password-verify.test.ts — (a) senha errada com hash válido devolve
  credencial-inválida; (b) hash corrompido devolve erro-de-verificador DISTINTO, nunca o mesmo
  resultado de (a); (c) o caminho de erro registra sinal com o motivo e NUNCA serializa o valor do
  hash; (d) o teste falha se alguém voltar a converter exceção em `false` — controle negativo por
  mutação, não por ausência de exceção no código de produção. O guard de contratos NÃO serve como
  closure aqui: a superfície dele é a fronteira BFF, e estendê-la para varrer `src/server/auth/`
  transformaria um guard de borda em inventário do repositório.
evidência: docs/evidence/finance-result-invariants.md §3.1
status: ABERTA
```

## 6. Decisão que cabe à MAESTRO

| opção                                        | consequência                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| corrigir agora, nesta branch                 | aumenta o diff de uma branch que hoje é só verificação; a assinatura muda e o chamador precisa ser adaptado |
| dívida `ABERTA` e correção em branch própria | mantém a branch coesa; a dívida fica sob custódia de closure test                                           |
| aceitar como está                            | **registrada como tal**, com o risco nomeado: diagnóstico caro de falha de infraestrutura de autenticação   |

Recomendo a segunda. O que **não** recomendo é deixar sem registro: um `catch` que transforma erro
em veredito de negócio é exatamente a classe que este programa se propõe a não normalizar.
