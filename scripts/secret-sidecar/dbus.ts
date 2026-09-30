/**
 * D-Bus wire protocol — o mínimo necessário para falar com `org.freedesktop.secrets`.
 *
 * Por que isto existe neste repositório em vez de uma dependência: o MAESTRO decidiu
 * (2026-09-29) que o sidecar fala Secret Service por D-Bus com cliente Node próprio, sem
 * dependência nova, e sem depender de `libsecret-tools` — que **não existe** na máquina
 * de referência, embora o serviço esteja vivo. O custo aceito é implementar `OpenSession`,
 * `CreateItem` e `GetSecret` à mão.
 *
 * O que é testável sem barramento: **tudo nesta camada**. `marshalMessage` e
 * `parseMessage` são funções puras sobre bytes, e é nelas que o teste de marshal/unmarshal
 * prova a ida e a volta de cada assinatura que o Secret Service usa. O `DBusClient` é a
 * única parte que exige um barramento vivo, e por isso ele não é exercitado no CI.
 *
 * Limites declarados:
 * - Só o transporte `unix:path=…` do barramento de sessão. `tcp:` e barramento de sistema
 *   não são suportados — não são necessários para o Secret Service de sessão.
 * - A ordem de bytes do leitor é lida do primeiro byte da mensagem e ambos os sentidos
 *   funcionam, mas este cliente **escreve** sempre little-endian (a arquitetura de
 *   referência). Um barramento big-endian aceitaria nossas chamadas; o caminho inverso
 *   não foi exercitado.
 * - Sem `NEGOTIATE_UNIX_FD` e sem passar file descriptors: o Secret Service não precisa,
 *   e o suporte a `SCM_RIGHTS` em Node exige APIs que não são estáveis.
 */

import { createConnection, type Socket } from "node:net";
import { randomBytes } from "node:crypto";

/** Ordem de bytes little-endian ('l'). O protocolo também define 'B'; ver limite declarado. */
const ENDIAN_LITTLE = 0x6c;
const ENDIAN_BIG = 0x42;

export const MESSAGE_TYPE = {
  METHOD_CALL: 1,
  METHOD_RETURN: 2,
  ERROR: 3,
  SIGNAL: 4,
} as const;

export const HEADER_FIELD = {
  PATH: 1,
  INTERFACE: 2,
  MEMBER: 3,
  ERROR_NAME: 4,
  REPLY_SERIAL: 5,
  DESTINATION: 6,
  SENDER: 7,
  SIGNATURE: 8,
  UNIX_FDS: 9,
} as const;

export class DBusError extends Error {
  readonly dbusName: string;
  constructor(dbusName: string, message: string) {
    super(message);
    this.name = "DBusError";
    this.dbusName = dbusName;
  }
}

/** O alinhamento do primeiro tipo completo da assinatura. */
export function alignmentOf(signature: string): number {
  const head = signature[0];
  if (head === undefined) return 1;
  switch (head) {
    case "y":
    case "g":
    case "v":
      return 1;
    case "n":
    case "q":
      return 2;
    case "b":
    case "i":
    case "u":
    case "h":
    case "s":
    case "o":
    case "a":
      return 4;
    case "x":
    case "t":
    case "d":
    case "(":
    case "{":
      return 8;
    default:
      throw new Error(`tipo D-Bus desconhecido: ${head}`);
  }
}

/**
 * Separa o primeiro tipo completo da assinatura do resto.
 * `a{sv}s` → `["a{sv}", "s"]`; `(oayays)` → `["(oayays)", ""]`.
 */
