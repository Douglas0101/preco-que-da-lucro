# Reconciliação M-02 (§13.4/§13.5) — SRC_URL × DST_URL

- gerado_em: 2026-09-08T00:43:05.753Z
- source_env: `SRC_URL` (valor da URL omitido por norma)
- target_env: `DST_URL` (valor da URL omitido por norma)
- modo: somente leitura (`start transaction read only` + rollback; apenas SELECT)
- métricas por tabela (§13.4): row count; null count por coluna; min/max de timestamps (created_at/updated_at); soma de colunas financeiras; órfãos por FK declarada no target; checksum sha256 da amostra (≤100 linhas ordenadas pela PK, to_jsonb(t)::text)

## Tabela §13.5

| table                  | source_count | target_count | difference | status |
| ---------------------- | -----------: | -----------: | ---------: | ------ |
| accounts               |            0 |            0 |          0 | OK     |
| ai_daily_budgets       |            0 |            0 |          0 | OK     |
| ai_usage               |            0 |            0 |          0 | OK     |
| audit_events           |            0 |            0 |          0 | OK     |
| calculation_snapshots  |            0 |            0 |          0 | OK     |
| chat_conversations     |            0 |            0 |          0 | OK     |
| chat_messages          |            0 |            0 |          0 | OK     |
| expenses               |            0 |            0 |          0 | OK     |
| idempotency_records    |            0 |            0 |          0 | OK     |
| market_prices          |            0 |            0 |          0 | OK     |
| product_ingredients    |            0 |            0 |          0 | OK     |
| product_packaging      |            0 |            0 |          0 | OK     |
| products               |            0 |            0 |          0 | OK     |
| profiles               |            0 |            0 |          0 | OK     |
| purchase_price_history |            0 |            0 |          0 | OK     |
| rate_limits            |            0 |            0 |          0 | OK     |
| sales                  |            0 |            0 |          0 | OK     |
| sales_fees             |            0 |            0 |          0 | OK     |
| sales_items            |            0 |            0 |          0 | OK     |
| sessions               |            0 |            0 |          0 | OK     |
| simulations            |            0 |            0 |          0 | OK     |
| tenant_memberships     |            0 |            0 |          0 | OK     |
| tenants                |            0 |            0 |          0 | OK     |
| tool_executions        |            0 |            0 |          0 | OK     |
| users                  |            0 |            0 |          0 | OK     |
| verifications          |            0 |            0 |          0 | OK     |

## Detalhes por tabela

### accounts

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
  - updated_at: source=[null .. null] target=[null .. null] equal=true
- orphans (FKs declaradas no target):
  - accounts_user_id_users_id_fk (accounts → users): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### ai_daily_budgets

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - updated_at: source=[null .. null] target=[null .. null] equal=true
- financial_sums:
  - estimated_cost: source=null target=null equal=true
  - estimated_cost_unknown_count: source=null target=null equal=true
- orphans (FKs declaradas no target):
  - ai_daily_budgets_tenant_id_tenants_id_fk (ai_daily_budgets → tenants): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### ai_usage

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- financial_sums:
  - estimated_cost: source=null target=null equal=true
- orphans (FKs declaradas no target):
  - ai_usage_tenant_id_tenants_id_fk (ai_usage → tenants): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### audit_events

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
- orphans (FKs declaradas no target):
  - audit_events_tenant_id_user_id_tenant_memberships_tenant_id_use (audit_events → tenant_memberships): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### calculation_snapshots

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
- orphans (FKs declaradas no target):
  - calculation_snapshots_tenant_id_user_id_tenant_memberships_tena (calculation_snapshots → tenant_memberships): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### chat_conversations

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
  - state_updated_at: source=[null .. null] target=[null .. null] equal=true
  - updated_at: source=[null .. null] target=[null .. null] equal=true
- orphans (FKs declaradas no target):
  - chat_conversations_tenant_id_current_product_id_products_tenant (chat_conversations → products): source=0 target=0 equal=true
  - chat_conversations_tenant_id_user_id_tenant_memberships_tenant_(chat_conversations → tenant_memberships): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### chat_messages

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
- orphans (FKs declaradas no target):
  - chat_messages_tenant_id_conversation_id_chat_conversations_tena (chat_messages → chat_conversations): source=0 target=0 equal=true
  - chat_messages_tenant_id_user_id_tenant_memberships_tenant_id_us (chat_messages → tenant_memberships): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### expenses

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
  - updated_at: source=[null .. null] target=[null .. null] equal=true
- financial_sums:
  - amount: source=null target=null equal=true
- orphans (FKs declaradas no target):
  - expenses_tenant_id_user_id_tenant_memberships_tenant_id_user_id (expenses → tenant_memberships): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### idempotency_records

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
  - updated_at: source=[null .. null] target=[null .. null] equal=true
- orphans (FKs declaradas no target):
  - idempotency_records_tenant_id_user_id_tenant_memberships_tenant (idempotency_records → tenant_memberships): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### market_prices

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
- financial_sums:
  - avg_price: source=null target=null equal=true
  - max_price: source=null target=null equal=true
  - min_price: source=null target=null equal=true
