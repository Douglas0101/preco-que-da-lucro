# Mapa Operacional — Diagramas Canônicos (D1–D10)

**Propósito.** Dez diagramas normativos em três camadas — **Plataforma (D1–D3)**, **Processo (D4–D6)** e **Segurança (D7–D10)** — que operacionalizam, em forma executável, os contratos do `AGENTS.md` e dos ADRs. Cada losango é um gate: **um push, query ou promoção que viole um losango é bug do agente**, não interpretação.

**Precedência.** Em caso de divergência, **o `AGENTS.md` e os ADRs vencem**. Este mapa não cria política nova: ele deriva, conecta e registra o estado (verificado × pendente) — e é atualizado no **mesmo commit** de qualquer mudança no `AGENTS.md`, num ADR ou no código que ele retrate.

**Estado vivo.** O estado corrente (o que está verificado e o que é pendência nomeada) fica na **§6 — Estado e pendências**; o roadmap das otimizações referenciado por D5/D6 vive em `docs/evidence/otimizacoes-planejamento/PLANEJAMENTO.md`.

**Correções de reconciliação aplicadas a este mapa (2026-10-16).** Primitivas reais de RLS (`app_private.current_user_id()` / `app_private.current_tenant_id()` sobre `current_setting('app.current_*')`; role `app_runtime` NOSUPERUSER/NOBYPASSRLS — migration `0001_p0_runtime_role_and_rls.sql`); `FORCE ROW LEVEL SECURITY` **não existe hoje** no schema (0 ocorrências em `drizzle/*.sql`) e entra como defesa adicional pendente, não como gate vigente; endpoint pooled do Neon distingue-se pelo **host `-pooler`** (a URI canônica fixa `:5432`), não por porta `:6432`; o contrato TLS é a allowlist validada **`{sslmode, channel_binding}` com default `sslmode=require`** (a elevação a `verify-full` é decisão pendente, nunca edição de prosa).

## Índice

