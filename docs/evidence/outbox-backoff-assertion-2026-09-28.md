# Defeito do outbox — a asserção comparava relógios de transações diferentes (2026-09-28)

> **O que este documento é.** O registro do defeito que reprovou o job
> `Branch efêmera · migrate · integração · RLS probe · E2E` do PR #49, com a
> causa medida, a correção, e os controles que provam que a correção é mais forte
> e não mais frouxa. Nenhuma linha de produção foi alterada.
>
> **Nível de evidência:** local, contra container PG17 efêmero
> (`preco_que_da_lucro-postgres`), com o job de CI **vermelho** como reproduzedor
> original. Um run vermelho não é veredito permanente — é o sintoma, e aqui foi
> usado como tal.

## 1. O sintoma, verbatim

```
AssertionError [ERR_ASSERTION]: o backoff padrão agenda o futuro
false !== true
    at t4FailureBackoff (scripts/db/test-outbox.ts:702:10)
```

`test-outbox.ts:145` produzia o booleano com

```sql
available_at > now() as "scheduledForLater"
```

e a linha 702 o asseverava. O job que falha é o **tier de `db:test`** do
`Neon PR branch CI`; o `verify` do `UI stack` do mesmo PR está `SUCCESS`, o que é
coerente — o tier só dispara quando o diff toca a superfície de dados.

## 2. Hipótese inicial (e ela estava errada)

A leitura natural, e a que o brief trazia pronta, era "backoff de 1.000 ms
competindo com uma margem de 1 s em runner sob carga". Daívinham duas saídas
nominadas: _fake timers_, ou subir a margem para 5 s.

**As duas estão erradas, e por motivos diferentes:**

- A suíte `db:test` **não** é vitest. É `scripts/db/test-outbox.ts`, executado
  por `tsx` com `node:assert`, contra um Postgres real. Não existe `vi` ali. E
  _fake timers_ governam o `Date` do JavaScript — o carimbo vem do
  `now()` do PostgreSQL, que _fake timers_ não alcançam.
- Subir a margem para 5 s é **afrouxar uma asserção para forçar o verde**, vedado
  por `AGENTS.md`. E não seria confiável (só move o cliff de 1 s para 5 s) nem
  informativo (aceita tanto um backoff de 1 ms quanto de 60 s).

## 3. Causa raiz, medida

`src/server/repositories/outbox.repository.ts:216` grava

```sql
available_at = now() + make_interval(secs => <backoff>)
```

e o `now()` do PostgreSQL é `transaction_timestamp()`: **congelado** enquanto a
transação vive. O teste, porém, lia a linha numa transação **depois**. A
inequaldade `available_at > now()` confrontava o relógio de uma transação com o de
outra, e só valia se a segunda começasse menos de `backoff` depois da primeira.

Sonda executada contra o container local, reproduzindo as duas SQL exatas:

| intervalo entre as 2 transações | `available_at > now()` | offset gravado |
| ------------------------------- | ---------------------- | -------------- |
| 12 ms                           | `true`                 | 1000,9 ms      |
| 220 ms                          | `true`                 | 1000,9 ms      |
| 1123 ms                         | `false`                | 1000,9 ms      |
| 2226 ms                         | `false`                | 1000,9 ms      |
| 3729 ms                         | `false`                | 1000,9 ms      |

E, dentro de **uma** transação, atravessando 1202 ms de relógio de parede:

```
now()            drift =    0 ms   (timestamp de transação)
clock_timestamp() drift = 1202 ms   (relógio de parede)
```

**O offset gravado é 1000,9 ms em todas as execuções.** O valor estava sempre
certo; a comparação é que não se sustenta. Não era jitter de agendamento: era uma
comparação entre relógios de transações diferentes, que falha por construção
conforme o alvo se afasta. Daí passar contra o Postgres local (12 ms de folga) e
quebrar contra uma branch efêmera do Neon (TLS, conexão de pool, três suítes antes).

## 4. A correção

`available_at` tem de cair na janela

