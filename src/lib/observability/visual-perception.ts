/**
 * V1 — captura visual em tempo de teste: transformação do dado bruto do
 * Playwright em artefato redigido, identificado por hash e persistido.
 *
 * Este módulo NÃO lança browser (declaração de arquitetura do ADR-033: o
 * Playwright é devDependency e o runtime de produção — Nitro node-server/Vercel
 * — não tem browser). Quem captura é o adaptador `e2e/visual/`; aqui ficam a
 * política de redação obrigatória, o cálculo de hash, a segunda varredura de
 * resíduo e a escrita em `docs/evidence/visual/`.
 *
 * Fail-closed: `buildRedactedCapture` e `persistVisualCapture` reverificam os
 * payloads. Um chamador que construa a captura à mão ainda é barrado pelo
 * `assertNoSecretLeaks` no limite da persistência.
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  VisualRedactionError,
  assertNoSecretLeaks,
  redactA11ySnapshot,
  redactDomSnapshot,
  redactPng,
  type DomNodeSnapshot,
  type RedactionResult,
} from "./visual-redaction";

export const DEFAULT_VISUAL_EVIDENCE_DIR = "docs/evidence/visual";

export interface RawVisualCapture {
  /** Rótulo legível do cenário (ex.: "produtos-incompleto"). */
  label: string;
  screenshotPng: Buffer;
  a11ySnapshot: string;
  domSnapshot: DomNodeSnapshot;
  correlationId?: string | null;
}

export interface RedactedVisualCapture {
  label: string;
  /** sha256 do PNG bruto — o que foi capturado. */
  beforeHash: string;
  /** sha256 do PNG redigido — o que foi persistido. */
  hash: string;
  screenshotPng: Buffer;
  a11ySnapshot: string;
  domSnapshot: DomNodeSnapshot;
  redactionsApplied: number;
  durationMs: number;
  correlationId: string | null;
}

export interface VisualArtifactPaths {
  png: string;
  a11y: string;
  dom: string;
}

export interface PersistedVisualCapture extends VisualArtifactPaths {
  label: string;
  timestamp: string;
  hash: string;
  correlationId: string | null;
}

export function sha256Hex(data: Buffer | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Carimbo seguro para nome de arquivo (ISO sem `:`/`.`). */
export function isoStamp(date: Date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

export function visualArtifactPaths(
  dir: string,
  timestamp: string,
  hash: string,
): VisualArtifactPaths {
  return {
    png: join(dir, `${timestamp}-${hash}.png`),
    a11y: join(dir, `${timestamp}-${hash}.a11y.json`),
    dom: join(dir, `${timestamp}-${hash}.dom.json`),
  };
}

/**
 * Redige as três superfícies, mede o tempo e devolve a captura pronta para
 * persistir. `now` é injetável para o teste provar a medição sem dormir.
 */
export function buildRedactedCapture(
  raw: RawVisualCapture,
  now: () => number = Date.now,
): RedactedVisualCapture {
  const started = now();
  const beforeHash = sha256Hex(raw.screenshotPng);
  const a11y: RedactionResult<string> = redactA11ySnapshot(raw.a11ySnapshot);
  const dom: RedactionResult<DomNodeSnapshot> = redactDomSnapshot(raw.domSnapshot);
  const png: RedactionResult<Buffer> = redactPng(raw.screenshotPng);
  assertNoSecretLeaks(`${a11y.value}\n${JSON.stringify(dom.value)}`);
  return {
    label: raw.label,
    beforeHash,
    hash: sha256Hex(png.value),
    screenshotPng: png.value,
    a11ySnapshot: a11y.value,
    domSnapshot: dom.value,
    redactionsApplied: a11y.applied + dom.applied + png.applied,
    durationMs: now() - started,
    correlationId: raw.correlationId ?? null,
  };
}

/**
 * Escreve o trio `.png`/`.a11y.json`/`.dom.json` no diretório de evidência.
 * A varredura de resíduo roda DE NOVO aqui: é o limite da persistência, e o
 * chamador pode ter construído a captura sem passar por `buildRedactedCapture`.
 */
export async function persistVisualCapture(
  capture: RedactedVisualCapture,
  options: { dir?: string; timestamp?: string } = {},
): Promise<PersistedVisualCapture> {
  const dir = options.dir ?? DEFAULT_VISUAL_EVIDENCE_DIR;
  const timestamp = options.timestamp ?? isoStamp();
  const a11yPayload = JSON.stringify(
    {
      label: capture.label,
      hash: capture.hash,
      beforeHash: capture.beforeHash,
      correlationId: capture.correlationId,
      redactionsApplied: capture.redactionsApplied,
      durationMs: capture.durationMs,
      snapshot: capture.a11ySnapshot,
    },
    null,
    2,
  );
  const domPayload = JSON.stringify(
    {
      label: capture.label,
      hash: capture.hash,
      beforeHash: capture.beforeHash,
      correlationId: capture.correlationId,
      redactionsApplied: capture.redactionsApplied,
      dom: capture.domSnapshot,
    },
    null,
    2,
  );
  assertNoSecretLeaks(`${a11yPayload}\n${domPayload}`);
  if (capture.screenshotPng.length === 0) {
    throw new VisualRedactionError("captura visual sem pixels: PNG vazio");
  }
  const paths = visualArtifactPaths(dir, timestamp, capture.hash);
  await mkdir(dir, { recursive: true });
  await Promise.all([
    writeFile(paths.png, capture.screenshotPng),
    writeFile(paths.a11y, a11yPayload, "utf8"),
    writeFile(paths.dom, domPayload, "utf8"),
  ]);
  return {
    ...paths,
    label: capture.label,
    timestamp,
    hash: capture.hash,
    correlationId: capture.correlationId,
  };
}
