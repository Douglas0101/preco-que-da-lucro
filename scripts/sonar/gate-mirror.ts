import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { runMirrorCli } from "./mirror-runner.ts";
export * from "./unit-mirror.ts";

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  runMirrorCli();