export function splitType(signature: string): [string, string] {
  const head = signature[0];
  if (head === undefined) throw new Error("assinatura vazia");
  if (head === "a") {
    const [inner, rest] = splitType(signature.slice(1));
    return [`a${inner}`, rest];
  }
  if (head === "(" || head === "{") {
    const close = head === "(" ? ")" : "}";
    let depth = 0;
    for (let i = 0; i < signature.length; i += 1) {
      const ch = signature[i];
      if (ch === "(" || ch === "{") depth += 1;
      else if (ch === ")" || ch === "}") {
        depth -= 1;
        if (depth === 0) {
          if (ch !== close) throw new Error(`assinatura malformada: ${signature}`);
          return [signature.slice(0, i + 1), signature.slice(i + 1)];
        }
      }
    }
    throw new Error(`assinatura sem fechamento: ${signature}`);
  }
  return [head, signature.slice(1)];
}

/** Divide uma assinatura em todos os seus tipos completos. `a{sv}sb` → `["a{sv}","s","b"]`. */
export function splitAll(signature: string): string[] {
  const out: string[] = [];
  let rest = signature;
  while (rest.length > 0) {
    const [type, next] = splitType(rest);
    out.push(type);
    rest = next;
  }
  return out;
}

/**
 * Um valor D-Bus já desserializado. O protocolo é dinâmico por natureza — o tipo de cada
 * campo vem da **assinatura**, não do código — então o retorno não pode ser um tipo fixo.
 * `unknown` também não serve: um valor que atravessa a fronteira de desserialização tem de
 * ser nomeado, senão todo consumidor a jusante volta a estreitar por conta própria.
 */
export type DBusValue =
  number | bigint | boolean | string | Uint8Array | Variant | DBusValue[] | [DBusValue, DBusValue];
/** Um valor D-Bus com o tipo explícito, para que a assinatura sobreviva ao transporte. */
export interface Variant {
  readonly signature: string;
  readonly value: DBusValue;
}

export function variant(signature: string, value: DBusValue): Variant {
  return { signature, value };
}

class Writer {
  private buf: Buffer;
  private pos = 0;

  constructor(initial = 256) {
    this.buf = Buffer.alloc(initial);
  }

  private ensure(extra: number): void {
    if (this.pos + extra <= this.buf.length) return;
    let size = this.buf.length * 2;
    while (size < this.pos + extra) size *= 2;
    const next = Buffer.alloc(size);
    this.buf.copy(next, 0, 0, this.pos);
    this.buf = next;
  }

  get offset(): number {
    return this.pos;
  }

  align(boundary: number): void {
    const pad = (boundary - (this.pos % boundary)) % boundary;
    if (pad === 0) return;
    this.ensure(pad);
    this.buf.fill(0, this.pos, this.pos + pad);
    this.pos += pad;
  }

  u8(value: number): void {
    this.ensure(1);
    this.buf.writeUInt8(value & 0xff, this.pos);
    this.pos += 1;
  }

  u16(value: number): void {
    this.align(2);
    this.ensure(2);
    this.buf.writeUInt16LE(value & 0xffff, this.pos);
    this.pos += 2;
  }

  u32(value: number): void {
    this.align(4);
    this.ensure(4);
    this.buf.writeUInt32LE(value >>> 0, this.pos);
    this.pos += 4;
  }

  i32(value: number): void {
    this.align(4);
    this.ensure(4);
    this.buf.writeInt32LE(value | 0, this.pos);
    this.pos += 4;
  }

  u64(value: bigint | number): void {
    this.align(8);
    this.ensure(8);
    this.buf.writeBigUInt64LE(BigInt(value), this.pos);
    this.pos += 8;
  }

