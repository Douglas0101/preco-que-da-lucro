# B2 · RE-ARME DO WATCHER `app-live-watch` (detector do H-6)

**Artefato de preparação — 2026-09-19.** **NÃO executado** por esta sessão (sandbox). Requer processo **host-visible**.

## 1. Por que é urgente

| campo                                 | valor                                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Script                                | `~/.local/share/pi-fronts/app-live-watch.sh`                                                                       |
| Horizonte declarado no próprio script | `7 dias (604800 s / intervalo de 60 s = 10080 tentativas)` — `INTERVAL=60`, `ATTEMPTS=10080`                       |
| **Armado em (fato)**                  | **2026-09-14T03:37:56Z** — `~/.local/share/pi-fronts/app-live-watch.arm`                                           |
| **Caduca em (derivado: arm + 7 d)**   | **≈ 2026-09-21T03:37:56Z** (≈ 1,6 dia a partir de 2026-09-19T13:3xZ)                                               |
| Último poll observado                 | `2026-09-19T12:51:17Z` · `i=7530` · `/ready http=404 php=0 placeholder=0`                                          |
| Marcadores                            | `app-live.txt` **ausente** · `H2-ready.txt` **ausente** ⇒ nada disparou (correto: o alvo segue em placeholder PHP) |

**Consequência de não re-armar:** perde-se o **único detector automatizado** do H-6. O precedente está
documentado no journal §4: os watchers anteriores morreram em silêncio e _"a ausência dos marcadores
não podia ser lida como 'ainda aguardando': era cegueira"_. Sem re-arme, o dia-D passa a depender de
inspeção manual.

## 2. Invocação — lida do script, não inventada

O script é **auto-contido e não aceita argumentos**: não há `getopts`, `$1`, `usage`, `nohup`, `setsid`
nem `disown` no corpo (verificado por varredura do arquivo). Ele **escreve o `.arm`, registra a linha
`armed …` no log e entra em laço** de 10080 tentativas (≈ 7 d) com 60 s de intervalo; sai com `0` se
confirmar `APP_LIVE` (duas leituras 200 numa rota exclusiva do app, sem header PHP e sem corpo de
placeholder) e com `1` ao esgotar as tentativas.

Portanto: **armar = executar o script, desacoplado do terminal**. A sessão que armou em 2026-09-14
deixou como registro apenas os PIDs (`44531`/`44532` no journal §4) — **o mecanismo exato de
desacoplamento não está gravado no script nem no `.arm`**. Como a restrição é "não inventar comando",
o operador deve usar o mesmo mecanismo da sessão original; se este não for recuperável, o candidato
canônico é:

```bash
setsid nohup bash "$HOME/.local/share/pi-fronts/app-live-watch.sh" \
  >/dev/null 2>&1 < /dev/null &
echo "novo PID: $!"
```

> Registrar o PID novo no journal §4 **substituindo** a linha dos PIDs 44531/44532 (esses ficam como
> histórico), junto do horário UTC do re-arme.

## 3. Verificação pós-re-arme (obrigatória)

1. **O `.arm` foi reescrito?** — a linha `armado <UTC> base=… paths='/ready /live'` deve ter timestamp novo:
   ```bash
   cat "$HOME/.local/share/pi-fronts/app-live-watch.arm"
   ```
2. **O log voltou a anexar e o contador avançou?** — o contador `i` deve ir **além de 7530** (o script
   reinicia em `i=30`, `i=60`, …):
   ```bash
   tail -3 "$HOME/.local/share/pi-fronts/app-live-watch.log"
   ```
   > Atenção: o contador reinicia do zero no novo arme. O sinal de vida **não** é `i > 7530`, e sim
   > **novas linhas com timestamp posterior ao re-arme**.
3. **Os marcadores seguem corretamente ausentes?** — `app-live.txt` **deve continuar ausente** enquanto o
   alvo servir placeholder PHP. Se ele aparecer, o app subiu de verdade ⇒ acionar o runbook do dia-D.
4. **O script ainda é o mesmo?** — conferir que a sonda nunca usa `/` como sinal de vida (armadilha
   medida em 2026-09-14: o Hostinger responde `GET / → 200` com "Página padrão" PHP enquanto
   `/ready` e `/live` dão 404).

## 4. Se a decisão for NÃO re-armar

Declarar formalmente no journal, sem eufemismo:

```
| L## | HH:MM:SS | ✘ | **PERDA DE COBERTURA — detector H-6 (`app-live-watch`) caducou em ~2026-09-21T03:37Z e NÃO foi
  re-armado.** A partir daqui a detecção do dia-D depende de inspeção manual de
  https://darkgray-pony-545965.hostingersite.com/ready. Toda leitura de "sem marcador" deixa de ser
  evidência de "ainda aguardando" e passa a ser CEGUEIRA declarada. |
```

## 5. Observações de escopo

- O watcher **não lê segredo algum**: sonda apenas endpoint público (`/ready`, `/live`).
- O `h2-watch.sh` (token Vercel) existe, mas **não tem arquivo de log** em `~/.local/share/pi-fronts/`
  ⇒ sua vivacidade **não é verificável** por artefato; o marcador `H2-ready.txt` segue ausente. Se o
  re-arme for executado, verificar também o `h2-watch` pelo mesmo critério (marcador + log próprio).
- O `.arm` e o `.log` vivem em `$HOME`, **não** no repositório — nada aqui é versionado por este artefato.
