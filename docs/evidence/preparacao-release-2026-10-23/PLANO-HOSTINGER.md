# Plano de transição para VPS Hostinger (deferido, nenhuma ação executada)

**Status:** documento de planejamento. Nenhum VPS foi comprado, nenhum DNS foi alterado, nenhum certificado foi emitido e nenhuma credencial foi lida. `vps_virtual-machines_list` retornou `[]`.

## 1. Fato-fonte que muda o enquadramento

O prompt trata a transição como “Vercel → VPS”. A medição mostra outra coisa:

- `diretrizprecifica.com` (apex) é **Hostinger Horizons**: `ALIAS diretrizprecifica.com.cdn.hstgr.net`, `server: hcdn`, `x-powered-by: Hostinger Horizons`, `/api/health/ready` devolve **HTML**, não o app.
- O app Vercel vive em `preco-que-da-lucro-sage.vercel.app` e aliases do projeto; `staging.diretrizprecifica.com` é um CNAME para a Vercel.
- Portanto a troca de apex não é “mover o app da Vercel para o VPS”: é **substituir um site Horizons por um app**. O conteúdo atual do apex precisa de decisão explícita (descartar, migrar ou manter em subdomínio).

## 2. Decisões que precisam ser tomadas antes de qualquer provisionamento

| #   | Decisão               | Opções                                                       | Recomendação                                                                                                                                           |
| --- | --------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Banco de dados no VPS | (a) manter Neon gerenciado; (b) Postgres self-hosted no VPS  | **(a) manter Neon** na primeira fase: PITR, backups e RLS já qualificados; self-hosted adiciona operação de DB e risco de perda. Reavaliar depois.     |
| D2  | Destino do apex       | (a) app no apex; (b) app em `app.` e manter Horizons no apex | (a) é o objetivo do produto; (b) reduz risco, mas não cumpre “domínio canônico do app”.                                                                |
| D3  | `www`                 | (a) redirect 301 para apex; (b) servir o app                 | (a), com exceção se o app exigir `www`.                                                                                                                |
| D4  | E-mail                | Preservar MX/SPF/DKIM/DMARC atuais                           | **Preservar**; não usar `dns_records_reset` e não sobrescrever a zona inteira.                                                                         |
| D5  | TLS antes do DNS      | HTTP-01 não valida o apex antes de o apex apontar para o VPS | **DNS-01** (TXT `_acme-challenge`) para emitir o certificado do apex antes do cutover; ou validar primeiro em `vps.diretrizprecifica.com` com HTTP-01. |
| D6  | Rollback              | Reapontar o apex para o ALIAS Hostinger                      | Manter o site Horizons e o deployment Vercel intactos durante a janela.                                                                                |

## 3. Arquitetura alvo (proposta)

```
Internet
  │
  ├─ apex/www ──► VPS Hostinger (Ubuntu 24.04 LTS)
  │                 ├─ Caddy ou Nginx (TLS, HTTP→HTTPS, headers)
  │                 ├─ app Node (preset node-server; `npm start` em .output/server/index.mjs)
  │                 ├─ healthcheck /api/health/ready
  │                 └─ OTel collector + logs locais
  │
  └─ staging ───► Vercel preview (mantido para validação)
                    │
                    └─ Neon (produção) — conexão TLS pooled/direta conforme decisão INFRA-01
```

- **Runtime:** Node 24 (`.nvmrc`), build `npm ci && npm run build`, artefato `.output/`; processo supervisionado por `systemd` ou Docker Compose com `restart: unless-stopped`.
- **Banco:** Neon produção continua sendo o banco; a VPS recebe `DATABASE_URL` por secret management (não no repositório). Se D1 mudar para self-hosted, exige backup/PITR/RLS próprios antes do cutover.
- **Segurança:** usuário non-root, SSH por chave, `ufw` (22/80/443), fail2ban, unattended-upgrades, TLS 1.2+, HSTS, CSP da aplicação, rate limit no proxy, segredos fora do filesystem do repo.
- **Observabilidade:** health check externo (1 min), logs estruturados, OTel para collector, alerta de 5xx/latência, retenção local.

## 4. Sequência segura (testar primeiro, DNS depois)

### Fase A — provisionamento (requer compra e autorização)

1. Comprar VPS (KVM, Ubuntu 24.04 LTS, região próxima do público; 2 vCPU/4 GB como piso para build + app).
2. Instalar chave SSH pública; não usar senha de root.
3. Registrar ID, hostname, datacenter e janela.

### Fase B — hardening (sem DNS)

1. Criar usuário de deploy, desabilitar login root e senha no SSH.
2. `ufw` deny incoming / allow 22, 80, 443; fail2ban; unattended-upgrades.
3. Timezone UTC; NTP; swap; limites de arquivo; rotação de logs.

### Fase C — runtime (sem DNS)

1. Instalar Node 24 + dependências de build; ou Docker + Compose.
2. Clonar o repositório no SHA exato aprovado (não `develop` móvel); `npm ci`; `npm run build`.
3. Configurar env por secret (nunca no repo): `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `DATABASE_DRIVER`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `AUTH_TRUSTED_ORIGINS`, `DEEPSEEK_API_KEY`, `OTEL_*`, `CSP_ENFORCE`.
4. Subir o serviço; validar `curl http://127.0.0.1:3000/api/health/ready` → 200 `postgres: ok`.
5. Configurar proxy reverso e health check local.

