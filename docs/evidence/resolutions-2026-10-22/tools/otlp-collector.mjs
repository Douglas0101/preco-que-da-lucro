import { createServer } from "node:http";
import { appendFileSync } from "node:fs";

const logPath = process.argv[2] ?? "/tmp/opencode/otlp-requests.jsonl";
const server = createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    appendFileSync(
      logPath,
      `${JSON.stringify({
        at: new Date().toISOString(),
        method: req.method,
        path: req.url,
        contentType: req.headers["content-type"] ?? null,
        bytes: body.length,
      })}\n`,
    );
    res.writeHead(200, { "content-type": "application/x-protobuf" });
    res.end();
  });
});

server.listen(4318, "127.0.0.1", () => {
  appendFileSync(
    logPath,
    `${JSON.stringify({ at: new Date().toISOString(), event: "listening" })}\n`,
  );
  console.log("collector listening on 4318");
});