  raw(bytes: Uint8Array): void {
    this.ensure(bytes.length);
    Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).copy(this.buf, this.pos);
    this.pos += bytes.byteLength;
  }

  /** Escreve no offset já reservado (para comprimentos de array). */
  patchU32(at: number, value: number): void {
    this.buf.writeUInt32LE(value >>> 0, at);
  }

  reserveU32(): number {
    this.align(4);
    const at = this.pos;
    this.u32(0);
    return at;
  }

  string(value: string): void {
    const bytes = Buffer.from(value, "utf8");
    this.u32(bytes.length);
    this.raw(bytes);
    this.u8(0);
  }

  signature(value: string): void {
    const bytes = Buffer.from(value, "ascii");
    if (bytes.length > 255) throw new Error("assinatura D-Bus maior que 255 bytes");
    this.u8(bytes.length);
    this.raw(bytes);
    this.u8(0);
  }

  writeValue(signature: string, value: unknown): void {
    const [type] = splitType(signature);
    switch (type[0]) {
      case "y":
        this.u8(Number(value));
        return;
      case "b": {
        this.align(4);
        this.u32(value === true || value === 1 ? 1 : 0);
        return;
      }
      case "n":
        this.u16(Number(value) & 0xffff);
        return;
      case "q":
        this.u16(Number(value) & 0xffff);
        return;
      case "i":
        this.i32(Number(value));
        return;
      case "u":
      case "h":
        this.u32(Number(value));
        return;
      case "x":
      case "t":
        this.u64(value as bigint);
        return;
      case "d":
        this.align(8);
        this.ensure(8);
        this.buf.writeDoubleLE(Number(value), this.pos);
        this.pos += 8;
        return;
      case "s":
      case "o":
        this.string(String(value));
        return;
      case "g":
        this.signature(String(value));
        return;
      case "v": {
        const inner = value as Variant;
        this.signature(inner.signature);
        this.align(alignmentOf(inner.signature));
        this.writeValue(inner.signature, inner.value);
        return;
      }
      case "a":
        this.writeArray(type, value);
        return;
      case "(": {
        this.align(8);
        const fields = splitAll(type.slice(1, -1));
        const tuple = value as unknown[];
        fields.forEach((field, index) => this.writeValue(field, tuple[index]));
        return;
      }
      case "{": {
        this.align(8);
        const [key, val] = splitType(type.slice(1, -1));
        const entry = value as [unknown, unknown];
        this.writeValue(key, entry[0]);
        this.writeValue(val, entry[1]);
        return;
      }
      default:
        throw new Error(`tipo D-Bus não suportado na escrita: ${type}`);
    }
  }

  private writeArray(type: string, value: unknown): void {
    const element = type.slice(1);
    // `ay` é o caso quente: bytes crus, sem alinhamento por elemento.
    if (element === "y" && value instanceof Uint8Array) {
      const at = this.reserveU32();
      this.raw(value);
      this.patchU32(at, value.byteLength);
      return;
    }
    const at = this.reserveU32();
    this.align(alignmentOf(element));
    const start = this.pos;
    if (element.startsWith("{")) {
      for (const [k, v] of value as Array<[unknown, unknown]>) {
        this.align(8);
        const [keyType, valType] = splitType(element.slice(1, -1));
        this.writeValue(keyType, k);
        this.writeValue(valType, v);
      }
    } else if (value instanceof Map) {
      for (const [k, v] of value as Map<unknown, unknown>) {
        this.writeValue(element, [k, v]);
      }
    } else {
      for (const item of value as unknown[]) {
        this.align(alignmentOf(element));
        this.writeValue(element, item);
      }
    }
    this.patchU32(at, this.pos - start);
  }

  finish(): Buffer {
    return this.buf.subarray(0, this.pos);
  }
}

class Reader {
  private readonly buf: Buffer;
  private pos = 0;
  private readonly le: boolean;

  constructor(buf: Buffer, offset = 0, le = true) {
    this.buf = buf;
    this.pos = offset;
    this.le = le;
  }

  get offset(): number {
    return this.pos;
  }

  align(boundary: number): void {
    this.pos += (boundary - (this.pos % boundary)) % boundary;
  }

  u8(): number {
    const value = this.buf.readUInt8(this.pos);
    this.pos += 1;
    return value;
  }

  u16(): number {
    this.align(2);
    const value = this.le ? this.buf.readUInt16LE(this.pos) : this.buf.readUInt16BE(this.pos);
    this.pos += 2;
    return value;
  }

  u32(): number {
    this.align(4);
    const value = this.le ? this.buf.readUInt32LE(this.pos) : this.buf.readUInt32BE(this.pos);
    this.pos += 4;
    return value;
  }

