# B3 · HIGIENE DO LISTENER `127.0.0.1:4173` (preview obsoleto com CSP enforçada)

**Artefato de preparação — 2026-09-19.** **NÃO executado** por esta sessão (sandbox).
O namespace de rede **é compartilhado**, então os fatos abaixo foram medidos diretamente; a
**identificação do dono** não foi (exige `pid → cwd → env`, impossível com PID namespace isolado).

## 1. Fato medido (2026-09-19)

```console
$ curl -s -D - -o /dev/null http://127.0.0.1:4173/
content-security-policy: default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none';
  form-action 'self'; img-src 'self' data: https:; font-src 'self' data:; style-src 'self';
  script-src 'self'; connect-src 'self' https:; report-uri /api/csp-report; report-to csp-endpoint
```

| observação     | valor                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Porta          | `127.0.0.1:4173` **responde** (`http=200`, `content-type: text/html`)                                                            |
| Header emitido | **`content-security-policy`** — ou seja, **ENFORÇADA** (não `…-report-only`)                                                     |
| Build servido  | HTML referencia `/assets/styles-tfPeBWr4.css`, que **existe** em `.output/public/assets/` do repo ⇒ é um build **deste** projeto |
| Portas irmãs   | `4273` e `5432` **não responderam** (`http=000`) nesta sessão                                                                    |
| Docker         | daemon **inacessível** ⇒ estado do container `:5432` (H-9) não verificável                                                       |

## 2. Risco (por que isto importa)

1. **Medição falsa do §20.1 / CSP.** A suíte e2e e as baterias de computer-user esperam CSP em
   **Report-Only** (o default de `src/lib/security-headers.ts`; `CSP_ENFORCE=true` é que troca o header).
   Um processo com `CSP_ENFORCE=true` respondendo na porta default faz **qualquer sonda de header medir o
   processo errado**. É exatamente a armadilha **C-1 do ciclo 3**, já medida e registrada no ledger
   (§NAS-2 ciclo 3: _"a porta default do harness (4173) estava ocupada por um `nitro preview` do repo
   principal apontando para `:5432` … os primeiros probes de header foram respondidos por **esse**
   processo (build antigo, `CSP_ENFORCE=true`)"_).
2. **Ambiente contaminado.** Se o processo herdou `DATABASE_URL`/`DATABASE_URL_UNPOOLED` de produção
   (o achado **B-3** do ciclo 3 registra exatamente esse risco), ele é uma superfície que nenhuma trilha
   controla.
3. **Falso positivo de "app no ar".** Um preview respondendo 200 na porta default pode ser confundido com
   o alvo do dia-D — que na verdade está em **placeholder PHP** (`/ready` e `/live` ⇒ 404).

## 3. Ação host-visible

```bash
# 1) quem é o dono
ss -ltnp 'sport = :4173' 2>/dev/null || lsof -nP -iTCP:4173 -sTCP:LISTEN

# 2) identidade do processo (o protocolo do projeto exige provar antes de agir)
pid=<PID>
echo "cwd=$(readlink -f /proc/$pid/cwd)"
tr '\0' '\n' < /proc/$pid/environ | grep -E '^(DATABASE_URL|DATABASE_URL_UNPOOLED|CSP_ENFORCE|NODE_ENV|PORT)=' \
  | sed 's/=.*/=<valor-omitido>/'
ps -o pid,ppid,etime,cmd -p "$pid"

# 3) se for preview obsoleto (build antigo, sem dono de trilha ativa) ⇒ encerrar
kill "$pid"        # preferir SIGTERM; só usar SIGKILL se não houver alternativa
```

**Critério de decisão:**

| veredito            | condição                                                                                       | ação                                           |
| ------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **obsoleto**        | dono é preview/node sem trilha ativa; `cwd` é este repo; processo mais antigo que o HEAD atual | encerrar e registrar                           |
| **de trilho ativo** | pertence a um trilho do ciclo 6 em execução legítima                                           | **não** encerrar; registrar o dono no journal  |
| **indeterminado**   | não foi possível provar `cwd`/`env`                                                            | **não** encerrar; registrar como indeterminado |

## 4. Regra de contenção

- **Nada é morto a partir do sandbox desta sessão.** Este artefato é texto; a execução exige
  visibilidade de host e decisão humana/MAESTRO.
- Ao encerrar, registrar no journal (§6 eventos de infra) com PID, `cwd` provado e horário UTC.
- Se o processo **não** for encerrado, toda medição futura de CSP/§20.1 deve **provar a identidade do
  servidor** (`pid → cwd → env`) antes de capturar — regra já adotada no ciclo 3.
