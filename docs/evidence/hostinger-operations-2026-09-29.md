# F14-6 — Operações Hostinger H-Panel: **bloqueado por pré-condição humana**

- **Ciclo:** 14 · **Fase:** F14-6 · **Autorização:** R9/R10 (AUTO) · **Data da medição:** 2026-09-29T05:53:48Z
- **Veredito:** **NÃO EXECUTADO — pré-condição não satisfeita.** Não é falha de execução, não é
  ausência de autorização e não é limite de capacidade do enxame. É uma dependência humana
  externa que o brief não podia suprir, e que este documento entrega resolvida em passos.

---

## 1. Os três bloqueios, independentes entre si

### 1.1 Não existe credencial de conta Hostinger

Medido: `env | cut -d= -f1 | grep -iE 'hostinger|hpanel'` → **nenhum resultado**. Os únicos
artefatos com nome parecido são `~/.config/hpanel-secrets.env` e `~/.config/hpanel-secrets.env.example`,
e o conteúdo de `.env` são **13 nomes de env do _aplicativo_** (`DATABASE_URL`,
`BETTER_AUTH_SECRET`, `AUTH_TRUSTED_ORIGINS`, `AI_GATEWAY_URL`, `AI_MODEL`, …) — **env do app,
não credencial de conta**. Um arquivo chamado `hpanel-secrets` que não contém segredo de hPanel
é uma armadilha de nomenclatura, e está registrada aqui para que ninguém a leia como
credencial num próximo ciclo.

### 1.2 O login é, por desenho, um passo humano

O brief tem uma contradição interna que precisa ser resolvida por decisão, não por execução: a
§6.2 manda o enxame **parar e escalar** diante de qualquer campo de senha/credencial, e a §7
lista _"campo de senha/credencial detectado → **para imediatamente**"_ entre os casos de
escala obrigatória — mas o roteiro do F14-6 §6.1 manda "preencher credenciais (via sidecar
BLIND se necessário)".

Resolução, pelo lado mais restritivo (que é o que a hierarquia `V0 > V8 > V6` e o fail-closed
exigem): **R9/R10 autorizam operações de DNS/SSL/redirect** _dentro_ do painel já autenticado.
A **autenticação em si** continua sendo o caso de escala da §6.2/§7. O enxame navega até a
tela de login, reconhece os campos, e **para**. Não há caminho em que o enxame digite a senha —
nem "via sidecar", porque o sidecar existe para **não** expor valor a quem o executa, e
`copy_to_clipboard` é um comando que o **operador humano** aciona, não um agente.

Isto não é um obstáculo contornável: é a salvaguarda funcionando.

### 1.3 O painel nega a automação