  i32(): number {
    this.align(4);
    const value = this.le ? this.buf.readInt32LE(this.pos) : this.buf.readInt32BE(this.pos);
    this.pos += 4;
    return value;
  }

  u64(): bigint {
    this.align(8);
    const value = this.le ? this.buf.readBigUInt64LE(this.pos) : this.buf.readBigUInt64BE(this.pos);
    this.pos += 8;
    return value;
  }

  double(): number {
    this.align(8);
    const value = this.le ? this.buf.readDoubleLE(this.pos) : this.buf.readDoubleBE(this.pos);
    this.pos += 8;
    return value;
  }

  string(): string {
    const len = this.u32();
    const out = this.buf.toString("utf8", this.pos, this.pos + len);
    this.pos += len + 1;
    return out;
  }

  signature(): string {
    const len = this.u8();
    const out = this.buf.toString("ascii", this.pos, this.pos + len);
    this.pos += len + 1;
    return out;
  }

  raw(length: number): Uint8Array {
    const out = Uint8Array.prototype.slice.call(this.buf, this.pos, this.pos + length);
    this.pos += length;
    return out as Uint8Array;
  }

  readValue(signature: string): DBusValue {
    const [type] = splitType(signature);
    switch (type[0]) {
      case "y":
        return this.u8();
      case "b":
        return this.u32() !== 0;
      case "n":
      case "q":
        return this.u16();
      case "i":
        return this.i32();
      case "u":
      case "h":
        return this.u32();
      case "x":
      case "t":
        return this.u64();
      case "d":
        return this.double();
      case "s":
      case "o":
        return this.string();
      case "g":
        return this.signature();
      case "v": {
        const inner = this.signature();
        this.align(alignmentOf(inner));
        return { signature: inner, value: this.readValue(inner) };
      }
      case "a":
        return this.readArray(type);
      case "(": {
        this.align(8);
        return splitAll(type.slice(1, -1)).map((field) => this.readValue(field));
      }
      case "{": {
        this.align(8);
        const [keyType, valType] = splitType(type.slice(1, -1));
        const key = this.readValue(keyType);
        const val = this.readValue(valType);
        return [key, val] as [DBusValue, DBusValue];
      }
      default:
        throw new Error(`tipo D-Bus não suportado na leitura: ${type}`);
    }
  }

  private readArray(type: string): DBusValue {
    const element = type.slice(1);
    const len = this.u32();
    this.align(alignmentOf(element));
    const end = this.pos + len;
    if (element === "y") return this.raw(len);
    if (element.startsWith("{")) {
      const entries: Array<[DBusValue, DBusValue]> = [];
      while (this.pos < end) {
        this.align(8);
        entries.push(this.readValue(element) as [DBusValue, DBusValue]);
      }
      return entries;
    }
    const items: DBusValue[] = [];
    while (this.pos < end) {
      this.align(alignmentOf(element));
      items.push(this.readValue(element));
    }
    return items;
  }
}

export interface MarshalledMessage {
  readonly type: number;
  readonly flags: number;
  readonly serial: number;
  readonly headers: Array<[number, Variant]>;
  readonly signature: string;
  readonly body: DBusValue[];
}

export function marshalMessage(message: MarshalledMessage): Buffer {
  const bodyWriter = new Writer(128);
  splitAll(message.signature).forEach((type, index) => {
    bodyWriter.align(alignmentOf(type));
    bodyWriter.writeValue(type, message.body[index]);
  });
  const body = bodyWriter.finish();

  const header = new Writer(256);
  header.u8(ENDIAN_LITTLE);
  header.u8(message.type);
  header.u8(message.flags);
  header.u8(1);
  header.u32(body.byteLength);
  header.u32(message.serial);

  const fields = message.headers.slice();
  if (message.signature.length > 0 && !fields.some(([code]) => code === HEADER_FIELD.SIGNATURE)) {
    fields.push([HEADER_FIELD.SIGNATURE, variant("g", message.signature)]);
  }
  const fieldsAt = header.reserveU32();
  header.align(8);
  const fieldsStart = header.offset;
  for (const [code, item] of fields) {
    header.align(8);
    header.u8(code);
    header.signature(item.signature);
    header.align(alignmentOf(item.signature));
    header.writeValue(item.signature, item.value);
  }
  header.patchU32(fieldsAt, header.offset - fieldsStart);

  header.align(8);
  return Buffer.concat([header.finish(), body]);
}