### Fase D — TLS antes do cutover

- **Opção 1 (recomendada): DNS-01.** Emitir certificado para `diretrizprecifica.com` criando TXT `_acme-challenge` via API Hostinger (operação de escrita, exige aprovação). O certificado fica pronto antes de o apex apontar para a VPS.
- **Opção 2: subdomínio de validação.** Criar `vps.diretrizprecifica.com` → IP da VPS (A), emitir por HTTP-01, validar o app nesse host e só depois trocar o apex. O certificado do apex ainda precisará de DNS-01 ou de nova emissão após o cutover.
- Nunca emitir certificado de produção em modo staging e esquecer o `--dry-run` removido.

### Fase E — validação no host de teste (sem tocar o apex)

1. `curl -I https://vps.diretrizprecifica.com/` → 200, HSTS, CSP report-only, `x-frame-options: DENY`.
2. `curl https://vps.diretrizprecifica.com/api/health/ready` → 200 `postgres: ok`.
3. Login sintético, `/novo-produto`, chat, `/produtos`, `/diagnostico`, `/simulacoes`.
4. Rodar o smoke E2E anônimo e o gate visual contra o host de teste.
5. Medir latência, memória, CPU e logs por 24 h.

### Fase F — cutover do apex (requer aprovação explícita)

1. Baixar o TTL do apex para 300 s (já está 300) e aguardar o TTL anterior expirar.
2. **Validar a zona** com `dns_records_validate` (read-only) antes de qualquer update.
3. Atualizar **somente** o registro `@` (ALIAS → A para o IP da VPS, ou ALIAS para um hostname estável). **Não** usar `overwrite=true` na zona inteira: isso pode apagar MX/SPF/DKIM/DMARC.
4. Atualizar `www` para o mesmo destino (ou redirect 301).
5. Verificar de múltiplos resolvedores (`dig @1.1.1.1`, `@8.8.8.8`, `@9.9.9.9`) e de uma rede externa.
6. Monitorar 5xx, latência e health por 30 min; manter a janela aberta.

### Fase G — rollback (pronto, não executado)

1. Restaurar `@ ALIAS diretrizprecifica.com.cdn.hstgr.net` (TTL 300).
2. Restaurar `www` se alterado.
3. Validar `dig` e `curl` no apex; confirmar Horizons 200.
4. Manter Vercel e Horizons por 30 dias; só descomissionar após 7–14 dias estáveis.

### Fase H — descomissionamento

- Snapshot da VPS, export do banco (se self-hosted), cópia dos logs e do certificado.
- Remover o site Horizons somente após a janela de rollback.
- Atualizar `docs/MAPA-OPERACIONAL.md` e este plano com o estado real.

## 5. API Hostinger — sequência exata (não executada)

```
1. dns_records_list(domain)                       # read-only, estado atual
2. montar zone[] apenas com @ e www               # preservar mail/DKIM/SPF/DMARC
3. dns_records_validate(domain, zone)             # read-only, 200/422
4. [GATE HUMANO]
5. dns_records_update(domain, zone, overwrite=false)  # escrita, exige aprovação
6. dns_snapshots_list(domain)                     # ponto de rollback
```

`dns_records_validate` é read-only e **deve** rodar antes do update. `dns_records_reset` e `dns_snapshots_restore` são destrutivos e não fazem parte do caminho feliz.

## 6. Critérios de aceite do cutover

- [ ] App responde 200 no host de teste antes de qualquer mudança no apex.
- [ ] `/api/health/ready` 200 `postgres: ok` no host de teste.
- [ ] Certificado válido para o apex **antes** do cutover (DNS-01) ou emitido no host de teste e reemitido no cutover.
- [ ] Zona validada com `dns_records_validate` 200.
- [ ] Apenas `@`/`www` alterados; MX/SPF/DKIM/DMARC intactos (`dig` + `dns_records_list`).
- [ ] Propagação confirmada em ≥ 3 resolvedores.
- [ ] 30 min sem 5xx e com latência p95 aceitável.
- [ ] Rollback ensaiado (documento + comandos), mesmo que não executado.
- [ ] Produção Vercel e Horizons preservados durante a janela.

## 7. Riscos

| Risco                                 | Mitigação                                                     |
| ------------------------------------- | ------------------------------------------------------------- |
| Sobrescrever a zona e perder e-mail   | Atualizar só `@`/`www`; validar; snapshot antes               |
| Certificado não emitido antes do apex | DNS-01 ou host de teste com HTTP-01                           |
| App sem env de IA/auth                | Secret management + smoke autenticado antes do cutover        |
| Banco self-hosted sem PITR            | Manter Neon na fase 1                                         |
| Rollback lento                        | TTL 300 + ALIAS antigo documentado + Vercel/Horizons intactos |
| Vazamento de segredo no VPS           | Sem credenciais no repo; permissões 0600; rotação Via A       |

## 8. O que não foi feito

Nenhuma compra, nenhum provisionamento, nenhuma alteração de DNS, nenhum certificado, nenhuma conexão à VPS, nenhuma leitura de segredo. A zona foi apenas **lida** (`dns_records_list`) e o inventário de VPS consultado (`[]`).

## 9. Gate

> **G5:** “Aprovo o plano Hostinger” — aprova o **documento**, não a execução. Compra, provisionamento, emissão de certificado e cutover exigem autorização separada, com janela e orçamento declarados.
