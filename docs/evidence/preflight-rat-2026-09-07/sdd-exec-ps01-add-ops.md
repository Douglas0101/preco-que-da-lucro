# SDD-EXEC-PS01-ADD-OPS — aprofundamento em engenharia aplicada

> **Proveniência:** transcrição literal do DRAFT recebido do dono do programa
> (Douglas) em 2026-09-07, para integrar o material de RAT ao lado de
> `docs/evidence/ps01-entry-2026-09-07/rat-dp5-emenda6-draft.md`.
> Estado: **DRAFT p/ RAT** — nada aqui está ratificado até o ato humano em
> `rat-s0-signature-block.md`. Duas correções ao plano anterior são a §0;
> a §6 lista os 3 atos que liberam a execução.

## 0. Duas correções ao plano antes de aprofundar (evitam retrabalho e GO falso)

1. **DP5 não está pendente: está DECIDIDO = opção (b)**, com especificação
   fechada (trio `dump.pgc`+`.sha256`+`metadata.json` via `--out-dir`,
   predicado DIRECT de dupla cinta, age <24h por `created_at`, selftest 5 casos)
   e **Emenda #6 em DRAFT** dentro da proposta PS-01. O que falta não é escolha,
   é o **ato humano de RAT em S0** (assinatura/data). A lacuna 3 do plano anterior
   deve ser reescrita como "RAT S0 + Emenda #6", senão o C-02 reabre uma decisão
   já tomada e auditada.
2. **A bateria da Fase 2 não pode escrever em produção antes do cutover.**
   Produção é fixture-free, suspensa e read-only por norma; signup/smoke/burst
   criariam linhas e quebrariam a reconciliação T+ e o reconcile 26/26.
   Restrição de engenharia: **toda a bateria pré-cutover roda em app preview +
   branch Neon dedicada `preview-bateria-<data>` (seed safe data)**; contra
   produção só probes read-only sancionados. RUM dia-0 e grep de 1h de tráfego
   ficam rotulados para a janela A5-0h pós-cutover. Sem esse constraint,
   "operar na web" vira incidente N-B4.

## 1. Fase 1 — lacunas com engenharia aplicada