```
t_antes ≤ t_escrita ≤ t_depois   ⇒   available_at ∈ [t_antes + backoff, t_depois + backoff]
```

com `t_antes` e `t_depois` lidos do banco. A janela **alarga** com a latência em
vez de estreitar, então vale em qualquer alvo. Some-se a isso uma checagem
**comportamental** — `claimed === 0` numa nova chamada do worker, logo após a
falha — que prova a propriedade §23 ("não é retomado durante a janela") sem
depender de relógio, e que o `t4:2` não tinha.

`scheduledForLater` saiu do `EventState`. **Nenhum arquivo de produção foi
alterado**: `outbox.worker.ts` está byte-idêntico ao HEAD, restaurado por
`sha256sum -c` depois das mutações de controle.

### Um defeito meu, achado pelo próprio controle

A primeira versão da correção carregava **duas** asserções: a janela de offset e
uma guarda anti-retry-storm `available_at > agora`. A segunda é **a mesma classe
de defeito com outro limiar** — compara o valor contra uma leitura _posterior_.
O controle de latência a pegou: com 1500 ms injetados ela acusava `retry storm`
sobre um agendamento perfeitamente correto. Ela foi removida, e a propriedade que
pretendia proteger ficou provada por comportamento. Registrado aqui porque o
controle existiu para isso, e porque um teste que "endurece" pode carregar a mesma
falha que ele supostamente corrige.

## 5. Controles executados

| #   | Controle                                                  | Resultado                                                                                               |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| A   | 1500 ms injetados entre a escrita e a leitura             | T4 **verde** — a latência que reprovava o job não reprova mais                                          |
| B   | Checagem comportamental com a janela de 1 s expirada      | **reprova** (`dentro do backoff padrão o evento não é retomado`) — não é vacuosa                        |
| C   | `BACKOFF_BASE_MS` 1.000 → **3.000** (mutação em produção) | **reprova**: `offset agendado 3000,6 ms fora da janela [1000, 1011,9] ms`                               |
| D   | Mesma mutação, forma **antiga** em uso                    | **passa**, exit 0 — a nova asserção é estritamente mais forte                                           |
| E   | Descoberta por `grep`                                     | `available_at > now()` em **um** SQL, consumido por **dois** asserts (`:659`, `:702`); ambos corrigidos |

O controle D é o que fecha o argumento: `3 s > agora` continua sendo verdade, então
a forma antiga não tinha como enxergar a mudança. A nova enxerga, e diz qual valor
esperava e qual encontrou.

## 6. Gate

- `npm run db:test` completo: **exit 0**, 17 suítes em cadeia.
- `scripts/db/test-outbox.ts`: **5 execuções consecutivas**, 5/5 (T1–T5) em cada.
- `npx tsc --noEmit`: exit 0.
- `m02:debts-guard`: exit 0, 26 dívidas, com `DBT-27` registrado e o closure test
  descrito acima.

## 7. Limites declarados

- **Ordem dentro da janela.** A checagem comportamental depende de ser chamada
  dentro da janela do backoff. Ela é chamada imediatamente depois da falha, e a
  folga é o backoff inteiro (1 s contra ~12 ms de custo observado localmente). Não
  é um "aumento de timeout": é o prazo que a política já impõe ao retry. Ainda
  assim é a única asserção do arquivo com orçamento de relógio, e isso está dito
  no código.
- **`BACKOFF_BASE_MS` é espelhado** como constante no teste, para que a asserção
  tenha um valor independente da implementação que ela verifica. Mudar a política
  de produção passa a reprovar o teste — que é o ponto, e a contrapartida é que a
  mudança de política exige mudança aqui.
- **Não medido:** a latência real do caminho até a branch efêmera do Neon. A
  correção não depende desse número, e é por isso que ela é a certo; mas o número
  em si continua desconhecido, e ninguém deve citá-lo.
- **Superfície não coberta:** a branch efêmera do Neon não foi exercitada com a
  correção. O que se tem é o job vermelho **antes** e o controle de latência
  **depois**, no local.
