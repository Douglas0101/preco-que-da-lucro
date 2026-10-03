import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  bucketPreflight,
  metadata,
  openDump,
  openInventory,
  recoveryConfig,
  sealDump,
  sealInventory,
  uploadEncrypted,
  type AwsCall,
} from "../lib/independent-backup.ts";

export function awsCli(region: string, remainingMs = () => 300000): AwsCall {
  return async (service, operation, args) => {
    const env: NodeJS.ProcessEnv = { ...process.env, AWS_PAGER: "", AWS_CLI_AUTO_PROMPT: "off" };
    for (const name of Object.keys(env)) if (name.startsWith("AWS_ENDPOINT_URL")) delete env[name];
    try {
      const budget = Math.floor(remainingMs());
      if (!Number.isSafeInteger(budget) || budget <= 0 || budget > 300000)
        throw new Error("AWS deadline exhausted");
      const result = execFileSync(
        "aws",
        [
          service,
          operation,
          ...args,
          "--region",
          region,
          "--endpoint-url",
          `https://${service === "sts" ? "sts" : "s3"}.${region}.amazonaws.com`,
          "--output",
          "json",
          "--no-cli-pager",
          "--no-cli-auto-prompt",
          "--cli-connect-timeout",
          "15",
          "--cli-read-timeout",
          "60",
        ],
        {
          env,
          stdio: ["ignore", "pipe", "pipe"],
          timeout: budget,
          maxBuffer: 65536,
          encoding: "utf8",
        },
      );
      return JSON.parse(result);
    } catch {
      throw new Error("AWS operation unavailable; raw credentials/provider error withheld");
    }
  };
}
async function main() {
  const argv = process.argv.slice(2),
    operation = argv.shift();
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    if (
      !["--input", "--key-file", "--metadata", "--config", "--directory"].includes(argv[i]) ||
      !argv[i + 1] ||
      args.has(argv[i])
    )
      throw new Error("invalid arguments");
    args.set(argv[i], argv[i + 1]);
  }
  const required = (name: string) => {
    const v = args.get(name);
    if (!v) throw new Error("missing argument");
    return v;
  };
  const json = (name: string) => JSON.parse(readFileSync(required(name), "utf8")) as unknown;
  if (operation === "seal" || operation === "seal-inventory") {
    const seal = operation === "seal" ? sealDump : sealInventory;
    const result = await seal(
      required("--input"),
      required("--key-file"),
      metadata(json("--metadata")),
      required("--directory"),
    );
    await appendFile(
      join(required("--directory"), "receipt.jsonl"),
      JSON.stringify(result) + "\n",
      { mode: 0o600, flag: "wx" },
    );
    console.log("ENCRYPTED-LOCAL; snapshot and restore not proved");
  } else if (operation === "open" || operation === "open-inventory") {
    const open = operation === "open" ? openDump : openInventory;
    await open(required("--input"), required("--key-file"), required("--directory"));
    console.log("AUTHENTICATED-LOCAL; isolated database restore not proved");
  } else if (operation === "preflight" || operation === "upload") {
    const config = recoveryConfig(json("--config")),
      aws = awsCli(config.region);
    const directory = required("--directory");
    await mkdir(directory, { mode: 0o700 });
    const record = async (receipt: unknown) => {
      await appendFile(join(directory, "receipt.jsonl"), JSON.stringify(receipt) + "\n", {
        mode: 0o600,
      });
    };
    if (operation === "preflight") {
      await record(await bucketPreflight(config, aws));
      console.log("BUCKET-METADATA-VERIFIED; recovery not proved");
    } else {
      await uploadEncrypted(required("--input"), config, aws, record);
      console.log("LOCKED-CIPHERTEXT-VERIFIED; isolated restore and RPO/RTO not proved");
    }
  } else
    throw new Error(
      "usage: seal|seal-inventory|open|open-inventory|preflight|upload with explicit file arguments",
    );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await main();
  } catch {
    console.error(
      "independent backup precondition/verification failed; preserve receipts and reconcile before retry; no raw secret/error exposed",
    );
    process.exitCode = 2;
  }
}
