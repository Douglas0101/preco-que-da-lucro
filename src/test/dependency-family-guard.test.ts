import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { auditDependencyFamilies } from "../../scripts/lib/dependency-family-guard";
import { runCli } from "../../scripts/lib/upgrade-guard";

const root = resolve(import.meta.dirname, "../..");
const real = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const specs = { ...pkg.dependencies, ...pkg.devDependencies };
// API contents at exact PR heads; projections retain versions and exact dependency contracts.
// gitBlobSha and lockSha256 identify the complete lockfiles measured in this session.
const observed = {
  "53": {
    pr: "53",
    head: "b2ae9d5dcdb4872b5be61a3c4f5f195ac9f69bd9",
    gitBlobSha: "13e083aa3799cb2010270c78faddaec688f6a427",
    lockSha256: "e017f9cad8b691c680c4136bf34e86748dfdb7132f1013f2581ae6566544a858",
    packages: {
      "node_modules/@base-ui/react": {
        version: "1.7.0",
        dependencies: {
          "@babel/runtime": "^7.29.2",
          "@base-ui/utils": "0.3.2",
          "@floating-ui/react-dom": "^2.1.9",
          "@floating-ui/utils": "^0.2.12",
          "use-sync-external-store": "^1.6.0",
        },
        peerDependencies: {
          "@date-fns/tz": "^1.2.0",
          "@types/react": "^17 || ^18 || ^19",
          "date-fns": "^4.0.0",
          react: "^17 || ^18 || ^19",
          "react-dom": "^17 || ^18 || ^19",
        },
      },
      "node_modules/@floating-ui/react-dom": {
        version: "2.1.9",
        dependencies: {
          "@floating-ui/dom": "^1.8.0",
        },
        peerDependencies: {
          react: ">=16.8.0",
          "react-dom": ">=16.8.0",
        },
      },
      "node_modules/@tanstack/devtools-bundler-core": {
        version: "0.1.3",
        dependencies: {
          "@tanstack/devtools-client": "0.0.8",
          "@tanstack/devtools-event-bus": "0.4.3",
          chalk: "^5.6.2",
          "launch-editor": "^2.14.1",
          "magic-string": "^0.30.0",
          "oxc-parser": "^0.120.0",
          picomatch: "^4.0.5",
        },
      },
      "node_modules/@tanstack/devtools-client": {
        version: "0.0.8",
        dependencies: {
          "@tanstack/devtools-event-client": "^0.5.0",
        },
      },
      "node_modules/@tanstack/devtools-event-bus": {
        version: "0.4.3",
        dependencies: {
          ws: "^8.18.3",
        },
      },
      "node_modules/@tanstack/devtools-event-client": {
        version: "0.5.0",
      },
      "node_modules/@tanstack/devtools-vite": {
        version: "0.8.5",
        dependencies: {
          "@tanstack/devtools-bundler-core": "0.1.3",
          "@tanstack/devtools-client": "0.0.8",
          "@tanstack/devtools-event-bus": "0.4.3",
          chalk: "^5.6.2",
        },
        peerDependencies: {
          vite: "^6.0.0 || ^7.0.0 || ^8.0.0",
        },
      },
      "node_modules/@tanstack/history": {
        version: "1.162.1",
      },
      "node_modules/@tanstack/query-core": {
        version: "5.102.8",
      },
      "node_modules/@tanstack/react-query": {
        version: "5.102.8",
        dependencies: {
          "@tanstack/query-core": "5.102.8",
        },
        peerDependencies: {
          react: "^18 || ^19",
        },
      },
      "node_modules/@tanstack/react-router": {
        version: "1.170.40",
        dependencies: {
          "@tanstack/history": "1.162.4",
          "@tanstack/react-store": "^0.11.0",
          "@tanstack/router-core": "1.171.33",
          isbot: "^5.1.22",
        },
        peerDependencies: {
          react: ">=18.0.0 || >=19.0.0",
          "react-dom": ">=18.0.0 || >=19.0.0",
        },
      },
      "node_modules/@tanstack/react-router/node_modules/@tanstack/history": {
        version: "1.162.4",
      },
      "node_modules/@tanstack/react-router/node_modules/@tanstack/router-core": {
        version: "1.171.33",
        dependencies: {
          "@tanstack/history": "1.162.4",
          "cookie-es": "^3.0.0",
          seroval: "^1.6.7",
          "seroval-plugins": "^1.6.7",
        },
      },
      "node_modules/@tanstack/react-start": {
        version: "1.168.49",
        dependencies: {
          "@tanstack/react-router": "1.170.32",
          "@tanstack/react-start-client": "1.168.30",
          "@tanstack/react-start-rsc": "0.1.48",
          "@tanstack/react-start-server": "1.167.37",
          "@tanstack/router-utils": "1.162.2",
          "@tanstack/start-client-core": "1.170.27",
          "@tanstack/start-plugin-core": "1.171.39",
          "@tanstack/start-server-core": "1.169.31",
          pathe: "^2.0.3",
        },
        peerDependencies: {
          "@rsbuild/core": "^2.0.0",
          react: ">=18.0.0 || >=19.0.0",
          "react-dom": ">=18.0.0 || >=19.0.0",
          vite: ">=7.0.0",
        },
      },
      "node_modules/@tanstack/react-start-client": {
        version: "1.168.30",
        dependencies: {
          "@tanstack/react-router": "1.170.32",
          "@tanstack/router-core": "1.171.27",
          "@tanstack/start-client-core": "1.170.27",
        },
        peerDependencies: {
          react: ">=18.0.0 || >=19.0.0",
          "react-dom": ">=18.0.0 || >=19.0.0",
        },
      },
      "node_modules/@tanstack/react-start-client/node_modules/@tanstack/react-router": {
        version: "1.170.32",
        dependencies: {
          "@tanstack/history": "1.162.1",
          "@tanstack/react-store": "^0.9.3",
          "@tanstack/router-core": "1.171.27",
          isbot: "^5.1.22",
        },
        peerDependencies: {
          react: ">=18.0.0 || >=19.0.0",
          "react-dom": ">=18.0.0 || >=19.0.0",
        },
      },
      "node_modules/@tanstack/react-start-client/node_modules/@tanstack/react-store": {
        version: "0.9.3",
        dependencies: {
          "@tanstack/store": "0.9.3",
          "use-sync-external-store": "^1.6.0",
        },
        peerDependencies: {
          react: "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
          "react-dom": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
        },
      },
      "node_modules/@tanstack/react-start-client/node_modules/@tanstack/store": {
        version: "0.9.3",
      },
      "node_modules/@tanstack/react-start-rsc": {
        version: "0.1.48",
        dependencies: {
          "@tanstack/react-router": "1.170.32",
          "@tanstack/router-core": "1.171.27",
          "@tanstack/router-utils": "1.162.2",
          "@tanstack/start-client-core": "1.170.27",
          "@tanstack/start-fn-stubs": "1.162.0",
          "@tanstack/start-plugin-core": "1.171.39",
          "@tanstack/start-storage-context": "1.167.29",
          pathe: "^2.0.3",
        },
        peerDependencies: {
          "@rspack/core": ">=2.0.0-0",
          "@vitejs/plugin-rsc": ">=0.5.30",
          react: ">=18.0.0 || >=19.0.0",
          "react-dom": ">=18.0.0 || >=19.0.0",
          "react-server-dom-rspack": ">=0.0.2",
        },
      },
      "node_modules/@tanstack/react-start-rsc/node_modules/@tanstack/react-router": {
        version: "1.170.32",
        dependencies: {
          "@tanstack/history": "1.162.1",
          "@tanstack/react-store": "^0.9.3",
          "@tanstack/router-core": "1.171.27",
          isbot: "^5.1.22",
        },
        peerDependencies: {
          react: ">=18.0.0 || >=19.0.0",
          "react-dom": ">=18.0.0 || >=19.0.0",
        },
      },
      "node_modules/@tanstack/react-start-rsc/node_modules/@tanstack/react-store": {
        version: "0.9.3",
        dependencies: {
          "@tanstack/store": "0.9.3",
          "use-sync-external-store": "^1.6.0",
        },
        peerDependencies: {
          react: "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
          "react-dom": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
        },
      },
      "node_modules/@tanstack/react-start-rsc/node_modules/@tanstack/store": {
        version: "0.9.3",
      },
      "node_modules/@tanstack/react-start-server": {
        version: "1.167.37",
        dependencies: {
          "@tanstack/react-router": "1.170.32",
          "@tanstack/router-core": "1.171.27",
          "@tanstack/start-server-core": "1.169.31",
        },
        peerDependencies: {
          react: ">=18.0.0 || >=19.0.0",
          "react-dom": ">=18.0.0 || >=19.0.0",
        },
      },
      "node_modules/@tanstack/react-start-server/node_modules/@tanstack/react-router": {
        version: "1.170.32",
        dependencies: {
          "@tanstack/history": "1.162.1",
          "@tanstack/react-store": "^0.9.3",
          "@tanstack/router-core": "1.171.27",
          isbot: "^5.1.22",
        },
        peerDependencies: {
          react: ">=18.0.0 || >=19.0.0",
          "react-dom": ">=18.0.0 || >=19.0.0",
        },
      },
      "node_modules/@tanstack/react-start-server/node_modules/@tanstack/react-store": {
        version: "0.9.3",
        dependencies: {
          "@tanstack/store": "0.9.3",
          "use-sync-external-store": "^1.6.0",
        },
        peerDependencies: {
          react: "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
          "react-dom": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
        },
      },
      "node_modules/@tanstack/react-start-server/node_modules/@tanstack/store": {
        version: "0.9.3",
      },
      "node_modules/@tanstack/react-start/node_modules/@tanstack/react-router": {
        version: "1.170.32",
        dependencies: {
          "@tanstack/history": "1.162.1",
          "@tanstack/react-store": "^0.9.3",
          "@tanstack/router-core": "1.171.27",
          isbot: "^5.1.22",
        },
        peerDependencies: {
          react: ">=18.0.0 || >=19.0.0",
          "react-dom": ">=18.0.0 || >=19.0.0",
        },
      },
      "node_modules/@tanstack/react-start/node_modules/@tanstack/react-store": {
        version: "0.9.3",
        dependencies: {
          "@tanstack/store": "0.9.3",
          "use-sync-external-store": "^1.6.0",
        },
        peerDependencies: {
          react: "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
          "react-dom": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
        },
      },
      "node_modules/@tanstack/react-start/node_modules/@tanstack/store": {
        version: "0.9.3",
      },
      "node_modules/@tanstack/react-store": {
        version: "0.11.1",
        dependencies: {
          "@tanstack/store": "0.11.1",
          "use-sync-external-store": "^1.6.0",
        },
        peerDependencies: {
          react: "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
          "react-dom": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
        },
      },
      "node_modules/@tanstack/router-core": {
        version: "1.171.27",
        dependencies: {
          "@tanstack/history": "1.162.1",
          "cookie-es": "^3.0.0",
          seroval: "^1.6.2",
          "seroval-plugins": "^1.6.2",
        },
      },
      "node_modules/@tanstack/router-generator": {
        version: "1.167.33",
        dependencies: {
          "@babel/types": "^7.28.5",
          "@tanstack/router-core": "1.171.27",
          "@tanstack/router-utils": "1.162.2",
          "@tanstack/virtual-file-routes": "1.162.0",
          jiti: "^2.7.0",
          "magic-string": "^0.30.21",
          prettier: "^3.5.0",
          zod: "^4.4.3",
        },
      },
      "node_modules/@tanstack/router-plugin": {
        version: "1.168.35",
        dependencies: {
          "@babel/core": "^7.28.5",
          "@babel/template": "^7.27.2",
          "@babel/types": "^7.28.5",
          "@tanstack/router-core": "1.171.27",
          "@tanstack/router-generator": "1.167.33",
          "@tanstack/router-utils": "1.162.2",
          chokidar: "^5.0.0",
          unplugin: "^3.0.0",
          zod: "^4.4.3",
        },
        peerDependencies: {
          "@rsbuild/core": ">=1.0.2 || ^2.0.0",
          "@tanstack/react-router": "^1.170.32",
          vite: ">=5.0.0 || >=6.0.0 || >=7.0.0 || >=8.0.0",
          "vite-plugin-solid": "^2.11.10 || ^3.0.0-0",
          webpack: ">=5.92.0",
        },
      },
      "node_modules/@tanstack/router-utils": {
        version: "1.162.2",
        dependencies: {
          "@babel/generator": "^7.28.5",
          "@babel/parser": "^7.28.5",
          "@babel/types": "^7.28.5",
          ansis: "^4.1.0",
          "babel-dead-code-elimination": "^1.0.12",
          diff: "^8.0.2",
          pathe: "^2.0.3",
          tinyglobby: "^0.2.15",
        },
      },
      "node_modules/@tanstack/start-client-core": {
        version: "1.170.27",
        dependencies: {
          "@tanstack/router-core": "1.171.27",
          "@tanstack/start-fn-stubs": "1.162.0",
          "@tanstack/start-storage-context": "1.167.29",
          seroval: "^1.6.2",
        },
      },
      "node_modules/@tanstack/start-fn-stubs": {
        version: "1.162.0",
      },
      "node_modules/@tanstack/start-plugin-core": {
        version: "1.171.39",
        dependencies: {
          "@babel/code-frame": "7.27.1",
          "@babel/core": "^7.28.5",
          "@babel/types": "^7.28.5",
          "@tanstack/router-core": "1.171.27",
          "@tanstack/router-generator": "1.167.33",
          "@tanstack/router-plugin": "1.168.35",
          "@tanstack/router-utils": "1.162.2",
          "@tanstack/start-server-core": "1.169.31",
          exsolve: "^1.0.7",
          lightningcss: "^1.32.0",
          pathe: "^2.0.3",
          picomatch: "^4.0.3",
          seroval: "^1.6.2",
          "source-map": "^0.7.6",
          srvx: "^0.11.9",
          tinyglobby: "^0.2.15",
          ufo: "^1.5.4",
          vitefu: "^1.1.1",
          xmlbuilder2: "^4.0.3",
          zod: "^4.4.3",
        },
        peerDependencies: {
          "@rsbuild/core": "^2.0.0",
          vite: ">=7.0.0",
        },
      },
      "node_modules/@tanstack/start-plugin-core/node_modules/@babel/code-frame": {
        version: "7.27.1",
        dependencies: {
          "@babel/helper-validator-identifier": "^7.27.1",
          "js-tokens": "^4.0.0",
          picocolors: "^1.1.1",
        },
      },
      "node_modules/@tanstack/start-server-core": {
        version: "1.169.31",
        dependencies: {
          "@tanstack/history": "1.162.1",
          "@tanstack/router-core": "1.171.27",
          "@tanstack/start-client-core": "1.170.27",
          "@tanstack/start-storage-context": "1.167.29",
          fetchdts: "^0.1.6",
          "h3-v2": "npm:h3@2.0.1-rc.20",
          seroval: "^1.6.2",
        },
      },
      "node_modules/@tanstack/start-storage-context": {
        version: "1.167.29",
        dependencies: {
          "@tanstack/router-core": "1.171.27",
        },
      },
      "node_modules/@tanstack/store": {
        version: "0.11.1",
      },
      "node_modules/@tanstack/virtual-file-routes": {
        version: "1.162.0",
      },
      "node_modules/@testing-library/react": {
        version: "16.3.3",
        dependencies: {
          "@babel/runtime": "^7.12.5",
        },
        peerDependencies: {
          "@testing-library/dom": "^10.0.0",
          "@types/react": "^18.0.0 || ^19.0.0",
          "@types/react-dom": "^18.0.0 || ^19.0.0",
          react: "^18.0.0 || ^19.0.0",
          "react-dom": "^18.0.0 || ^19.0.0",
        },
      },
      "node_modules/@types/react": {
        version: "19.2.18",
        dependencies: {
          csstype: "^3.2.2",
        },
      },
      "node_modules/@types/react-dom": {
        version: "19.2.5",
        peerDependencies: {
          "@types/react": "^19.2.0",
        },
      },
      "node_modules/react": {
        version: "19.2.8",
      },
      "node_modules/react-dom": {
        version: "19.2.8",
        dependencies: {
          scheduler: "^0.27.0",
        },
        peerDependencies: {
          react: "^19.2.8",
        },
      },
    },
  },
  "56": {
    pr: "56",
    head: "7c24df54f32cf2d9436473c6592554878fddcabb",
    gitBlobSha: "dfb684690b7edb3c41397636e66633f703b03305",
    lockSha256: "c7a183848cafcdb8c7c92fa461eced40e9c8eba06fe1f47b601b1aaf04c6b121",
    packages: {
      "node_modules/@base-ui/react": {
        version: "1.7.0",
        dependencies: {
          "@babel/runtime": "^7.29.2",
          "@base-ui/utils": "0.3.2",
          "@floating-ui/react-dom": "^2.1.9",
          "@floating-ui/utils": "^0.2.12",
          "use-sync-external-store": "^1.6.0",
        },
        peerDependencies: {
          "@date-fns/tz": "^1.2.0",
          "@types/react": "^17 || ^18 || ^19",
          "date-fns": "^4.0.0",
          react: "^17 || ^18 || ^19",
          "react-dom": "^17 || ^18 || ^19",
        },
      },
      "node_modules/@floating-ui/react-dom": {
        version: "2.1.9",
        dependencies: {
          "@floating-ui/dom": "^1.8.0",
        },
        peerDependencies: {
          react: ">=16.8.0",
          "react-dom": ">=16.8.0",
        },
      },
      "node_modules/@tanstack/devtools-bundler-core": {
        version: "0.1.3",
        dependencies: {
          "@tanstack/devtools-client": "0.0.8",
          "@tanstack/devtools-event-bus": "0.4.3",
          chalk: "^5.6.2",
          "launch-editor": "^2.14.1",
          "magic-string": "^0.30.0",
          "oxc-parser": "^0.120.0",
          picomatch: "^4.0.5",
        },
      },
      "node_modules/@tanstack/devtools-client": {
        version: "0.0.8",
        dependencies: {
          "@tanstack/devtools-event-client": "^0.5.0",
        },
      },
      "node_modules/@tanstack/devtools-event-bus": {
        version: "0.4.3",
        dependencies: {
          ws: "^8.18.3",
        },
      },
      "node_modules/@tanstack/devtools-event-client": {
        version: "0.5.0",
      },
      "node_modules/@tanstack/devtools-vite": {
        version: "0.8.5",
        dependencies: {
          "@tanstack/devtools-bundler-core": "0.1.3",
          "@tanstack/devtools-client": "0.0.8",
          "@tanstack/devtools-event-bus": "0.4.3",
          chalk: "^5.6.2",
        },
        peerDependencies: {
          vite: "^6.0.0 || ^7.0.0 || ^8.0.0",
        },
      },
      "node_modules/@tanstack/history": {
        version: "1.162.1",
      },
      "node_modules/@tanstack/query-core": {
        version: "5.102.8",
      },
      "node_modules/@tanstack/react-query": {
        version: "5.102.8",
        dependencies: {
          "@tanstack/query-core": "5.102.8",
        },
        peerDependencies: {
          react: "^18 || ^19",
        },
      },
      "node_modules/@tanstack/react-router": {
        version: "1.170.32",
        dependencies: {
          "@tanstack/history": "1.162.1",
          "@tanstack/react-store": "^0.9.3",
          "@tanstack/router-core": "1.171.27",
          isbot: "^5.1.22",
        },
        peerDependencies: {
          react: ">=18.0.0 || >=19.0.0",
          "react-dom": ">=18.0.0 || >=19.0.0",
        },
      },
      "node_modules/@tanstack/react-start": {
        version: "1.168.49",
        dependencies: {
          "@tanstack/react-router": "1.170.32",
          "@tanstack/react-start-client": "1.168.30",
          "@tanstack/react-start-rsc": "0.1.48",
          "@tanstack/react-start-server": "1.167.37",
          "@tanstack/router-utils": "1.162.2",
          "@tanstack/start-client-core": "1.170.27",
          "@tanstack/start-plugin-core": "1.171.39",
          "@tanstack/start-server-core": "1.169.31",
          pathe: "^2.0.3",
        },
        peerDependencies: {
          "@rsbuild/core": "^2.0.0",
          react: ">=18.0.0 || >=19.0.0",
          "react-dom": ">=18.0.0 || >=19.0.0",
          vite: ">=7.0.0",
        },
      },
      "node_modules/@tanstack/react-start-client": {
        version: "1.168.30",
        dependencies: {
          "@tanstack/react-router": "1.170.32",
          "@tanstack/router-core": "1.171.27",
          "@tanstack/start-client-core": "1.170.27",
        },
        peerDependencies: {
          react: ">=18.0.0 || >=19.0.0",
          "react-dom": ">=18.0.0 || >=19.0.0",
        },
      },
      "node_modules/@tanstack/react-start-rsc": {
        version: "0.1.48",
        dependencies: {
          "@tanstack/react-router": "1.170.32",
          "@tanstack/router-core": "1.171.27",
          "@tanstack/router-utils": "1.162.2",
          "@tanstack/start-client-core": "1.170.27",
          "@tanstack/start-fn-stubs": "1.162.0",
          "@tanstack/start-plugin-core": "1.171.39",
          "@tanstack/start-storage-context": "1.167.29",
          pathe: "^2.0.3",
        },
        peerDependencies: {
          "@rspack/core": ">=2.0.0-0",
          "@vitejs/plugin-rsc": ">=0.5.30",
          react: ">=18.0.0 || >=19.0.0",
          "react-dom": ">=18.0.0 || >=19.0.0",
          "react-server-dom-rspack": ">=0.0.2",
        },
      },
      "node_modules/@tanstack/react-start-server": {
        version: "1.167.37",
        dependencies: {
          "@tanstack/react-router": "1.170.32",
          "@tanstack/router-core": "1.171.27",
          "@tanstack/start-server-core": "1.169.31",
        },
        peerDependencies: {
          react: ">=18.0.0 || >=19.0.0",
          "react-dom": ">=18.0.0 || >=19.0.0",
        },
      },
      "node_modules/@tanstack/react-store": {
        version: "0.9.3",
        dependencies: {
          "@tanstack/store": "0.9.3",
          "use-sync-external-store": "^1.6.0",
        },
        peerDependencies: {
          react: "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
          "react-dom": "^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0",
        },
      },
      "node_modules/@tanstack/router-core": {
        version: "1.171.27",
        dependencies: {
          "@tanstack/history": "1.162.1",
          "cookie-es": "^3.0.0",
          seroval: "^1.6.2",
          "seroval-plugins": "^1.6.2",
        },
      },
      "node_modules/@tanstack/router-generator": {
        version: "1.167.33",
        dependencies: {
          "@babel/types": "^7.28.5",
          "@tanstack/router-core": "1.171.27",
          "@tanstack/router-utils": "1.162.2",
          "@tanstack/virtual-file-routes": "1.162.0",
          jiti: "^2.7.0",
          "magic-string": "^0.30.21",
          prettier: "^3.5.0",
          zod: "^4.4.3",
        },
      },
      "node_modules/@tanstack/router-plugin": {
        version: "1.168.35",
        dependencies: {
          "@babel/core": "^7.28.5",
          "@babel/template": "^7.27.2",
          "@babel/types": "^7.28.5",
          "@tanstack/router-core": "1.171.27",
          "@tanstack/router-generator": "1.167.33",
          "@tanstack/router-utils": "1.162.2",
          chokidar: "^5.0.0",
          unplugin: "^3.0.0",
          zod: "^4.4.3",
        },
        peerDependencies: {
          "@rsbuild/core": ">=1.0.2 || ^2.0.0",
          "@tanstack/react-router": "^1.170.32",
          vite: ">=5.0.0 || >=6.0.0 || >=7.0.0 || >=8.0.0",
          "vite-plugin-solid": "^2.11.10 || ^3.0.0-0",
          webpack: ">=5.92.0",
        },
      },
      "node_modules/@tanstack/router-utils": {
        version: "1.162.2",
        dependencies: {
          "@babel/generator": "^7.28.5",
          "@babel/parser": "^7.28.5",
          "@babel/types": "^7.28.5",
          ansis: "^4.1.0",
          "babel-dead-code-elimination": "^1.0.12",
          diff: "^8.0.2",
          pathe: "^2.0.3",
          tinyglobby: "^0.2.15",
        },
      },
      "node_modules/@tanstack/start-client-core": {
        version: "1.170.27",
        dependencies: {
          "@tanstack/router-core": "1.171.27",
          "@tanstack/start-fn-stubs": "1.162.0",
          "@tanstack/start-storage-context": "1.167.29",
          seroval: "^1.6.2",
        },
      },
      "node_modules/@tanstack/start-fn-stubs": {
        version: "1.162.0",
      },
      "node_modules/@tanstack/start-plugin-core": {
        version: "1.171.39",
        dependencies: {
          "@babel/code-frame": "7.27.1",
          "@babel/core": "^7.28.5",
          "@babel/types": "^7.28.5",
          "@tanstack/router-core": "1.171.27",
          "@tanstack/router-generator": "1.167.33",
          "@tanstack/router-plugin": "1.168.35",
          "@tanstack/router-utils": "1.162.2",
          "@tanstack/start-server-core": "1.169.31",
          exsolve: "^1.0.7",
          lightningcss: "^1.32.0",
          pathe: "^2.0.3",
          picomatch: "^4.0.3",
          seroval: "^1.6.2",
          "source-map": "^0.7.6",
          srvx: "^0.11.9",
          tinyglobby: "^0.2.15",
          ufo: "^1.5.4",
          vitefu: "^1.1.1",
          xmlbuilder2: "^4.0.3",
          zod: "^4.4.3",
        },
        peerDependencies: {
          "@rsbuild/core": "^2.0.0",
          vite: ">=7.0.0",
        },
      },
      "node_modules/@tanstack/start-plugin-core/node_modules/@babel/code-frame": {
        version: "7.27.1",
        dependencies: {
          "@babel/helper-validator-identifier": "^7.27.1",
          "js-tokens": "^4.0.0",
          picocolors: "^1.1.1",
        },
      },
      "node_modules/@tanstack/start-server-core": {
        version: "1.169.31",
        dependencies: {
          "@tanstack/history": "1.162.1",
          "@tanstack/router-core": "1.171.27",
          "@tanstack/start-client-core": "1.170.27",
          "@tanstack/start-storage-context": "1.167.29",
          fetchdts: "^0.1.6",
          "h3-v2": "npm:h3@2.0.1-rc.20",
          seroval: "^1.6.2",
        },
      },
      "node_modules/@tanstack/start-storage-context": {
        version: "1.167.29",
        dependencies: {
          "@tanstack/router-core": "1.171.27",
        },
      },
      "node_modules/@tanstack/store": {
        version: "0.9.3",
      },
      "node_modules/@tanstack/virtual-file-routes": {
        version: "1.162.0",
      },
      "node_modules/@testing-library/react": {
        version: "16.3.3",
        dependencies: {
          "@babel/runtime": "^7.12.5",
        },
        peerDependencies: {
          "@testing-library/dom": "^10.0.0",
          "@types/react": "^18.0.0 || ^19.0.0",
          "@types/react-dom": "^18.0.0 || ^19.0.0",
          react: "^18.0.0 || ^19.0.0",
          "react-dom": "^18.0.0 || ^19.0.0",
        },
      },
      "node_modules/@types/react": {
        version: "19.3.0",
        dependencies: {
          csstype: "^3.2.2",
        },
      },
      "node_modules/@types/react-dom": {
        version: "19.2.5",
        peerDependencies: {
          "@types/react": "^19.2.0",
        },
      },
      "node_modules/react": {
        version: "19.3.0",
      },
      "node_modules/react-dom": {
        version: "19.2.8",
        dependencies: {
          scheduler: "^0.27.0",
        },
        peerDependencies: {
          react: "^19.2.8",
        },
      },
    },
  },
};

