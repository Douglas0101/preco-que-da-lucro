import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

interface Response {
  status: number;
  allowOrigin?: string;
  body: string;
}

// The native loader needs Node's typed-array realm, not jsdom's DOM realm.
// Resolve esbuild inside that process through the affected consumer.
const probe = String.raw`
const { createRequire } = require('node:module');
const { request } = require('node:http');
const { runInNewContext } = require('node:vm');
const fromRoot = createRequire(process.cwd() + '/package.json');
const fromConsumer = createRequire(fromRoot.resolve('@esbuild-kit/core-utils'));
const esbuild = fromConsumer('esbuild');
const core = fromRoot('@esbuild-kit/core-utils');
function response(port, origin, host = '127.0.0.1:' + port) {
  return new Promise((resolve, reject) => {
    const req = request({host: '127.0.0.1', port, path: '/boundary.js',
      headers: {Origin: origin, Host: host}}, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({status: res.statusCode,
        allowOrigin: res.headers['access-control-allow-origin'], body}));
    });
    req.on('error', reject);
    req.setTimeout(2000, () => req.destroy(new Error('loopback probe timed out')));
    req.end();
  });
}
(async () => {
  const context = await esbuild.context({stdin: {
    contents: 'console.log("C26_PUBLIC_SENTINEL")', loader: 'js'},
    outfile: 'boundary.js', write: false});
  try {
    const {port} = await context.serve({host: '127.0.0.1', port: 0});
    const foreign = await response(port, 'https://attacker.invalid');
    const opaque = await response(port, 'null');
    const foreignHost = await response(port, 'https://attacker.invalid', 'attacker.invalid');
    const legitimate = await response(port, 'http://127.0.0.1:' + port);
    const transformed = core.transformSync(
      'const value: number = 42; export default value', 'fixture.cts');
    const module = {exports: {}};
    runInNewContext(transformed.code, {module, exports: module.exports});
    let rejectsMalformed = false;
    try {core.transformSync('const value: number = ;', 'fixture.cts');}
    catch {rejectsMalformed = true;}
    const map = typeof transformed.map === 'string'
      ? JSON.parse(transformed.map) : transformed.map;
    process.stdout.write(JSON.stringify({foreign, opaque, foreignHost, legitimate,
      transformed: {value: module.exports.default, sources: map.sources},
      rejectsMalformed}));
  } finally {await context.dispose();}
})().catch(error => {console.error(error); process.exitCode = 1;});
`;

describe("esbuild through the migration loader (GHSA-67mh-4wv8-2f99)", () => {
  let result: {
    foreign: Response;
    opaque: Response;
    foreignHost: Response;
    legitimate: Response;
    transformed: { value: number; sources: string[] };
    rejectsMalformed: boolean;
  };
  beforeAll(() => {
    result = JSON.parse(
      execFileSync(process.execPath, ["--input-type=commonjs", "-e", probe], {
        cwd: process.cwd(),
        encoding: "utf8",
        timeout: 15_000,
      }),
    );
  });

  it.each(["foreign", "opaque"] as const)(
    "does not permit cross-origin JavaScript reads for %s Origin",
    (key) => {
      expect(result[key].status).toBe(200);
      expect(result[key].body).toContain("C26_PUBLIC_SENTINEL");
      // Raw HTTP200 alone is not the browser's permission to read a response.
      expect(result[key].allowOrigin).toBeUndefined();
    },
  );

  it("rejects a foreign Host without serving the sentinel", () => {
    expect(result.foreignHost.status).toBe(403);
    expect(result.foreignHost.body).not.toContain("C26_PUBLIC_SENTINEL");
    expect(result.foreignHost.allowOrigin).toBeUndefined();
  });

  it("preserves legitimate loopback access", () => {
    expect(result.legitimate.status).toBe(200);
    expect(result.legitimate.body).toContain("C26_PUBLIC_SENTINEL");
  });

  it("preserves the loader's TypeScript transform and source maps", () => {
    expect(result.transformed.value).toBe(42);
    expect(result.transformed.sources).toContain("fixture.cts");
  });

  it("continues rejecting malformed TypeScript", () => {
    expect(result.rejectsMalformed).toBe(true);
  });
});