Medido agora: `https://hpanel.hostinger.com/` → **HTTP 403**. É **negação, não inalcançabilidade**
(o host resolve, conecta e recusa), e a evidência histórica do próprio repo
(`docs/evidence/hpanel-homologacao-2026-09-12/SESSION-LIMIT.md`) registra o mesmo resultado por
outro caminho (_"challenge Cloudflare ('Executando verificação de segurança'), inclusive em
modo headed e com espera de 45s"_), com a decisão já tomada e correta: _"canal negado pelo
sistema = **limite declarado**, nunca contorno agressivo"_.

**Não houve, neste ciclo, nenhuma tentativa de contornar o 403.** A leitura foi feita por `curl`,
o bloqueio foi registrado, e a fase parou — que é o comportamento prescrito.

## 2. Estado medido do alvo (agora, não citado de 2026-09-12)

| Medição                         | Valor de 2026-09-12 (registro histórico) | Valor medido em 2026-09-29T05:53Z                               |
| ------------------------------- | ---------------------------------------- | --------------------------------------------------------------- |
| DNS A do alvo                   | `89.116.213.100`, `77.37.42.28`          | **`free.cdn.hstgr.net.`** + `147.79.105.108` + `91.108.127.165` |
| `GET /`                         | 200 (placeholder PHP)                    | **200** (inalterado)                                            |
| `GET /ready`                    | 404                                      | **404** (inalterado)                                            |
| `https://hpanel.hostinger.com/` | challenge Cloudflare em headed           | **403**                                                         |

O DNS **mudou** e a aplicação **não** foi implantada. As duas leituras juntas são a informação
útil: o host está vivo e servindo outra coisa, e a mudança de IP não aproximou o deploy.

## 3. O que está bloqueado está **desalinhado** do roteiro do brief

O brief §6.2 do F14-6 especifica operações de **DNS, SSL e redirects** (`http→https`,
`www→apex`). Medido: o alvo é um **subdomínio gratuito** `darkgray-pony-545965.hostingersite.com`,
não um domínio próprio — não há zona DNS própria para editar nem `www` a redirecionar. E a
necessidade real medida é **outra**: o build falha e a aplicação não sobe, então o que destrava
é **reimplantar com as env corretas**, não mexer em DNS/SSL.

Registrar a divergência é o entregável aqui. Executar o roteiro como escrito produziria
operações de DNS que não mudam nada e um relatório que pareceria cumprido.

## 4. Os três bloqueios convergem para a mesma fila humana

H-6, em `docs/evidence/agent-state/DECISIONS-PENDING/REGISTRO-H.md:9` — _"homologação hPanel:
redeploy + env de auth"_ · tier **C** · brief `H-6.md` · ação **"A — executar agora"** ·
aguardando desde **2026-09-12** · destrava _"tráfego real, séries `OBSERVED`, e2e CSP, `12.5` live"_.

O caminho no recon anterior (`docs/evidence/agent-state/REGISTRO-H.md`) **não existe**; o
arquivo vive sob `DECISIONS-PENDING/`. Corrigido aqui para que o ponteiro não seja repetido errado.

### 4.1 ERRATA — o prazo citado no registry está desatualizado

`REGISTRO-H.md:27` afirma que o detector `app-live-watch` foi _"re-armado em 2026-09-19T15:31:33Z
e caduca em ≈2026-09-26T15:31Z"_. Medido no arquivo de estado
`~/.local/share/pi-fronts/app-live-watch.arm` (404 B):

```text
armado 2026-09-14T03:37:56Z base=https://darkgray-pony-545965.hostingersite.com paths='/ready /live'
armado 2026-09-19T15:31:33Z base=https://darkgray-pony-545965.hostingersite.com paths='/ready /live'
armado 2026-09-28T02:24:57Z base=https://darkgray-pony-545965.hostingersite.com paths='/ready /live'
armado 2026-09-28T02:25:11Z base=https://darkgray-pony-545965.hostingersite.com paths='/ready /live'
```

Há **duas** armagens posteriores (2026-09-28), e a linha do registry é anterior a elas. Ou seja:
a prosa do registry faz o watcher parecer **caducado** quando ele está **armado**. É a mesma
classe de defeito de `DBT-34` — prosa que afirma o contrário do artefato, sem asserção que as
ligue — e fica declarada aqui em vez de silenciada.

## 5. Ação humana — os passos exatos para destravar

Origem: `docs/evidence/hpanel-homologacao-2026-09-12/SESSION-LIMIT.md` § _"Ação humana — H-6
(~2 min, no seu Firefox)"_. **O que o enxame não pode fazer é o login; do resto ele dá conta.**

1. Abrir `https://hpanel.hostinger.com/` no **seu** navegador e fazer o login (2FA no seu
   dispositivo, se pedido). _O enxame para aqui, por desenho._
2. Ir ao painel do site `darkgray-pony-545965.hostingersite.com` → **Variáveis de ambiente**.
3. Adicionar `NPM_CONFIG_ENGINE_STRICT=false` (é o que destrava o build).
4. Adicionar `BETTER_AUTH_URL=https://darkgray-pony-545965.hostingersite.com`.
5. Adicionar `AUTH_TRUSTED_ORIGINS=https://darkgray-pony-545965.hostingersite.com`.
6. **Reimplantar.**

## 6. O que o enxame retoma no instante em que o deploy passar

Sem novas autorizações, e tudo por `curl`/`dig`/`openssl` — sem precisar do painel:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://darkgray-pony-545965.hostingersite.com/ready   # esperado 200
dig +short darkgray-pony-545965.hostingersite.com A
openssl s_client -connect darkgray-pony-545965.hostingersite.com:443 \
  -servername darkgray-pony-545965.hostingersite.com </dev/null 2>/dev/null | openssl x509 -noout -dates
curl -sSI http://darkgray-pony-545965.hostingersite.com/ | grep -iE '^HTTP|^location'
```

Estas são as **gates Hostinger da §9.3**, e elas não exigem sessão autenticada: quando o deploy
existir, o próprio enxame fecha a fase. É por isso que este documento entrega passos e não um
pedido de intervenção.

## 7. Limite declarado

- **Nenhuma operação de DNS, SSL ou redirect foi executada** — e não havia o que executar (§3).
- **Nenhuma tentativa de contornar o 403** foi feita.
- **Nenhum segredo foi digitado, copiado ou persistido**: a fase parou no login, como manda a §6.2.
- **`0` screenshots** foram produzidos nesta fase — não há artefato visual, e portanto não há
  redaction a auditar. Ausência de captura aqui é consequência do bloqueio, não do esquecimento.