export function parseMessage(input: Buffer): MarshalledMessage {
  const endian = input.readUInt8(0);
  if (endian !== ENDIAN_LITTLE && endian !== ENDIAN_BIG) {
    throw new Error(`ordem de bytes inválida na mensagem D-Bus: 0x${endian.toString(16)}`);
  }
  const le = endian === ENDIAN_LITTLE;
  const readU32At = (at: number): number => (le ? input.readUInt32LE(at) : input.readUInt32BE(at));

  const type = input.readUInt8(1);
  const flags = input.readUInt8(2);
  const bodyLength = readU32At(4);
  const serial = readU32At(8);
  const fieldsLength = readU32At(12);

  const reader = new Reader(input, 16, le);
  const headers: Array<[number, Variant]> = [];
  const fieldsEnd = 16 + fieldsLength;
  while (reader.offset < fieldsEnd) {
    reader.align(8);
    const code = reader.u8();
    const sig = reader.signature();
    reader.align(alignmentOf(sig));
    headers.push([code, { signature: sig, value: reader.readValue(sig) }]);
  }

  const bodyStart = 16 + fieldsLength;
  const padded = bodyStart + ((8 - (bodyStart % 8)) % 8);
  const signatureEntry = headers.find(([code]) => code === HEADER_FIELD.SIGNATURE);
  const signature = signatureEntry ? String(signatureEntry[1].value) : "";

  const bodyReader = new Reader(input, padded, le);
  const body: DBusValue[] = [];
  for (const fieldType of splitAll(signature)) {
    bodyReader.align(alignmentOf(fieldType));
    body.push(bodyReader.readValue(fieldType));
  }
  if (bodyReader.offset !== padded + bodyLength) {
    throw new Error(
      `corpo D-Bus com tamanho divergente: lidos ${bodyReader.offset - padded} de ${bodyLength}`,
    );
  }
  return { type, flags, serial, headers, signature, body };
}

/**
 * Pré-condição de ambiente, distinta de falha de protocolo: o barramento não existe, o
 * endereço não é suportado, o socket não responde. É a mesma distinção que o exit `2` faz
 * contra o `1` nas guardas deste repositório — e é **tipada**, e não inferida por mensagem,
 * para que quem consome (o cofre) não precise casar texto para saber o que aconteceu.
 */
export class DBusPreconditionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DBusPreconditionError";
  }
}

/**
 * Lê o caminho do socket do barramento de sessão.
 *
 * Um endereço D-Bus é `<transporte>:<chave>=<valor>,<chave>=<valor>…`, e vários endereços podem
 * vir separados por `;`. O separador entre o transporte e a **primeira** chave é `:`, não `,` —
 * e era exatamente isso que a primeira versão desta função não aceitava: num ambiente normal,
 * `unix:path=/run/user/1000/bus,guid=…` não casava com `/(?:^|,)path=/`, e um barramento
 * perfeitamente saudável era reportado como "endereço não suportado".
 */
