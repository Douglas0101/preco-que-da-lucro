# Pedido D2 — credencial read-only do legado Supabase (V2b)

> Lacuna 6 do ADD-OPS: "Pedido literal pronto". A credencial **não** transita
> por chat, argv, log ou evidência — entrega exclusivamente pelo canal de
> segredos combinado (após Emenda #5: `.env.sanctioned-remote`; hoje: export
> no shell da janela, pelo dono).

---

**Para:** D2 (dono da conta Supabase legada)
**Prazo de resposta:** **10/09/2026** — após isso a V2b fica inconclusa e o
freeze registra **NO-GO datado** (regra do runbook `cutover-A4.md` §13).

**Pedido (uma frase):** fornecer uma **Postgres URI somente-leitura** do
Supabase legado, com role de apenas `SELECT`, acesso aos schemas `auth` e
`public`, para a janela V2b de reconciliação legado×Neon.

**Requisitos técnicos:**

- Variável de destino: `SUPABASE_MIGRATION_DATABASE_URL`
- Permissão: **read-only** (somente `SELECT`; sem INSERT/UPDATE/DDL)
- Escopo: schemas `auth` e `public` (leitura de contagens, somas financeiras,
  timestamps e amostras para checksum — ver `m02:reconcile` §13.4)
- Validade curta (recomendado: expirar em ≤7 dias) e revogável no emissor
- Nenhum valor deve aparecer em ticket, chat ou documento — só a confirmação
  de que a variável foi provisionada no canal de segredos

**Como será consumida (transparência):**

- Comando único: `npm run m02:v2b` (janela V2b, **antes** da declaração de freeze)
- Cria branch efêmera `dryrun-v2b-<data>` (kind `drill-branch`, expira +24h),
  migra 11/11 no-op, carrega cópia do legado, reconcilia as duas pontas,
  schema-diff triado e **cleanup always() com prova antes/depois**
- Produção **nunca** é conectada; a credencial é lida do ambiente por NOME
  (`--env` names only), hosts mascarados em todo log
- Sem a credencial: preflight do `m02:v2b` recusa pré-conexão com **exit 3**
  (comprovado nesta rodada: `sockets_abertos: 0`) — nenhum improvisos
  via API/publishable key

**O que destrava:** paridade legado×Neon **MEDIDA-EM-CÓPIA** (hoje:
DESCONHECIDA) → Manifest 6 → condição prévia do freeze e do cutover H5.