- [1. Vínculos com o AGENTS.md](#1-vínculos-com-o-agentsmd)
- [2. Plataforma — D1–D3](#2-plataforma--d1d3)
  - [D1 — Vercel · ciclo de vida do deployment](#d1--vercel-·-ciclo-de-vida-do-deployment)
  - [D2 — Neon · arquitetura de conexão](#d2--neon-·-arquitetura-de-conexão)
  - [D3 — A ponte entre Vercel e Neon · health/ready](#d3--a-ponte-entre-vercel-e-neon-·-healthready)
- [3. Processo — D4–D6](#3-processo--d4d6)
  - [D4 — Ciclo CI/CD](#d4--ciclo-cicd)
  - [D5 — Roadmap das ondas](#d5--roadmap-das-ondas)
  - [D6 — Grafo de dependências](#d6--grafo-de-dependências)
- [4. Segurança — D7–D10](#4-segurança--d7d10)
  - [D7 — RLS como fronteira de tenant](#d7--rls-como-fronteira-de-tenant)
  - [D8 — Criptografia em trânsito](#d8--criptografia-em-trânsito)
  - [D9 — Defesa em profundidade na Vercel](#d9--defesa-em-profundidade-na-vercel)
  - [D10 — Cadeia criptográfica completa](#d10--cadeia-criptográfica-completa)
- [5. Gates de segurança (referência cruzada)](#5-gates-de-segurança-referência-cruzada)
- [6. Estado e pendências](#6-estado-e-pendências)
- [7. Manutenção e precedência](#7-manutenção-e-precedência)

---

## 1. Vínculos com o AGENTS.md

Cada diagrama deriva de seções específicas do `AGENTS.md` (e dos ADRs citados por elas). Este é o contrato de rastreabilidade do mapa:

| Diagrama | Camada     | Seções do `AGENTS.md` que operacionaliza                                                                                                                               |
| -------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1       | Plataforma | **Three CI pipelines** (seleção por path, light × heavy); **Deployment contract** (publicação manual e condicional, C26/ADR-042); Baseline de segurança (CSP)          |
| D2       | Plataforma | **Three permanent Neon branches only**; **Local database** (env guard, denylist de produção, `ALLOW_REMOTE_DB`); allowlist de URI no provisionamento Neon              |
| D3       | Plataforma | **Deployment contract** (publish o SHA exato do main só após CE real e runtime checks; "health 200" como pré-condição de promoção de alias)                            |
| D4       | Processo   | **Branching** (PR-only para `main`, règles 24333849/24347682); **Local quality gate** (cadeia `check`, tiers do `verify`); Sonar/CE (ADR-042/ADR-044)                  |
| D5       | Processo   | **Deployment contract** + roadmap em `docs/evidence/otimizacoes-planejamento/PLANEJAMENTO.md` (§4 e §8); condição BLQ-03 (ver §6)                                      |
| D6       | Processo   | `PLANEJAMENTO.md` §3 (fichas) e §4.3 (dependências); fichas bloqueadas 🔶 (TS-03/BD-01/BD-03)                                                                          |
| D7       | Segurança  | **Security baseline** (INV-008); **Local database** (denylist absoluta de produção); migration `0001_p0_runtime_role_and_rls.sql`; `scripts/rls-probe.mjs` (`db:test`) |
| D8       | Segurança  | Allowlist de URI no provisionamento Neon (`{sslmode, channel_binding}`, default `require`); **Local database** (env guard)                                             |
| D9       | Segurança  | **Security baseline** (CSP estrita em `src/start.ts`); **Deployment contract** (previews; Deployment Protection evidenciada)                                           |
| D10      | Segurança  | **Security baseline** (DeepSeek/Web-only, redaction); ADR-033 (redaction antes de persistir); ADR-043 (CSP nonce); fichas OB-04/OB-05                                  |

---

## 2. Plataforma — D1–D3

### D1 — Vercel · ciclo de vida do deployment

```mermaid
---
title: "D1 — Vercel · ciclo de vida do deployment e superfícies de observabilidade"
---
flowchart TD
    %% Toda a cadeia abaixo existe para responder a UMA pergunta:
    %% "este deployment merece tocar o alias público?"
    %% Cada losango é um ponto onde a plataforma PODE bloquear.

    PUSH["um push toca um path relevante<br/>— docs-only sob docs/evidence/** vai para a light"]
    BUILD["a Vercel constrói o deployment<br/>com o SHA exato do commit"]
    DC{"Deployment Checks<br/>estão vinculados ao projeto?"}
    RUN["os checks obrigatórios rodam<br/>ui-stack · ci-light · neon-readiness"]
    SKIP["o build segue SEM bloqueio de plataforma<br/>— a proteção é apenas processual"]
    READY["o deployment atinge READY<br/>com build logs retidos"]
    PREVIEW["a Preview URL fica disponível<br/>para validação humana e E2E"]
    HEALTH{"o probe /api/health/ready<br/>retorna 200?"}
    PROMOTE["a promoção é autorizada por decisão humana<br/>— nunca automática"]
    ALIAS["o alias público aponta<br/>para o novo deployment"]
    HOLD["o alias permanece na revisão anterior<br/>— pin de rollback preservado"]
    OBS["observabilidade ativa observa tudo<br/>logs · metrics · traces · web-vitals"]

    PUSH --> BUILD
    BUILD --> DC
    DC -->|"sim"| RUN
    DC -->|"não — estado atual BLQ-03"| SKIP
    RUN -->|"todos verdes"| READY
    RUN -->|"qualquer vermelho"| HOLD
    SKIP --> READY
    READY --> PREVIEW
    PREVIEW --> HEALTH
    HEALTH -->|"sim"| PROMOTE
    HEALTH -->|"não — incidente 12/10"| HOLD
    PROMOTE --> ALIAS
    ALIAS --> OBS
    HOLD --> OBS

    classDef gate fill:#e2e3f1,stroke:#4a4a8a,color:#1a1a4e,stroke-width:2px
    classDef caminhoSeguro fill:#d4edda,stroke:#28a745,color:#155724
    classDef caminhoInseguro fill:#f8d7da,stroke:#dc3545,color:#721c24
    classDef superficieObserva fill:#d1ecf1,stroke:#0c5460,color:#0c5460
    classDef entrada fill:#fff3cd,stroke:#ffc107,color:#856404

    class DC,HEALTH gate
    class READY,PREVIEW,PROMOTE,ALIAS caminhoSeguro
    class SKIP,HOLD caminhoInseguro
    class OBS superficieObserva
    class PUSH,BUILD entrada
```

**Legenda — o que cada nó exige e onde vive no `AGENTS.md`:**

- **paths-ignore (PUSH):** apenas `docs/evidence/**` é tratado como docs-only e roda a light; **qualquer outro path** dispara o heavy `verify` — título _"Three CI pipelines, selected by paths"_. Um push misto (código + docs) pertence à heavy.
- **DC — Deployment Checks (losango):** hoje **não vinculados** (BLQ-03, ver §6). Enquanto o estado for "não", a proteção é **processual** (SKIP), nunca presumida como de plataforma. O caminho normativo é vincular os checks antes da promoção (INFRA-03).
- **HEALTH (losango):** `/api/health/ready` = 200 é **pré-condição de promoção**. O incidente de 12/10 (`fa45632` servindo 503 `postgres unavailable`) e o reparo de 13–14/10 (`dpl_9v4ni1M`, `dpl_3zbrc9h`) são o precedente: health ≠ 200 ⇒ promoção abortada e aliases mantidos.
- **PROMOTE:** publicação **manual e condicional** (C26/ADR-042) — nunca automática; o SHA promovido é o exato do `main` com CE real aprovado.
- **OBS:** observabilidade ativa (logs/metrics/traces/web-vitals) é contrato do tier e2e e da camada OTel; ela observa **os dois desfechos** (alias novo e rollback pinado).

### D2 — Neon · arquitetura de conexão

```mermaid
---
title: "D2 — Neon · arquitetura de conexão e o custo do pooling ausente"
---
flowchart LR
    %% Neon expõe dois caminhos por branch: conexão direta e conexão pooled.
    %% O diferenciador é o HOST (-pooler), nunca a porta: a URI canônica fixa 5432.

    subgraph BRANCH["branch production · br-snowy-violet-aymcvvvv"]
        direction TB
        PG["Postgres 17.11<br/>max_connections = 901 (observado 13/10)"]
        END_DIRECT["endpoint direto :5432<br/>ep-long-violet-aye9g0bn"]
        END_POOLED["endpoint pooled · host -pooler<br/>PgBouncer · transaction mode"]
    end

    subgraph CLIENTE["cliente serverless — Vercel Function"]
        direction TB
        FN["cada invocação abre<br/>uma conexão efêmera"]
        ENV_DB["DATABASE_URL<br/>usada em runtime"]
        ENV_DIRECT["DIRECT_URL<br/>usada apenas por migrações Drizzle"]
    end

    subgraph CONSEQUENCIA["consequência sob carga"]
        direction TB
        ESX["conexões concorrentes crescem<br/>com o número de invocações"]
        ESGOTA["risco de esgotar max_connections<br/>sob picos de tráfego"]
        SEGURO["PgBouncer multiplexa<br/>N invocações em M conexões reais"]
    end

    FN --> ENV_DB
    ENV_DB -->|"aponta para qual endpoint?"| END_DIRECT
    ENV_DB -.->|"alvo recomendado"| END_POOLED
    END_DIRECT --> ESX
    ESX --> ESGOTA
    END_POOLED --> SEGURO
    ENV_DIRECT -->|"nunca em runtime"| END_DIRECT
    PG --- END_DIRECT
    PG --- END_POOLED
    SEGURO -->|"protege"| PG
    ESGOTA -->|"ameaça"| PG

    classDef decisao fill:#e2e3f1,stroke:#4a4a8a,color:#1a1a4e,stroke-width:2px
    classDef risco fill:#f8d7da,stroke:#dc3545,color:#721c24
    classDef seguro fill:#d4edda,stroke:#28a745,color:#155724
    classDef recurso fill:#d1ecf1,stroke:#0c5460,color:#0c5460

    class ENV_DB decisao
    class ESX,ESGOTA risco
    class END_POOLED,SEGURO seguro
    class PG,END_DIRECT recurso
```

**Legenda — vínculos e gates:**

- **Três branches permanentes, nunca mais:** `production` (`br-snowy-violet-aymcvvvv`), `develop` (`br-small-hill-aymcu14y`) e a fonte de fixture vazia `ci-fixture-base` — seção _"Three permanent Neon branches only"_. Cópias de CI são efêmeras, identificadas por run, TTL 24h e descarte com GET 404.
- **`DATABASE_URL` de runtime vs `DIRECT_URL` de migração:** a conexão direta é a exceção (migrações); o runtime nunca deve carregar credencial owner — **Local database / env guard**: o endpoint de produção é **negado incondicionalmente** nos pre-hooks, sem override que o reabra.
- **Pooling (resíduo BLQ-01):** a observação herdada (`pooler_enabled=false`, conexão direta) **não foi reconfirmada** após o reparo de env de 13/10; verificação live é obrigatória e a promoção a `-pooler` é **decisão pendente INFRA-01** (incluindo compatibilidade do driver com transaction pooling — prepared statements). Não codifique a troca por suposição.
- **URI canônica:** a allowlist validada é `{sslmode, channel_binding}` com **porta 5432 explícita** — nenhum parâmetro movedor de destino é aceito (seção _"Provisionamento da fixture Neon de PR"_).

### D3 — A ponte entre Vercel e Neon · health/ready

```mermaid
---
title: "D3 — a ponte Vercel↔Neon · health/ready como único contrato"
---
flowchart TD
    %% Vercel e Neon são plataformas independentes.
    %% O único contrato observável entre elas é o probe /api/health/ready.
    %% Quando esse contrato falha, a Vercel NÃO deve promover — foi o que falhou em 12/10.

    subgraph VERCEL["Vercel — camada de entrega"]
        direction TB
        DEPLOY["deployment candidato"]
        PROBE["probe HTTP<br/>GET /api/health/ready"]
        PROMOTE["promoção de alias<br/>manual e condicional"]
    end

    subgraph NEON["Neon — camada de persistência"]
        direction TB
        ENV["DATABASE_URL<br/>injetada como secret"]
        CONN["pool de conexões"]
        HEALTHY["responde OK<br/>(SELECT 1)"]
        UNHEALTHY["responde 503<br/>postgres unavailable"]
    end

    INCIDENTE["incidente 12/10<br/>fa45632 · alias servindo 503"]
    CORRECAO["reparo 13/10<br/>DBT-110 · env reinjetada"]
    ESTADO_OK["estado atual<br/>health/ready 200"]

    DEPLOY --> PROBE
    PROBE -->|"consulta"| ENV
    ENV --> CONN
    CONN -->|"conexão saudável"| HEALTHY
    CONN -->|"conexão quebrada"| UNHEALTHY
    HEALTHY -->|"libera"| PROMOTE
    UNHEALTHY -->|"bloqueia"| INCIDENTE
    INCIDENTE -->|"motiva"| CORRECAO
    CORRECAO -->|"restaura"| ESTADO_OK
    ESTADO_OK -->|"reencontra"| HEALTHY

    classDef plataformaVercel fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
    classDef plataformaNeon fill:#fce7f3,stroke:#9d174d,color:#831843
    classDef incidente fill:#f8d7da,stroke:#dc3545,color:#721c24
    classDef resolucao fill:#d4edda,stroke:#28a745,color:#155724

    class DEPLOY,PROBE,PROMOTE plataformaVercel
    class ENV,CONN,HEALTHY,UNHEALTHY plataformaNeon
    class INCIDENTE incidente
    class CORRECAO,ESTADO_OK resolucao
```

**Legenda — vínculos e gates:**

- **Contrato único:** nenhum componente da Vercel fala com o Neon além do probe de prontidão — _Deployment contract_: publicar o SHA exato do `main` **somente** depois do CE real (≥ 60%, ADR-042) e dos runtime checks aplicáveis.
- **Fail-closed:** `UNHEALTHY` ⇒ o alias **não** promove; o pin de rollback permanece. O histórico do incidente/reparo (DBT-110/DBT-115, FECHADAS) é evidência versionada, não presunção.
- **Estado atual:** produção saudável no deployment vigente do `main`; qualquer nova promoção repete a cadeia inteira — o mapa não carrega "verde" de uma rodada para a seguinte.

---

## 3. Processo — D4–D6

### D4 — Ciclo CI/CD

```mermaid
---
title: "D4 — ciclo CI/CD · do gate local ao alias público"
---
flowchart LR
    %% A pergunta única do pipeline: "este SHA merece tocar o alias público?"
    %% Nenhuma etapa abaixo é decorativa — cada uma é uma recusa potencial.

    subgraph LOCAL["1 · máquina local"]
        direction TB
        DEV["agente em develop"]
        GATE["npm run check<br/>cadeia completa · 2.274 testes<br/>(baseline herdado — reconfirmar em develop@94e3241)"]
        GREEN{"verde?"}
    end

    subgraph GH["2 · GitHub Actions"]
        direction TB
        PUSH["push em develop"]
        UI["ui-stack.yml<br/>verify-release"]
        LIGHT["ci-light.yml<br/>prettier · guardas"]
        NEON["neon-readiness.yml<br/>readiness de conexões"]
        MATRIZ["matriz completa<br/>heavy runner"]
    end

    subgraph CE["3 · gate de engenharia"]
        direction TB
        READOUT["gate-readout<br/>new_coverage ≥ 60%"]
        DECISAO{"decisão humana<br/>sobre promoção"}
    end

    subgraph VRC["4 · Vercel"]
        direction TB
        BUILD["build do SHA exato"]
        CHECK{"Deployment Checks<br/>vinculados?"}
        PROMO["promoção manual<br/>de alias"]
    end

    ALIAS["alias público"]

    DEV --> GATE
    GATE --> GREEN
    GREEN -->|"sim"| PUSH
    GREEN -->|"não — não push"| DEV
    PUSH --> UI
    PUSH --> LIGHT
    PUSH --> NEON
    UI --> MATRIZ
    LIGHT --> MATRIZ
    NEON --> MATRIZ
    MATRIZ -->|"todos verdes"| READOUT
    MATRIZ -->|"qualquer vermelho"| DEV
    READOUT --> DECISAO
    DECISAO -->|"autoriza"| BUILD
    DECISAO -->|"recusa"| DEV
    BUILD --> CHECK
    CHECK -->|"sim — bloqueia até verde"| PROMO
    CHECK -->|"não — promoção é manual pura"| PROMO
    PROMO --> ALIAS

    classDef gate fill:#e2e3f1,stroke:#4a4a8a,color:#1a1a4e,stroke-width:2px
    classDef local fill:#fff3cd,stroke:#ffc107,color:#856404
    classDef github fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
    classDef ce fill:#fce7f3,stroke:#9d174d,color:#831843
    classDef vercel fill:#d1ecf1,stroke:#0c5460,color:#0c5460

    class GREEN,DECISAO,CHECK gate
    class DEV,GATE local
    class PUSH,UI,LIGHT,NEON,MATRIZ github
    class READOUT ce
    class BUILD,PROMO,ALIAS vercel
```

**Legenda — vínculos e gates:**

- **1 · Local:** `npm run check` é o gate de definição de pronto (_Local quality gate_); o número de testes é o baseline herdado e **precisa ser reconfirmado contra `develop@94e3241`** (§0 do planejamento). Push sem o gate local desperdiça um ciclo de CI.
- **2 · GitHub Actions:** a seleção por path é contrato (_"Three CI pipelines, selected by paths"_): docs-only sob `docs/evidence/**` → light; qualquer outro path (código, `AGENTS.md`, `docs/` fora de evidence) → heavy; PR sempre roda a matriz completa. Os tiers do `verify` são fail-closed (base desconhecida ⇒ tudo roda).
- **3 · CE:** `gate-readout` observa a CE real do provedor e aplica o piso ADR-042 (≥ 60%) **sem alterar o veredito do provedor**; `NO-VERDICT`/`ERROR` bloqueiam. A decisão de promoção é **humana** — o gate técnico habilita, nunca autoriza.
- **4 · Vercel:** `CHECK` reflete o estado do D1 — hoje "não" (BLQ-03 aberto): a promoção manual é a única trava. Quando os Deployment Checks forem vinculados, o ramo "sim" passa a bloquear promoção até os checks verdes.
- **`develop` é o único canal:** implementação (inclusive correções de segurança e dependências) integra em `develop`; `main` recebe só o PR final (_Branching_).

### D5 — Roadmap das ondas

```mermaid
---
title: "D5 — roadmap das ondas · gates e a condição BLQ-03"
---
flowchart TD
    %% Cada gate existe para impedir que a onda seguinte comece sem base verificada.
    %% BLQ-03 (pooling + Deployment Checks) NÃO é uma onda — é condição de saída.

    F0["Fase 0 · baseline reconfirmado<br/>contra develop@94e3241<br/>— sem isso, todo gate é cego"]
    PRE["Pré-onda INFRA<br/>INFRA-01 pooling · INFRA-02 preview<br/>INFRA-03 Deployment Checks"]
    O1["Onda 1 · Quick wins (semanas 1–2)<br/>UI-01 · UI-03 · UI-05 · UI-06<br/>DT-02 · DT-04 · OB-02 · OB-03"]
    O2["Onda 2 · Core perf (semanas 3–4)<br/>TS-03/04/05 · BD-02/05 · DT-01/03/05<br/>OB-01/04/05 · UI-02/04 · RT-02/03"]
    O3["Onda 3 · Arquitetura (semanas 5–8)<br/>TS-01/02 · BD-01/03/04/06<br/>RT-01 · RT-04"]

    G1{"Gate 1 — só fecha se<br/>npm run check exit 0 E<br/>bundle ≤ 85% do baseline"}
    G2{"Gate 2 — só fecha se<br/>preview validado E E2E/Axe 100% E<br/>auth p99 < 10ms"}
    G3{"Gate 3 — só fecha se<br/>LCP < 2.5s E INP < 200ms E<br/>bundle < 150KB E cold start 45–65ms"}

    BLQ3["BLQ-03 · pooling reconfirmado<br/>+ Deployment Checks vinculados"]
    FIN(["Publicação manual e condicional<br/>CE ≥ 60% E health/ready 200<br/>→ promoção de aliases"])

    F0 --> PRE
    PRE --> O1
    O1 --> G1
    G1 -->|"verde — avança"| O2
    G1 -->|"vermelho — retorna"| O1
    O2 --> G2
    G2 -->|"verde — avança"| O3
    G2 -->|"vermelho — retorna"| O2
    O3 --> G3
    G3 -->|"verde"| FIN
    G3 -->|"vermelho — retorna"| O3
    BLQ3 -.->|"condição obrigatória<br/>— sem isso, FIN não acontece"| FIN

    classDef gate fill:#e2e3f1,stroke:#4a4a8a,color:#1a1a4e,stroke-width:2px
    classDef onda fill:#d1ecf1,stroke:#0c5460,color:#0c5460
    classDef condicao fill:#fff3cd,stroke:#ffc107,color:#856404
    classDef publicacao fill:#f8d7da,stroke:#dc3545,color:#721c24
    classDef baseline fill:#d4edda,stroke:#28a745,color:#155724

    class G1,G2,G3 gate
    class O1,O2,O3,PRE onda
    class BLQ3 condicao
    class FIN publicacao
    class F0 baseline
```

**Legenda — vínculos e gates:**

- **Fonte:** `PLANEJAMENTO.md` §4.2 (gates com critérios completos e checklists) e §8 (decisões em formato ADR). Este diagrama é o resumo normativo; o detalhe mensurável vive lá.
- **BLQ-03 é condição, não onda:** os critérios de performance do Gate 3 são **necessários, mas não suficientes** — a publicação exige pooling reconfirmado/ativo **e** Deployment Checks vinculados. Performance verde com BLQ-03 aberto **não libera** promoção.
- **Fase 0 é pré-condicional:** o baseline de 2.274 testes / `sha256=30ca04baaa66` foi capturado antes do PR #64 — sem a reconfirmação contra `develop@94e3241`, todos os gates comparam contra um número não verificado.
- **Porta única permanece:** `FIN` repete o contrato do D3/D1 — CE ≥ 60%, `health/ready` 200, promoção manual.

### D6 — Grafo de dependências

```mermaid
---
title: "D6 — grafo de dependências técnicas entre as 31 iniciativas"
---
flowchart LR
    %% Cada aresta significa "X precisa estar pronto para Y começar".
    %% Caminho crítico em vermelho — atrasos aqui propagam-se até a publicação.
    %% Nós 🔶 bloqueados exigem validação de schema/versão antes de codificar.

    subgraph TRILHA_UI["trilha UI & runtime"]
        direction TB
        UI01["UI-01 · deep imports"]
        UI02["UI-02 · lazy load > 50KB"]
        UI03["UI-03 · OKLCH tokens"]
        UI04["UI-04 · interaction split"]
        UI05["UI-05 · avatar estável"]
        UI06["UI-06 · pureza de render"]
        RT01["RT-01 · RSC por padrão"]
        RT02["RT-02 · Suspense"]
        RT03["RT-03 · client boundaries"]
        RT04["RT-04 · React Compiler"]
    end

    subgraph TRILHA_BUILD["trilha roteamento & build"]
        direction TB
        TS01["TS-01 · SSR seletivo"]
        TS02["TS-02 · prerender SSG"]
        TS03["🔶 TS-03 · code splitting"]
        TS04["TS-04 · preload intent"]
        TS05["TS-05 · staleTime 5min"]
        BD01["🔶 BD-01 · full bundle dev"]
        BD02["BD-02 · compressão"]
        BD03["🔶 BD-03 · chunks granulares"]
        BD04["BD-04 · SWR Nitro"]
        BD05["BD-05 · CDN rewrites"]
        BD06["BD-06 · route matrix"]
    end

    subgraph TRILHA_DADOS["trilha dados & observabilidade"]
        direction TB
        DT01["DT-01 · Zod hot path"]
        DT02["DT-02 · decimal-light"]
        DT03["DT-03 · dynamic decimal"]
        DT04["DT-04 · const pool"]
        DT05["DT-05 · cookie cache"]
        OB01["OB-01 · tree-shake OTel"]
        OB02["OB-02 · lazy OTel"]
        OB03["OB-03 · batch tuning"]
        OB04["OB-04 · spans domínio"]
        OB05["OB-05 · correlação"]
    end

    UI01 -->|"habilita"| RT03
    UI01 -->|"habilita"| UI04
    UI01 -->|"habilita"| BD03
    UI06 -->|"habilita"| RT04
    UI06 -->|"habilita"| UI04
    RT02 -->|"habilita"| RT01
    RT02 -->|"habilita"| UI02
    RT03 -->|"habilita"| RT01

    TS03 -->|"habilita"| TS04
    TS05 -->|"habilita"| TS04
    TS02 -->|"habilita"| TS01
    TS02 -->|"habilita"| BD04
    BD04 -->|"habilita"| BD05

    DT02 -->|"habilita"| DT01
    DT02 -->|"habilita"| DT03
    DT02 -->|"habilita"| BD03

    OB02 -->|"habilita"| OB01
    OB02 -->|"habilita"| OB03
    OB02 -->|"habilita"| BD06
    OB01 -->|"habilita"| OB04
    OB04 -->|"habilita"| OB05

    classDef caminhoCritico fill:#f8d7da,stroke:#dc3545,color:#721c24,stroke-width:3px
    classDef quickWin fill:#d4edda,stroke:#28a745,color:#155724
    classDef bloqueada fill:#fff3cd,stroke:#ffc107,color:#856404,stroke-dasharray:5 5
    classDef arquitetural fill:#e2e3f1,stroke:#4a4a8a,color:#1a1a4e

    class UI06,TS02,TS01,BD04,BD05 caminhoCritico
    class UI01,UI03,UI05,UI04,DT02,DT04,OB02,OB03 quickWin
    class TS03,BD01,BD03 bloqueada
    class RT01,BD06,OB04,OB05 arquitetural
```

**Legenda — vínculos e gates:**

- **Fonte:** `PLANEJAMENTO.md` §3.0 (índice com Status por ficha) e §4.3 (caminho crítico declarado). As 31 fichas têm critérios de aceite e evidências exigidas próprios.
- **🔶 Bloqueadas (TS-03, BD-01, BD-03):** têm divergência de reconciliação com o código/config vigente (`autoCodeSplitting` fora do schema pinado; feature do Vite 8 a validar; `codeSplitting.groups` vigente) — **validar antes de codificar**, nunca presumir.
- **Caminho crítico:** `UI-06 → RT-04` e `TS-02 → TS-01 / BD-04 → BD-05` — atrasos nesses nós propagam-se para a Onda 3 e para o Gate 3.

---

## 4. Segurança — D7–D10

### D7 — RLS como fronteira de tenant

```mermaid
---
title: "D7 — RLS como fronteira de tenant · defesa em profundidade"
---
flowchart TD
    %% Princípio: a autorização vive no Postgres, não na aplicação.
    %% O isolamento repousa em o runtime NÃO ser owner nem BYPASSRLS —
    %% FORCE RLS (defesa extra p/ conexão owner) não existe no schema hoje (ver §6).

    subgraph APP["Camada de aplicação — NÃO confiável para isolamento"]
        direction TB
        REQ["request autenticado<br/>chega à Server Function"]
        CTX["middleware extrai tenant/user<br/>→ set_config('app.current_*')"]
        QUERY["query Drizzle disparada<br/>— pode esquecer WHERE"]
    end

    subgraph PG["Camada Postgres — fronteira REAL de isolamento"]
        direction TB
        ROLE{"runtime conecta como app_runtime?<br/>NOSUPERUSER · NOBYPASSRLS · não-owner"}
        POLICY["política USING<br/>(tenant_id = app_private.current_tenant_id())"]
        ROWS["apenas linhas do tenant atual<br/>retornadas"]
        LEAK["⚠️ TODAS as linhas retornadas<br/>— vazamento cross-tenant"]
        DENY["zero linhas<br/>— fail-closed quando<br/>o contexto não está setado"]
    end

    REQ --> CTX
    CTX --> QUERY
    QUERY --> ROLE
    ROLE -->|"sim — correto (migration 0001)"| POLICY
    ROLE -->|"não — owner/superuser/BYPASSRLS"| LEAK
    POLICY --> ROWS
    POLICY -.->|"current_tenant_id() = null"| DENY

    classDef fronteiraReal fill:#d4edda,stroke:#28a745,color:#155724,stroke-width:3px
    classDef riscoVazamento fill:#f8d7da,stroke:#dc3545,color:#721c24,stroke-width:2px
    classDef appNaoConfiavel fill:#fff3cd,stroke:#ffc107,color:#856404
    classDef gateRls fill:#e2e3f1,stroke:#4a4a8a,color:#1a1a4e,stroke-width:2px

    class POLICY,ROWS,DENY fronteiraReal
    class LEAK riscoVazamento
    class REQ,CTX,QUERY appNaoConfiavel
    class ROLE gateRls
```

**Legenda — vínculos e gates:**

- **Primitivas reais:** `app_private.current_user_id()` e `app_private.current_tenant_id()` leem `current_setting('app.current_user_id' / 'app.current_tenant_id', true)` (retorno `null` quando ausente ⇒ fail-closed); funções `REVOKE` de `PUBLIC` e `GRANT EXECUTE` só para `app_runtime` (migration `0001_p0_runtime_role_and_rls.sql`).
- **Role de runtime:** `app_runtime` foi criada `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS` — o isolamento repousa em **nunca** usar owner/superuser em runtime (_Local database_: a denylist de produção é absoluta; admin URLs só em migrações/testes).
- **Prova:** `scripts/rls-probe.mjs` (dentro do `db:test`) conecta como `app_runtime`, seta `app.current_user_id`/`app.current_tenant_id`/`app.current_roles` e tenta leitura **e escrita** cross-tenant; qualquer vazamento é violação com parada de linha. O gate visual INV-008 (tenant A nunca vê B) cobre o mesmo invariante pela UX.
- **`FORCE ROW LEVEL SECURITY`:** **ausente hoje** (0 ocorrências em `drizzle/*.sql`) — ele só importa para conexão owner; adotá-lo é decisão de defesa adicional registrada em §6, nunca presumida como ativa.

### D8 — Criptografia em trânsito

```mermaid
---
title: "D8 — criptografia em trânsito · allowlist validada {sslmode, channel_binding}"
---
flowchart LR
    %% Neon rejeita conexões sem TLS. O que varia é o NÍVEL de verificação.
    %% A allowlist do repo aceita {require, verify-ca, verify-full} com default require;
    %% elevar o padrão para verify-full é decisão pendente — nunca edição de prosa.

    subgraph CLIENTE["cliente serverless — Vercel Function"]
        direction TB
        ENV["DATABASE_URL<br/>query restrita à allowlist {sslmode, channel_binding}"]
        CHANNEL["channel_binding — presente quando<br/>emitido pelo provedor (valor validado)"]
    end

    subgraph MODOS["níveis de verificação SSL/TLS"]
        direction TB
        REQUIRE["require<br/>criptografa, não verifica CA<br/>— default atual da allowlist"]
        VERIFY_CA["verify-ca<br/>verifica CA, não hostname"]
        VERIFY_FULL["verify-full<br/>CA + hostname (expiração do cert)<br/>— alvo recomendado; elevação pendente"]
    end

    subgraph NEON["Neon Postgres"]
        direction TB
        TLS_GATE{"conexão usa TLS?"}
        CERT["certificado assinado<br/>por CA confiável"]
        REJECT["conexão recusada<br/>— Neon rejeita não-TLS"]
    end

    ENV --> CHANNEL
    CHANNEL --> REQUIRE
    CHANNEL --> VERIFY_CA
    CHANNEL --> VERIFY_FULL
    REQUIRE --> TLS_GATE
    VERIFY_CA --> TLS_GATE
    VERIFY_FULL --> TLS_GATE
    TLS_GATE -->|"sim"| CERT
    TLS_GATE -->|"não"| REJECT

    classDef alvo fill:#d4edda,stroke:#28a745,color:#155724,stroke-width:3px
    classDef intermediario fill:#fff3cd,stroke:#ffc107,color:#856404
    classDef minimoAtual fill:#e2e3f1,stroke:#4a4a8a,color:#1a1a4e
    classDef inseguro fill:#f8d7da,stroke:#dc3545,color:#721c24
    classDef gateTls fill:#e2e3f1,stroke:#4a4a8a,color:#1a1a4e,stroke-width:2px

    class VERIFY_FULL alvo
    class VERIFY_CA intermediario
    class REQUIRE minimoAtual
    class REJECT inseguro
    class TLS_GATE gateTls
```

**Legenda — vínculos e gates:**

- **Contrato vigente (código):** `scripts/ci/neon-resource.ts` fixa a URI canônica com **porta 5432 explícita**, permite apenas `{sslmode, channel_binding}` (valores validados: `sslmode ∈ {require, verify-ca, verify-full}`) e **default `require`** quando ausente — nenhum parâmetro movedor de destino é aceito (_"URIs de todas as cópias Neon"_ no enquadramento do provisionamento).
- **Nível por nível:** `require` criptografa mas não valida a CA; `verify-ca` valida a CA mas não o hostname; `verify-full` valida CA + hostname — é o **alvo recomendado**, ainda **pendente** de promoção a padrão (INFRA-01/§6). MITM com certificado válido só é barrado no nível `verify-full`.
- **Regra de manutenção:** endurecer ou afrouxar esse contrato **exige mudança de código + teste** — prosa (inclusive este mapa) não altera allowlist.

### D9 — Defesa em profundidade na Vercel

```mermaid
---
title: "D9 — Vercel · defesa em profundidade na camada de entrega"
---
flowchart TD
    %% Cada losango é um controle que a entrega EXIGE antes da promoção.
    %% D1 mostrou o fluxo operacional; este mostra o fluxo defensivo.
    %% Controles marcados "a verificar" exigem confirmação no painel/API — não presumir.

    REQ["request externo<br/>chega à edge da Vercel"]

    subgraph PERIMETRO["perímetro — antes de tocar a aplicação"]
        direction TB
        WAF{"WAF com regras<br/>customizadas ativo?"}
        DDOS["proteção DDoS gerenciada<br/>+ rate limiting"]
        BLOCK["request bloqueado<br/>— bot/IP malicioso"]
    end

    subgraph APLICACAO["aplicação — runtime"]
        direction TB
        CSP{"CSP com nonce<br/>e sem unsafe-eval?"}
        HEADERS["security headers:<br/>HSTS · X-Content-Type-Options<br/>X-Frame-Options · Referrer-Policy"]
        AUTH{"sessão válida?"}
        DENY["401 / redirect para /auth"]
        SERVE["resposta servida"]
    end

    subgraph PREVIEW["preview deployments"]
        direction TB
        DEP_PROT{"Deployment Protection<br/>ativa?"}
        PREVIEW_PUB["preview acessível publicamente<br/>— ⚠️ superfície de ataque"]
        PREVIEW_PRIV["preview requer autenticação<br/>— somente team"]
    end

    subgraph AUDITORIA["observabilidade defensiva"]
        direction TB
        LOGS["Log Drains<br/>persistência de logs"]
        AUDIT["Audit Logs<br/>quem fez o quê e quando"]
        MONITOR["Monitoramento de IPs<br/>com privacidade configurada"]
    end

    REQ --> WAF
    WAF -->|"sim"| DDOS
    WAF -->|"não — tráfego passa direto"| CSP
    DDOS -->|"legítimo"| CSP
    DDOS -->|"malicioso"| BLOCK
    CSP -->|"sim — defesa ativa"| HEADERS
    CSP -->|"não — XSS viável"| AUTH
    HEADERS --> AUTH
    AUTH -->|"sim"| SERVE
    AUTH -->|"não"| DENY
    DEP_PROT -->|"sim"| PREVIEW_PRIV
    DEP_PROT -->|"não"| PREVIEW_PUB
    SERVE --> LOGS
    DENY --> LOGS
    LOGS --> AUDIT
    AUDIT --> MONITOR

    classDef gateDefensivo fill:#e2e3f1,stroke:#4a4a8a,color:#1a1a4e,stroke-width:2px
    classDef seguro fill:#d4edda,stroke:#28a745,color:#155724
    classDef risco fill:#f8d7da,stroke:#dc3545,color:#721c24
    classDef auditoria fill:#d1ecf1,stroke:#0c5460,color:#0c5460
    classDef aVerificar fill:#fff3cd,stroke:#ffc107,color:#856404,stroke-dasharray:5 5

    class WAF,CSP,AUTH,DEP_PROT gateDefensivo
    class DDOS,HEADERS,SERVE,PREVIEW_PRIV seguro
    class BLOCK,DENY,PREVIEW_PUB risco
    class LOGS,AUDIT,MONITOR auditoria
    class WAF,LOGS,AUDIT,MONITOR aVerificar
```

**Legenda — vínculos e gates:**

- **CSP (losango):** a política de `src/start.ts` é estrita (`script-src 'self'`, nonce — ADR-043) e **nunca** ganha `'unsafe-inline'`/hosts novos sem verificação no dist publicado e evidência no PR (_Security baseline_).
- **Deployment Protection (losango):** **evidenciada ativa** — probe 2026-09-12 mediu `302 → vercel.com/sso-api` em deployment URL de preview (`docs/evidence/vercel-docmap-2026-09-12.md`) e os aliases protegidos responderam `401` sem autenticação (fechamento DBT-115); o **escopo exato por ambiente** (preview vs deployment URL vs domínio de produção) segue como reconfirmação de painel — não presumir.
- **WAF / Log Drains / Audit Logs (tracejados `a verificar`):** sem evidência versionada de configuração no projeto. Norma: verificar/configurar **antes da promoção** (INFRA-03/Gate 3); status vive na §6.
- **`PREVIEW_PUB` é risco nomeado:** preview aberto é superfície de ataque — o estado alvo é `PREVIEW_PRIV` com Deployment Protection ativa e escopo declarado.

### D10 — Cadeia criptográfica completa

```mermaid
---
title: "D10 — cadeia criptográfica completa · do token ao span"
---
flowchart LR
    %% Cada nó é um artefato criptográfico. Cada aresta é um salto que DEVE ser verificado.
    %% Nenhum segredo em evidência; nenhum PII em span.

    subgraph ORIGEM["origem — autenticação"]
        direction TB
        OAUTH["OAuth provider<br/>emite ID token"]
        JWT["JWT assinado<br/>contém user_id / tenant_id"]
        SESSION["sessão better-auth<br/>cookie assinado com BETTER_AUTH_SECRET"]
    end

    subgraph TRANSITO["trânsito — cada salto protegido"]
        direction TB
        TLS_APP["TLS 1.2/1.3<br/>browser ↔ edge"]
        CSP["CSP nonce<br/>script inline autorizado"]
        TLS_DB["TLS Neon<br/>allowlist {sslmode, channel_binding}"]
    end

    subgraph DESTINO["destino — persistência e observabilidade"]
        direction TB
        RLS["RLS policy<br/>app_private.current_user_id() / current_tenant_id()"]
        AES["AES-256<br/>dados em repouso (Neon)"]
        TRACE["traceparent W3C<br/>correlação front↔back"]
        SPAN["span OTel<br/>sem PII nos atributos"]
    end

    OAUTH --> JWT
    JWT --> SESSION
    SESSION --> TLS_APP
    TLS_APP --> CSP
    CSP --> TLS_DB
    TLS_DB --> RLS
    RLS --> AES
    AES --> TRACE
    TRACE --> SPAN

    classDef criptoOrigem fill:#fce7f3,stroke:#9d174d,color:#831843
    classDef criptoTransito fill:#dbeafe,stroke:#1e40af,color:#1e3a8a
    classDef criptoDestino fill:#d4edda,stroke:#28a745,color:#155724,stroke-width:3px

    class OAUTH,JWT,SESSION criptoOrigem
    class TLS_APP,CSP,TLS_DB criptoTransito
    class RLS,AES,TRACE,SPAN criptoDestino
```

**Legenda — vínculos e gates:**

- **Origem:** sessão `better-auth` com cookie cache assinado (ADR-020/ADR-025, ficha DT-05); `BETTER_AUTH_SECRET` nunca em contexto de agente nem em evidência (_Security baseline_).
- **Trânsito:** cada salto com seu contrato — CSP nonce (ADR-043) no HTML/SSR; TLS do Neon na allowlist validada (D8). Nenhum salto "implícito" é aceito.
- **Destino:** a RLS usa as **primitivas reais** (`app_private.current_*`, migration 0001 — não existe `auth.user_id()` neste schema); repouso criptografado pelo Neon; correlação `traceparent` W3C é a ficha **OB-05** (a implementar — ver §6); atributos de span **sem PII** por contrato (ADR-033/redaction; a mesma regra da captura visual: redação antes da persistência, sempre).
- **MTTR:** a cadeia só fecha quando um Web Vital no navegador e o span correspondente no servidor compartilham o mesmo `traceId` auditável (critério de aceite OB-05).

---

## 5. Gates de segurança (referência cruzada)

| Diagrama | Camada                          | Gate que adiciona                                                                              | Ficha afetada         | Estado (2026-10-16)                                                                                                                 |
| -------- | ------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| D7       | RLS / tenant isolation          | runtime `app_runtime` (NOSUPERUSER · NOBYPASSRLS · não-owner) + fail-closed a contexto ausente | DT-01, DT-05, OB-04   | **Implementado** (migration `0001`; `rls-probe` no `db:test`; INV-008 visual). `FORCE RLS` ausente — defesa adicional pendente (§6) |
| D8       | TLS / criptografia em trânsito  | allowlist `{sslmode, channel_binding}` com default `require`; elevação a `verify-full`         | INFRA-01              | Allowlist **implementada** (código + teste); elevação a `verify-full` **pendente de decisão**                                       |
| D9       | Vercel / defesa em profundidade | CSP + Deployment Protection + WAF + Log Drains verificados **antes da promoção**               | INFRA-03, Gate 3      | CSP estrita **ativa**; Deployment Protection **evidenciada** (302→sso / 401); WAF, Log Drains e Audit Logs **a verificar**          |
| D10      | Cadeia criptográfica completa   | JWT → TLS → RLS → AES → `traceparent` **sem PII**                                              | OB-04, DT-05, ADR-043 | Até RLS/AES/sessão: ativos; `traceparent` front↔back = **OB-05, a implementar**                                                     |

> [!IMPORTANT]
> Um gate em estado **pendente** não deixa de ser normativo: o agente não pode **produzir o estado que ele proíbe** (ex.: promover alias sem `health 200`, usar owner em runtime, editar prosa de TLS/allowlist, exercer cross-tenant em teste). O que muda é apenas onde a pendência fecha — na §6.

## 6. Estado e pendências

Estado corrente do que este mapa declara normativo — cada pendência tem caminho de fechamento nomeado. Nada aqui é presumido:

| #   | Item                                              | Estado                                          | Evidência / onde fecha                                                             |
| --- | ------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | BLQ-03 — Deployment Checks vinculados (D1/D4)     | **Aberto**                                      | `PLANEJAMENTO.md` §2.6/§4.2/§8; fecha com INFRA-03 + Decisão 2                     |
| 2   | Pooling do Neon reconfirmado/ativo (D2)           | **A reconfirmar** (observação pré-13/10)        | `captures/neon-endpoints-pooling.json`; fecha com INFRA-01 + Decisão 1             |
| 3   | `sslmode=verify-full` como padrão (D8)            | **Decisão pendente** (hoje default `require`)   | Código `scripts/ci/neon-resource.ts`; fecha com INFRA-01 + mudança de código/teste |
| 4   | WAF / Log Drains / Audit Logs configurados (D9)   | **A verificar** (sem evidência versionada)      | Painel/API Vercel; fecha com INFRA-03/Gate 3                                       |
| 5   | Escopo exato da Deployment Protection (D9)        | **Evidência parcial** (302→sso; 401 em aliases) | `docs/evidence/vercel-docmap-2026-09-12.md`; fecha com reconfirmação de painel     |
| 6   | `FORCE ROW LEVEL SECURITY` (defesa adicional, D7) | **Ausente hoje** (0 ocorrências)                | `drizzle/*.sql`; fecha com migration + teste, se decidido                          |
| 7   | Baseline de qualidade reconfirmado (D4/D5)        | **A reconfirmar** contra `develop@94e3241`      | Checklist acionável em `PLANEJAMENTO.md` §0                                        |
| 8   | Correlação `traceparent` front↔back (D10)         | **A implementar**                               | Ficha OB-05 (`PLANEJAMENTO.md` §3.7)                                               |

Pendências de **verificação live** herdadas (V-01..V-04) permanecem como no planejamento — este mapa não as duplica, apenas as referencia por caminho.

## 7. Manutenção e precedência

- **Precedência:** `AGENTS.md` e os ADRs vencem este mapa. Divergência entre os dois é **bug** — corrige-se o mapa (ou, com ADR, o contrato), nunca se "interpreta" a divergência.
- **Mesmo commit:** qualquer mudança no `AGENTS.md`, num ADR ou em código que mude um gate daqui **atualiza este mapa no mesmo commit** (e vice-versa quando o mapa for a origem da mudança). A regra do `AGENTS.md` (_"Note for agents"_) vale integralmente aqui.
- **Prosa não altera contrato:** allowlists, níveis de TLS, expressões de RLS e nomes de role só mudam com **código + teste** correspondentes; este documento nunca é fonte primária desses valores — ele aponta para onde eles vivem.
- **Formatação:** o arquivo é markdown comum sob `format:check` (`prettier`); diagramas usam `flowchart` com frontmatter, IDs significativos e `classDef` — sem `linkStyle` (índices frágeis).
- **Taxonomia de estado:** `Implementado` · `Evidenciado` · `A verificar` · `A reconfirmar` · `Decisão pendente` · `A implementar` — os mesmos verbos da §6; qualquer estado novo usado aqui precisa manter a distinção entre **verificado** e **pendente**.

---

_Mapa operacional criado em 2026-10-16 a partir dos diagramas canônicos D1–D10 fornecidos, reconciliados contra o repositório (migrations, `scripts/ci/neon-resource.ts`, `scripts/rls-probe.mjs`, evidências versionadas) e conectados por seção ao `AGENTS.md` e ao `docs/evidence/otimizacoes-planejamento/PLANEJAMENTO.md`. Nada foi commitado, pushado ou publicado._