describe("DBT-65 · resolved dependency families", () => {
  it("the published lock is compatible without equating independent TanStack package versions", () => {
    expect(auditDependencyFamilies(real, specs)).toEqual([]);
  });

  it("PR #56 actual lock rejects React/runtime pair before 116 suites fail setup", () => {
    const findings = auditDependencyFamilies({ packages: observed["56"].packages }, specs);
    expect(findings.join("\n")).toContain("react 19.3.0 != react-dom 19.2.8");
  });

  it("PR #53 actual lock rejects Start/Router contracts and nested conflicting copies", () => {
    const findings = auditDependencyFamilies({ packages: observed["53"].packages }, specs);
    expect(findings.join("\n")).toContain("react-router 1.170.32, raiz resolve 1.170.40");
    expect(
      findings.some((finding) => finding.includes("cópia") && finding.includes("react-router")),
    ).toBe(true);
  });

  it.each(["react-dom", "@types/react-dom", "@tanstack/router-core", "@tanstack/react-start"])(
    "missing %s is rejected by identity",
    (name) => {
      const mutant = structuredClone(real);
      delete mutant.packages[`node_modules/${name}`];
      expect(auditDependencyFamilies(mutant, specs).join("\n")).toContain(name);
    },
  );

  it("empty/unreadable lock is not a compatible family", () => {
    expect(auditDependencyFamilies({ packages: {} }, specs)).not.toEqual([]);
    expect(auditDependencyFamilies(null, specs)).not.toEqual([]);
  });

  it.each(["53", "56"] as const)(
    "CLI rejects observed PR #%s lock through the real gate",
    (number) => {
      const directory = mkdtempSync(resolve(tmpdir(), "family-cli-"));
      const spy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
      try {
        mkdirSync(resolve(directory, "scripts"));
        writeFileSync(
          resolve(directory, "scripts/dependency-policy.json"),
          readFileSync(resolve(root, "scripts/dependency-policy.json")),
        );
        writeFileSync(resolve(directory, "package.json"), JSON.stringify(pkg));
        writeFileSync(
          resolve(directory, "package-lock.json"),
          JSON.stringify({ ...real, packages: { ...real.packages, ...observed[number].packages } }),
        );
        expect(runCli(directory)).toBe(1);
        const report = JSON.parse(String(spy.mock.calls.at(-1)?.[0]));
        expect(
          report.checks.find((check: { id: string }) => check.id === "dependency-families").status,
        ).toBe("fail");
        expect(report.reasons.join("\n")).toContain(
          number === "56" ? "react 19.3.0 != react-dom 19.2.8" : "raiz resolve 1.170.40",
        );
      } finally {
        spy.mockRestore();
        rmSync(directory, { recursive: true, force: true });
      }
    },
  );
});
