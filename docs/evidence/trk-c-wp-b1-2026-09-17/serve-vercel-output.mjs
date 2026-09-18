// Harness local mínimo para o Build Output API da Vercel (evidência do WP-B1 / TRILHO C).
//
// Não deploya nada: monta um `node:http` que (1) serve `.vercel/output/static` como filesystem e
// (2) encaminha o resto para o handler de fetch da função gerada pelo preset `vercel`
// (`.vercel/output/functions/__server.func/index.mjs`) — o mesmo shape que a plataforma invoca.
// Serve para medir, no browser, se o alvo Vercel continua injetando o script da analytics.
//
// Uso: node docs/evidence/trk-c-wp-b1-2026-09-17/serve-vercel-output.mjs --port=4393
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .map((raw) => /^--([^=]+)=(.*)$/.exec(raw))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
const port = Number(args.port ?? 4393);
const outputDir = path.resolve(args.output ?? ".vercel/output");
const staticDir = path.join(outputDir, "static");
const functionEntry = path.join(outputDir, "functions/__server.func/index.mjs");
const functionUrl = pathToFileURL(functionEntry).href;

const MIME = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

const { default: handler } = await import(functionUrl);

async function readStatic(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const candidate = path.join(staticDir, decoded);
  if (!candidate.startsWith(staticDir)) return null;
  try {
    const info = await stat(candidate);
    if (info.isDirectory()) return null;
    return { body: await readFile(candidate), type: MIME[path.extname(candidate)] };
  } catch {
    return null;
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  const staticFile = await readStatic(url.pathname);
  if (staticFile) {
    response.writeHead(200, { "content-type": staticFile.type ?? "application/octet-stream" });
    response.end(staticFile.body);
    return;
  }

  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  const functionResponse = await handler.fetch(new Request(url.href, { headers }), {
    waitUntil: () => {},
  });
  response.writeHead(
    functionResponse.status,
    Object.fromEntries(functionResponse.headers.entries()),
  );
  response.end(Buffer.from(await functionResponse.arrayBuffer()));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`vercel-output harness on http://127.0.0.1:${port} (static=${staticDir})`);
});
