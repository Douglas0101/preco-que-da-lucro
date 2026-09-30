# D2 · H-6 — detecção do app-live bloqueada por Turnstile

**Briefing para ação humana — 2026-09-19.** ~2 minutos no Firefox; **prazo curto**.

## 1. O fato

| campo    | valor                                                                                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alvo     | `darkgray-pony-545965.hostingersite.com` (app hPanel)                                                                                                                        |
| Estado   | **placeholder PHP**: `GET /` ⇒ 200 "Página padrão" (`x-powered-by: PHP/8.3.33`, `server: hcdn`); `/ready`, `/live`, `/get-session`, `/api/vitals` ⇒ **404** com o mesmo HTML |
| Bloqueio | o **hPanel está protegido por Cloudflare Turnstile**; a automação foi reproduzida **headed e headless** e **não há contorno** ⇒ **H-6 é ato humano**                         |
| Detector | `app-live-watch.sh` ativo, último poll `2026-09-19T12:51:17Z` (`i=7530`, `/ready http=404`); marcadores `app-live.txt`/`H2-ready.txt` **ausentes**                           |

## 2. Ação humana (na ordem)

1. Abrir o **Firefox com o perfil logado** e completar o passo gateado pelo Turnstile no hPanel.
2. Executar a instrução clique-a-clique: **`docs/evidence/hpanel-homologacao-2026-09-12/SESSION-LIMIT.md`** —
   em resumo: definir `NPM_CONFIG_ENGINE_STRICT=false` → **Reimplantar** → configurar
   `BETTER_AUTH_URL` e `AUTH_TRUSTED_ORIGINS` no app `darkgray-pony-545965`.
3. Ao subir, os marcadores devem aparecer: `~/.local/share/pi-fronts/app-live.txt` (o watcher exige
   **duas** leituras 200 em `/ready` ou `/live`, sem header PHP e sem corpo de placeholder).
4. Atualizar `REGISTRO-H.md`: linha **H-6 → fechado** (com data/hora UTC).

## 3. Prazo e por que é urgente

- **O watcher caduca em ≈ 2026-09-21T03:37:56Z** (armado em 2026-09-14T03:37:56Z com horizonte de 7 d).
  Sem re-arme, perde-se o **único detector automatizado** do dia-D: a partir daí, _"sem marcador"_ deixa
  de significar _"ainda aguardando"_ e passa a ser **cegueira declarada** (precedente já registrado no
  journal §4, quando os watchers anteriores morreram em silêncio).
- O re-arme é uma ação **separada** e **não depende** de o hPanel responder — ver
  `docs/evidence/reconciliation-2026-09-19/B2-watcher-rearm.md`.

## 4. Armadilha medida (não cair nela)

Enquanto o build do alvo está **FAIL**, o Hostinger responde `GET /` com **200** e a "Página padrão" PHP.
Um detector ingênuo de "health 200" marcaria o dia-D como **aberto falsamente**. O watcher rearmado já
incorpora as quatro defesas: não sonda `/`; só aceita 200 em `/ready`/`/live`; rejeita `x-powered-by: PHP`
e corpo de placeholder; exige confirmação em segunda leitura. **Não substituir por um `curl /`.**

## 5. O que H-6 destrava quando fechar

Tráfego real, séries `OBSERVED` (`17.8`, `29.*`, `30`), e2e de CSP enforçada (`20.1`), e a via live de
`12.5`/`ORD-28` (dependem também de **H-2**).
