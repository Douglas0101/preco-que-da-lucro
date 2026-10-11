/**
 * Página de falha catastrófica (HTTP 500), emitida por `src/server.ts` e
 * `src/start.ts` — e ambas as respostas carregam `securityHeaders()`, ou seja,
 * `style-src 'self'` e `script-src 'self'`.
 *
 * Por isso o HTML fica restrito ao que a política autoriza:
 *
 * - **nenhum `<style>` inline.** Um bloco `<style>` no documento é
 *   `style-src-elem`/`blockedURI: inline` e não pode receber nonce nem hash por
 *   declaração de spec (§20.1 não usa nonce). A aparência vem da folha estática
 *   `/error-page.css`, servida pela própria origem — o único tipo de estilo que
 *   `style-src 'self'` permite.
 * - **nenhum handler inline.** `onclick` é `script-src-attr`: um atributo de
 *   evento nunca pode ser nonced nem hasheado, então a única saída CSP-limpa é
 *   não usá-lo. "Tentar novamente" é um `<a href="">`: a URL vazia resolve para
 *   o endereço do próprio documento, o que recarrega a página sem JavaScript e
 *   sem depender do bundle da aplicação (que pode ser justamente o que falhou).
 * - **nenhum `<script>`.** Um script externo seria `script-src 'self'` e
 *   portanto permitido, mas numa página de 500 o bundle pode não existir; o link
 *   é estritamente melhor.
 */
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="/error-page.css" />
  </head>
  <body>
    <div class="card">
      <h1>This page didn't load</h1>
      <p>Something went wrong on our end. You can try refreshing or head back home.</p>
      <div class="actions">
        <a class="primary" href="">Try again</a>
        <a class="secondary" href="/">Go home</a>
      </div>
    </div>
  </body>
</html>`;
}
