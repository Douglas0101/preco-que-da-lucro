# Estratégia de chaves e credenciais

- **Para que serve:** dizer **onde cada credencial vive**, quem a consome, o que a rotação exige, e
  qual é a única regra de manuseio que sobreviveu a um incidente real.
- **Escopo:** as credenciais de operação do projeto. Não é um cofre e não guarda valor nenhum —
  **nenhum valor, prefixo, sufixo, tamanho ou hash de credencial aparece aqui**, só nomes.
- **Dívida que rege este documento:** `DBT-36` (`ABERTA`, `P0-DEFERRED` por decisão do MAESTRO no
  Ciclo 19).

---

## 1. As seis credenciais

| #   | credencial     | onde vive                            | quem consome                                          | o que a rotação exige                                                                  |
| --- | -------------- | ------------------------------------ | ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | **Neon API**   | cofre local (`Keys.txt`, gitignored) | operações de branch/banco via API e MCP               | emitir nova chave, reprovar a antiga por código, provar `200` no novo e `401` no velho |
| 2   | **Vercel API** | cofre local                          | inspeção de deploys e domínios                        | idem, com o escopo de time correto — o token atual não alcança o projeto               |
| 3   | **GitHub PAT** | cofre local **e** gateway MCP        | automação de PR/release e o servidor MCP do GitHub    | idem, e **remover o literal do arquivo de config do MCP** (é o passo que falta)        |
| 4   | **Sonar**      | cofre local **e** secret de Actions  | `sonar-scanner` no CI (`.github/workflows/sonar.yml`) | idem; depois de rotacionar, **atualizar o secret `SONAR_TOKEN`**                       |
| 5   | **Context7**   | cofre local                          | consulta de documentação de bibliotecas               | idem                                                                                   |
| 6   | **DeepSeek**   | cofre local                          | **nada no código hoje** (`deepseek` = 0 ocorrências)  | idem — e decidir se a chave deve existir antes de haver consumidor                     |

O cofre é um arquivo de texto na raiz do repositório, com permissão restrita e ignorado pelo git.
**Ele não é versionado e não pode ser.** O sidecar (abaixo) é o caminho para tirar os valores dele.

---

## 2. A regra que sobreviveu ao incidente

**A inspeção _cuidadosa_ de um arquivo de segredo é ela mesma a superfície de exposição.**

Em 2026-09-30 (Ciclo 18), um agente montou um `sed` para imprimir **apenas os rótulos** do arquivo de
cofre, assumindo o formato `chave=valor`. O formato real é **`<valor> - <rótulo>`** — o redactor não
casou nada e **imprimiu as seis linhas inteiras**, levando seis valores vivos para dentro do contexto
do agente. Nada foi gravado em arquivo, commit ou artefato, e nenhum valor foi usado; mas os valores
estão no transcript daquela sessão e **têm de ser tratados como comprometidos**.

O que se aprendeu não é "redija com mais cuidado". É:

> **A regra é não abrir o arquivo.**
> Um redactor escrito às cegas erra o formato e **falha aberto** — o modo de falha de um filtro
> errado é _mostrar_, nunca _esconder_. Não existe "olhar só um pouquinho" que seja seguro, porque a
> segurança do olhar depende de um palpite sobre o formato do arquivo, e o palpite erra.

Consequências operacionais diretas:

- Ferramentas que precisam do valor **recebem o valor pelo ambiente ou por stdin**, nunca por leitura
  do arquivo no contexto do agente (é assim que o secret de CI foi definido e é assim que o sidecar
  opera).
- Quem precisa saber **quais** credenciais existem consulta **este documento**, não o cofre.
- A varredura de vazamento (`m02:secrets-audit`) e o sidecar trabalham por **nome, referência e
  sha256** — nunca por valor.

---

## 3. Rotação cega (o procedimento)

O mecanismo já existe e está provado; o que falta é a **execução**, não a ferramenta:

- **Sidecar cego** — `scripts/secret-sidecar/` · decisão em
  `docs/adr/ADR-031-sidecar-cego-injecao-segredos.md`. Guarda e injeta o valor sem que ele atravesse
  a fronteira de texto do agente; o log de auditoria é append-only e registra `{ts, op, ref, sha256,
outcome, audit_id}` — **hash, nunca valor**. Autoteste provado com **5 segredos fictícios** contra
  os dois backends (memória e Secret Service real).
- **Procedimento** — `docs/runbooks/secret-rotation-blind.md`.
- **Critério de fechamento de cada credencial** — o par `test_endpoint` devolvendo **200 no valor
  novo** e **401 no valor antigo**, com o par gravado na denylist e o valor antigo removido do cofre.

---

## 4. Estado honesto

| item                     | estado                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------ |
| `DBT-36` (rotação das 6) | **ABERTA · `P0-DEFERRED`** — adiada por decisão do MAESTRO no Ciclo 19, com gatilhos de retomada |
| Mecanismo (sidecar)      | **provado** — não é o bloqueio                                                                   |
| Bloqueio real            | não há **endpoint alcançável** para provar `200`/`401` por credencial em todos os casos          |
| Agravante                | o incidente do §2 põe os seis valores no transcript de uma sessão                                |

**O que fecharia a `DBT-36`:** para cada uma das seis credenciais, o par `200`/`401` medido contra o
endpoint real, com o valor antigo revogado e removido do cofre. Enquanto isso não acontece, a
posição correta é a declarada — **não** "em dia".

---

## 5. O que este documento deliberadamente não contém

Valores, prefixos, sufixos, comprimentos exatos, hashes, capturas de tela de tela que renderize
segredo, e qualquer caminho que leve a eles. Se você precisa de um valor, o caminho é o sidecar —
não este arquivo, e não o cofre aberto no seu contexto.