- orphans (FKs declaradas no target):
  - market_prices_tenant_id_product_id_products_tenant_id_id_fk (market_prices → products): source=0 target=0 equal=true
  - market_prices_tenant_id_user_id_tenant_memberships_tenant_id_us (market_prices → tenant_memberships): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### product_ingredients

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
  - price_updated_at: source=[null .. null] target=[null .. null] equal=true
  - updated_at: source=[null .. null] target=[null .. null] equal=true
- financial_sums:
  - package_price: source=null target=null equal=true
- orphans (FKs declaradas no target):
  - product_ingredients_tenant_id_product_id_products_tenant_id_id_ (product_ingredients → products): source=0 target=0 equal=true
  - product_ingredients_tenant_id_user_id_tenant_memberships_tenant (product_ingredients → tenant_memberships): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### product_packaging

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
  - price_updated_at: source=[null .. null] target=[null .. null] equal=true
  - updated_at: source=[null .. null] target=[null .. null] equal=true
- financial_sums:
  - package_price: source=null target=null equal=true
- orphans (FKs declaradas no target):
  - product_packaging_tenant_id_product_id_products_tenant_id_id_fk (product_packaging → products): source=0 target=0 equal=true
  - product_packaging_tenant_id_user_id_tenant_memberships_tenant_i (product_packaging → tenant_memberships): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### products

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
  - updated_at: source=[null .. null] target=[null .. null] equal=true
- financial_sums:
  - current_price: source=null target=null equal=true
  - tax_rate: source=null target=null equal=true
- orphans (FKs declaradas no target):
  - products_tenant_id_user_id_tenant_memberships_tenant_id_user_id (products → tenant_memberships): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### profiles

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
  - updated_at: source=[null .. null] target=[null .. null] equal=true
- orphans (FKs declaradas no target):
  - profiles_id_users_id_fk (profiles → users): source=0 target=0 equal=true
  - profiles_tenant_id_user_id_tenant_memberships_tenant_id_user_id (profiles → tenant_memberships): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### purchase_price_history

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- financial_sums:
  - price: source=null target=null equal=true
- orphans (FKs declaradas no target):
  - purchase_price_history_tenant_id_ingredient_id_product_ingredie (purchase_price_history → product_ingredients): source=0 target=0 equal=true
  - purchase_price_history_tenant_id_packaging_id_product_packaging (purchase_price_history → product_packaging): source=0 target=0 equal=true
  - purchase_price_history_tenant_id_user_id_tenant_memberships_ten (purchase_price_history → tenant_memberships): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### rate_limits

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### sales

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
- financial_sums:
  - gross_amount: source=null target=null equal=true
  - net_amount: source=null target=null equal=true
- orphans (FKs declaradas no target):
  - sales_tenant_id_user_id_tenant_memberships_tenant_id_user_id_fk (sales → tenant_memberships): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### sales_fees

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
  - updated_at: source=[null .. null] target=[null .. null] equal=true
- orphans (FKs declaradas no target):
  - sales_fees_tenant_id_product_id_products_tenant_id_id_fk (sales_fees → products): source=0 target=0 equal=true
  - sales_fees_tenant_id_user_id_tenant_memberships_tenant_id_user_(sales_fees → tenant_memberships): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### sales_items

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
- financial_sums:
  - total_amount: source=null target=null equal=true
  - unit_price: source=null target=null equal=true
- orphans (FKs declaradas no target):
  - sales_items_tenant_id_product_id_products_tenant_id_id_fk (sales_items → products): source=0 target=0 equal=true
  - sales_items_tenant_id_sale_id_sales_tenant_id_id_fk (sales_items → sales): source=0 target=0 equal=true
  - sales_items_tenant_id_user_id_tenant_memberships_tenant_id_user (sales_items → tenant_memberships): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### sessions

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
  - updated_at: source=[null .. null] target=[null .. null] equal=true
- orphans (FKs declaradas no target):
  - sessions_user_id_users_id_fk (sessions → users): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### simulations

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
  - updated_at: source=[null .. null] target=[null .. null] equal=true
- orphans (FKs declaradas no target):
  - simulations_tenant_id_product_id_products_tenant_id_id_fk (simulations → products): source=0 target=0 equal=true
  - simulations_tenant_id_user_id_tenant_memberships_tenant_id_user (simulations → tenant_memberships): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### tenant_memberships

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
  - updated_at: source=[null .. null] target=[null .. null] equal=true
- orphans (FKs declaradas no target):
  - tenant_memberships_tenant_id_tenants_id_fk (tenant_memberships → tenants): source=0 target=0 equal=true
  - tenant_memberships_user_id_users_id_fk (tenant_memberships → users): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### tenants

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
  - updated_at: source=[null .. null] target=[null .. null] equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### tool_executions

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- financial_sums:
  - estimated_cost: source=null target=null equal=true
- orphans (FKs declaradas no target):
  - tool_executions_tenant_id_user_id_tenant_memberships_tenant_id_ (tool_executions → tenant_memberships): source=0 target=0 equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### users

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
  - updated_at: source=[null .. null] target=[null .. null] equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

### verifications

- row_count: source=0 target=0
- null_counts: nenhum null em coluna comum
- timestamp_bounds (min/max, UTC):
  - created_at: source=[null .. null] target=[null .. null] equal=true
  - updated_at: source=[null .. null] target=[null .. null] equal=true
- sample_checksum (0/100 linhas, sha256): source=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 target=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855 equal=true

## Sumário

- tables_compared: 26
- differences_total: 0
- pass: true
