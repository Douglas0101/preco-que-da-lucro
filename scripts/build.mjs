import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateBuild, warningAllowlist } from "./lib/build-warnings.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteCli = path.join(root, "node_modules/vite/bin/vite.js");
const reportPath = path.join(root, ".artifacts/build-warnings.json");

let stdout = "";
let stderr = "";
const child = spawn(process.execPath, [viteCli, "build"], {
  cwd: root,
  env: process.env,
  stdio: ["inherit", "pipe", "pipe"],
});

child.stdout.on("data", (chunk) => {
  stdout += chunk;
  process.stdout.write(chunk);
});
child.stderr.on("data", (chunk) => {
  stderr += chunk;
  process.stderr.write(chunk);
});

const exitCode = await new Promise((resolve, reject) => {
  child.once("error", reject);
  child.once("close", (code) => resolve(code ?? 1));
});

const { releaseChannel, observedWarnings, unexpectedWarnings, passed } = evaluateBuild({
  exitCode,
  stdout,
  stderr,
});
const report = {
  schemaVersion: 1,
  commit: process.env.GITHUB_SHA ?? null,
  checkedAt: new Date().toISOString(),
  releaseChannel,
  exitCode,
  passed,
  allowlist: warningAllowlist,
  observedWarnings,
};

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

if (unexpectedWarnings.length > 0) {
  console.error("Build emitted unregistered or expired warnings:");
  for (const warning of unexpectedWarnings) console.error(`- ${warning.line}`);
}

if (!passed) process.exitCode = exitCode || 1;