| #   | Lacuna              | Engenharia do aceite                                                                                                                                                                               | Evidência                                                                              | Stop                                                                   |
| --- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Feixe não-pousado   | Cadeia S3 do PS-01 (V0-1…V5-1, ledger último por commit, delta DP5 dentro de V5-1); `m02:sums` por selo                                                                                            | hashes no ledger; CI verde; STACK_MODE=committed                                       | pré-flight vermelho ×2; regen de matrix sem drift                      |
| 2   | Hazard .env→prod    | B-00 (Emenda #5 selada + .gitignore) → B-02 rewiring → B-03 matriz deny/allow → B-04 selagem                                                                                                       | `npm test` remoto=exit 3 pré-suite; selftest 13/13; split-smokes JSON hosts mascarados | allow onde deveria deny                                                |
| 3   | ~~DP5~~ → RAT S0    | Assinar RAT de DP5=(b) + vigência da Emenda #6; S1 já especificado                                                                                                                                 | registro de ato humano no PS-01 §6                                                     | executar S1 sem RAT                                                    |
| 4   | BAK-01              | C-02 em 6 passos (snapshot --out-dir → restore efêmero drill-branch → reconcile diff 0 → backup-verify → cleanup com prova → gate alimentado) + C-03 veredito duplo **com cláusula N-10 verbatim** | dump.pgc com age <24h por `created_at`; nativo ID+validade no ledger                   | veredito sem cláusula N-10; difference≠0 financeira                    |
| 5   | G1/SEC-01/freeze    | Assinaturas + linha `freeze ativo:` exata + revogação no emissor; mapa de flips do readiness conferido por commit                                                                                  | readiness 8/8 (state/freeze/snapshot-fresco viram; g1/sec01 por assinatura)            | flip fora do mapa                                                      |
| 6   | D2/V2b              | Pedido literal pronto; `npm run m02:v2b` um comando; exits 0/1/2/3; RETRY_LIMIT=1                                                                                                                  | reconciliation-legacy §13.5 + schema-diff triado; Manifest 6 pré-redigido              | credencial ausente em 10/09 → NO-GO datado no freeze                   |
| 7   | Infra (4 respostas) | Pacote de decisão abaixo (§4) — cada resposta vira item de homologação e registro DNS/DKIM                                                                                                         | screenshots NAV-AUTH + `dns-records-<data>.md`                                         | resposta conflitante com item OP-H (ex.: tier com Node <24.15 = ABORT) |

## 2. Fase 2 — bateria de métricas como protocolos (§35/§16.4/§29), ambiente por teste

| Teste                       | Ambiente                             | Procedimento-chave                                                                                                                   | Métrica/aceite                                                                            | Controle de contaminação                                                              |
| --------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| T1 smoke cold-aware         | preview-bateria                      | warm-up descarta TTFF ~2s; asserções ≤3s só depois                                                                                   | live/ready 200 ≤3s; substrate 7/7                                                         | 1ª req pós-idle registrada em série separada, **fora do p95**                         |
| T2 saturação de pool (H-06) | preview-bateria (proxy do pool prod) | 3 ondas 10/25/50 concorrentes como `app_runtime`, só leitura + 1 mutação com idempotency key                                         | wait/queue/connections (§16.7); saída = `DATABASE_POOL_MAX` recomendado com justificativa | rotular MODO preview-branch; não extrapolar como medição de produção                  |
| T3 caos doméstico           | preview                              | kill→ressurreição ≤60s; redeploy **mesmo SHA** (idempotência de deploy) e redeploy **SHA anterior** (prova de rollback por artefato) | ≤60s; re-smoke 7/7 nos dois                                                               | rollback real só com artefato anterior versionado                                     |
| T4 segredos em logs         | preview agora + prod em A5-0h        | grep de padrões no boot; janela de 1h rotulada pós-cutover                                                                           | zero ocorrências (§19.4)                                                                  | janela de 1h não existe pré-tráfego — rotular, não simular                            |
| T5 RUM dia-0                | prod em A5-0h                        | LCP/INP/CLS p75 instrumentados desde o 1º tráfego; traces sem token/URL/PII                                                          | baseline §29 como referência, **não promessa** (§30)                                      | sem RUM dia-0, error budget não nasce                                                 |
| T6 budget financeiro zero   | T+                                   | divergência contábil = abort, sem tolerância                                                                                         | different=0, sessions=0, órfãos=0                                                         | já é regra do T+; apenas carimbar                                                     |
| T7 degradação graciosa      | preview                              | IA hibernada = teste grátis: app 100% sem chat; registrar comportamento como evidência §31                                           | produtos/preços/despesas/simulações funcionais                                            | item 8 = PENDING-CREDITOS com exceção assinada; reentrada em 4 passos, sem recalendar |

## 3. NAV-AUTH — navegação autônoma + multimodal para autenticação durante os processos

1. **Credencial é ato humano exclusivo:** login digitado pelo humano no próprio
   navegador; agente nunca recebe senha/OTP/cookie por chat, argv, log ou
   evidência (extensão de N-B3 e §19.4 para consoles).
2. **Sessão não é artefato:** nenhum token/cookie exportado; se a ferramenta de
   navegação precisar de sessão, ela vive no perfil do navegador humano e morre
   com ele.
3. **Evidência multimodal = screenshot + texto extraído com mascaramento:**
   antes/depois de cada op de console (hPanel, Cloudflare, Resend, Neon), com
   URL sem query-token, timestamp UTC e estado resultante; padrões de secret
   mascarados na extração.
4. **Verificação por string esperada:** cada screenshot é conferido contra um
   literal de UI (versão Node, "DKIM verified", ID do snapshot, janela PITR,
   tier) — visão pode propor, **humano confirma**; divergência = stop.
5. **Ops mutantes permanecem clique humano** mesmo pré-aprovadas (OP-H/OP-C):
   o agente dita o passo, verifica o depois e sela; fora da pré-aprovação
   (apontar domínio, snapshot-restore/finalize, down 0010, relaxar hard-deny)
   nem ditado sem OK explícito na hora.
6. **Expiração de sessão = abort + resume idempotente:** nenhuma op de console
   fica meia-feita; re-autenticação é ato humano; ops dependentes de console
   são agrupadas no início da janela (T-0 e dia-D) para minimizar re-auth sob
   freeze.
7. **Catálogo NAV-AUTH:** OP-H (hPanel: Node, proxy, egress, deploy), DNS/CF
   (records, proxy grey→orange pós-cutover), Resend (sender + DKIM/SPF/DMARC),
   Neon (OP-C console-check §12.6, E-01 snapshot-create), Supabase (D2 role
   read-only).

## 4. Pacote de decisão de infra — 4 respostas de uma linha cada

| ID      | Pergunta (fato seu)            | Recomendação de engenharia                                                                                                                                                                      | Desbloqueia / consequência          |
| ------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| D-INF-1 | Domínio canônico + registrador | manter registrador atual; DNS gerenciado onde cair D-INF-2                                                                                                                                      | OP-H-4, TLS, DKIM                   |
| D-INF-2 | Cloudflare?                    | **SIM, DNS-only (grey cloud) pré-cutover**; proxy orange só pós-cutover com regras de cache — reduz variáveis na homologação (proxy >60s; CF free capa em 100s) e mantém egress/testes legíveis | egress 3/3; ready-503 interpretável |
| D-INF-3 | Remetente Resend               | `noreply@<domínio>` com DKIM/SPF/DMARC no DNS de D-INF-2; status "verified" como screenshot NAV-AUTH                                                                                            | signup/reset (OP-H-4)               |
| D-INF-4 | Tier hPanel/Cloud              | o que garantir Node ≥24.15 + proxy >60s + egress Neon; tier que não garanta = ABORT de homologação, sem gambiarra                                                                               | itens 1/5/9 do OP-H                 |

## 5. Sequência recomputada (donos ★/🤖)

08/09: RAT S0 + lacunas 1–4 (★ commits; 🤖 pré-flights/smokes) → 09/09: lacuna 5

- OP-H 10/11 em preview (NAV-AUTH) → 10/09: D2/V2b + bateria T1–T3/T7 em
  preview-bateria → 10–11/09: OP-H-4 (após D-INF) + T2 refinado → 11–12/09:
  cutover (T-0, T4-boot, T5/T6 em A5) → âncoras 06/10 WARN, <20/09 refresh
  nativo, 20/09 G1 sunset. OP-C fora da janela de maintenance 09–10/09.

## 6. O que preciso de você para liberar execução (3 atos, ~10 min)

1. **RAT S0** (assinatura/data no PS-01 §6): DP5=(b) + Emenda #6 — fecha a
   "lacuna 3" corretamente.
2. **As 4 linhas do pacote D-INF** (fatos de conta; minhas recomendações acima
   são defaults renunciáveis).
3. **OK explícito ao constraint da §0.2**: bateria pré-cutover somente em
   `preview-bateria-<data>`; produção read-only até o carimbo `Tráfego: EXISTE`.
