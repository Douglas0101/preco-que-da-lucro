import assert from "node:assert/strict";
import { evaluateToolPolicy, policyRules } from "../../.opencode/plugins/observability/policy.ts";

interface Case {
  name: string;
  tool: string;
  input: unknown;
  allowed: boolean;
  rule?: string;
}

const cases: Case[] = [
  {
    name: "read .env real é bloqueado",
    tool: "read",
    input: { filePath: "/home/douglas/WebstormProjects/preco-que-da-lucro/.env" },
    allowed: false,
    rule: "sensitive_env_file",
  },
  {
    name: "read .env.local é bloqueado",
    tool: "read",
    input: { filePath: ".env.local" },
    allowed: false,
    rule: "sensitive_env_file",
  },
  {
    name: "read .env.example é permitido",
    tool: "read",
    input: { filePath: ".env.example" },
    allowed: true,
  },
  {
    name: "grep explícito por .env é bloqueado",
    tool: "grep",
    input: { pattern: "API_KEY", path: ".env" },
    allowed: false,
    rule: "sensitive_env_file",
  },
  {
    name: "shell cat .env é bloqueado",
    tool: "shell",
    input: { command: "cat .env" },
    allowed: false,
    rule: "sensitive_env_shell",
  },
  {
    name: "shell --env-file=.env é bloqueado",
    tool: "shell",
    input: { command: "node --env-file=.env script.js" },
    allowed: false,
    rule: "sensitive_env_shell",
  },
  {
    name: "shell referência a .env.example é permitida",
    tool: "shell",
    input: { command: "cat .env.example" },
    allowed: true,
  },
  {
    name: "glob **/.env* é bloqueado",
    tool: "glob",
    input: { pattern: "**/.env*" },
    allowed: false,
    rule: "sensitive_env_discovery",
  },
  {
    name: "rm -rf / é bloqueado (matcher, nunca executado)",
    tool: "shell",
    input: { command: "rm -rf /" },
    allowed: false,
    rule: "recursive_root_delete",
  },
  {
    name: "rm -rf ~ é bloqueado",
    tool: "shell",
    input: { command: "rm -rf ~" },
    allowed: false,
    rule: "recursive_root_delete",
  },
  {
    name: "rm -rf /tmp/canary é permitido",
    tool: "shell",
    input: { command: "rm -rf /tmp/opencode/observability-policy-canary" },
    allowed: true,
  },
  {
    name: "mkfs é bloqueado",
    tool: "shell",
    input: { command: "mkfs.ext4 /dev/sda1" },
    allowed: false,
    rule: "disk_format",
  },
  {
    name: "dd em /dev é bloqueado",
    tool: "shell",
    input: { command: "dd if=/dev/zero of=/dev/sda bs=1M" },
    allowed: false,
    rule: "raw_device_write",
  },
  {
    name: "fork bomb é bloqueada",
    tool: "shell",
    input: { command: ":(){ :|:& };:" },
    allowed: false,
    rule: "fork_bomb",
  },
  {
    name: "git push --force é bloqueado",
    tool: "shell",
    input: { command: "git push --force origin develop" },
    allowed: false,
    rule: "force_push",
  },
  {
    name: "git reset --hard é bloqueado",
    tool: "shell",
    input: { command: "git reset --hard HEAD~1" },
    allowed: false,
    rule: "hard_reset",
  },
  {
    name: "echo seguro é permitido",
    tool: "shell",
    input: { command: "echo hello" },
    allowed: true,
  },
];

const failures: Array<Case & { actual: ReturnType<typeof evaluateToolPolicy> }> = [];
for (const entry of cases) {
  const actual = evaluateToolPolicy(entry.tool, entry.input);
  const ok =
    actual.allowed === entry.allowed && (entry.rule === undefined || actual.rule === entry.rule);
  if (!ok) failures.push({ ...entry, actual });
  assert.equal(actual.allowed, entry.allowed, entry.name);
  if (entry.rule) assert.equal(actual.allowed ? undefined : actual.rule, entry.rule, entry.name);
}

console.log(
  JSON.stringify(
    {
      checked: cases.length,
      failed: failures.length,
      rules: policyRules,
      cases,
    },
    null,
    2,
  ),
);