export function sessionBusPath(env: NodeJS.ProcessEnv = process.env): string {
  const address = env.DBUS_SESSION_BUS_ADDRESS;
  if (!address) {
    throw new DBusPreconditionError(
      "DBUS_SESSION_BUS_ADDRESS não definido — sem barramento de sessão",
    );
  }
  const primeiro = (address.split(";")[0] ?? "").trim();
  const separador = primeiro.indexOf(":");
  if (separador === -1) {
    throw new DBusPreconditionError(`endereço de barramento sem transporte: ${primeiro}`);
  }
  const transporte = primeiro.slice(0, separador);
  if (transporte !== "unix") {
    throw new DBusPreconditionError(`transporte de barramento não suportado: ${transporte}`);
  }
  for (const chave of primeiro.slice(separador + 1).split(",")) {
    const igual = chave.indexOf("=");
    if (igual === -1) continue;
    const nome = chave.slice(0, igual);
    const valor = chave.slice(igual + 1);
    if (nome === "path" && valor.startsWith("/")) return valor;
    if (nome === "abstract") {
      throw new DBusPreconditionError(
        "barramento abstrato não suportado: este transporte só aceita unix:path=",
      );
    }
  }
  throw new DBusPreconditionError(`endereço de barramento sem path: ${primeiro}`);
}

export interface DBusReply {
  readonly signature: string;
  readonly body: DBusValue[];
}

/**
 * Cliente do barramento de sessão: só o suficiente para `Secret Service`.
 * Autenticação `EXTERNAL` (a credencial é o uid do processo, que o kernel já provou
 * no socket Unix) — não há senha para vazar aqui.
 */
export class DBusClient {
  private socket: Socket | null = null;
  private serial = 1;
  private pending = new Map<
    number,
    { resolve: (reply: DBusReply) => void; reject: (error: Error) => void }
  >();
  private buffer: Buffer = Buffer.alloc(0);
  private authenticated = false;

  async connect(path = sessionBusPath()): Promise<void> {
    const socket = createConnection({ path });
    this.socket = socket;
    socket.on("data", (chunk: Buffer) => this.onData(chunk));
    socket.on("error", (error: Error) => this.failAll(error));
    socket.on("close", () => this.failAll(new Error("barramento de sessão fechou a conexão")));
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("error", (error: NodeJS.ErrnoException) => {
        // Socket ausente ou recusando é a bancada que não está montada, não um protocolo
        // quebrado: vira pré-condição, e o consumidor decide o código de saída por tipo.
        reject(
          error.code === "ENOENT" || error.code === "ECONNREFUSED"
            ? new DBusPreconditionError(
                `socket do barramento inacessível em ${path} (${error.code})`,
              )
            : error,
        );
      });
    });
    await this.authenticate();
    const hello = await this.call({
      destination: "org.freedesktop.DBus",
      path: "/org/freedesktop/DBus",
      interface: "org.freedesktop.DBus",
      member: "Hello",
      signature: "",
      body: [],
    });
    this.uniqueName = String(hello.body[0] ?? "");
  }

  uniqueName = "";

  private async authenticate(): Promise<void> {
    const socket = this.socket;
    if (!socket) throw new Error("socket ausente na autenticação");
    const uid = typeof process.getuid === "function" ? process.getuid() : 0;
    const credential = Buffer.from(String(uid), "ascii").toString("hex");
    const lines = [
      Buffer.from([0]).toString("binary") + `AUTH EXTERNAL ${credential}\r\n`,
      "NEGOTIATE_UNIX_FD\r\n",
      "BEGIN\r\n",
    ];
    socket.write(lines[0]);
    socket.write(lines[1]);
    socket.write(lines[2]);
    // A resposta de AUTH chega em texto; `BEGIN` fecha a fase de autenticação. Como o
    // servidor pode recusar NEGOTIATE_UNIX_FD, toleramos `ERROR` nessa linha.
    await new Promise<void>((resolve, reject) => {
      const deadline = setTimeout(() => reject(new Error("autenticação D-Bus expirou")), 5000);
      const onData = (chunk: Buffer): void => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        const text = this.buffer.toString("binary");
        if (text.includes("REJECTED")) {
          clearTimeout(deadline);
          socket.off("data", onData);
          reject(new Error("barramento recusou a autenticação EXTERNAL"));
          return;
        }
        if (text.includes("OK ") && (text.includes("AGREE_UNIX_FD") || text.includes("ERROR"))) {
          clearTimeout(deadline);
          socket.off("data", onData);
          const begin = text.indexOf("BEGIN");
          this.buffer = begin >= 0 ? this.buffer.subarray(begin + 5) : Buffer.alloc(0);
          this.authenticated = true;
          resolve();
        }
      };
      socket.on("data", onData);
      socket.once("error", (error: Error) => {
        clearTimeout(deadline);
        reject(error);
      });
    });
  }

  private onData(chunk: Buffer): void {
    if (!this.authenticated) return;
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      if (this.buffer.length < 16) return;
      const fieldsLength = this.buffer.readUInt32LE(12);
      const total = 16 + fieldsLength + ((8 - ((16 + fieldsLength) % 8)) % 8);
      const bodyLength = this.buffer.readUInt32LE(4);
      const messageLength = total + bodyLength;
      if (this.buffer.length < messageLength) return;
      const frame = this.buffer.subarray(0, messageLength);
      this.buffer = this.buffer.subarray(messageLength);
      let parsed: MarshalledMessage;
      try {
        parsed = parseMessage(frame);
      } catch (error) {
        this.failAll(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      if (parsed.type === MESSAGE_TYPE.SIGNAL) continue;
      const replySerialEntry = parsed.headers.find(([code]) => code === HEADER_FIELD.REPLY_SERIAL);
      const replySerial = Number(replySerialEntry?.[1].value ?? 0);
      const waiter = this.pending.get(replySerial);
      if (!waiter) continue;
      this.pending.delete(replySerial);
      if (parsed.type === MESSAGE_TYPE.ERROR) {
        const nameEntry = parsed.headers.find(([code]) => code === HEADER_FIELD.ERROR_NAME);
        const name = String(nameEntry?.[1].value ?? "org.freedesktop.DBus.Error");
        const detail = parsed.body[0];
        waiter.reject(
          new DBusError(name, `${name}: ${typeof detail === "string" ? detail : "erro"} `),
        );
        continue;
      }
      waiter.resolve({ signature: parsed.signature, body: parsed.body });
    }
  }

  private failAll(error: Error): void {
    for (const waiter of this.pending.values()) waiter.reject(error);
    this.pending.clear();
  }

  async call(request: {
    destination: string;
    path: string;
    interface: string;
    member: string;
    signature: string;
    body: DBusValue[];
  }): Promise<DBusReply> {
    const socket = this.socket;
    if (!socket) throw new Error("cliente D-Bus não conectado");
    const serial = this.serial;
    this.serial = (this.serial + 1) >>> 0 || 1;
    const headers: Array<[number, Variant]> = [
      [HEADER_FIELD.PATH, variant("o", request.path)],
      [HEADER_FIELD.INTERFACE, variant("s", request.interface)],
      [HEADER_FIELD.MEMBER, variant("s", request.member)],
      [HEADER_FIELD.DESTINATION, variant("s", request.destination)],
    ];
    const frame = marshalMessage({
      type: MESSAGE_TYPE.METHOD_CALL,
      flags: 0,
      serial,
      headers,
      signature: request.signature,
      body: request.body,
    });
    const reply = new Promise<DBusReply>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(serial);
        reject(new Error(`chamada D-Bus ${request.member} expirou`));
      }, 15000);
      this.pending.set(serial, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
    });
    socket.write(frame);
    return reply;
  }

  /** Propriedade D-Bus comum (`org.freedesktop.DBus.Properties.Get`), devolvida como variante crua. */
  async getProperty(target: string, path: string, iface: string, name: string): Promise<Variant> {
    const reply = await this.call({
      destination: target,
      path,
      interface: "org.freedesktop.DBus.Properties",
      member: "Get",
      signature: "ss",
      body: [iface, name],
    });
    return reply.body[0] as Variant;
  }

  close(): void {
    this.socket?.end();
    this.socket = null;
  }
}

/** Identificador de correlação do audit log: aleatório, nunca derivado do segredo. */
export function auditId(): string {
  return randomBytes(8).toString("hex");
}
