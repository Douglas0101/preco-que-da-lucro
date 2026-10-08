/**
 * Autoteste do sidecar — os cinco cenários do F14-1, todos com valores **fictícios**.
 *
 * O que separa este arquivo de uma lista de promessas é que cada cenário carrega o próprio
 * controle. Um teste que só afirma o lado bom passa com o código apagado; por isso cada um
 * abaixo tem um **caso negativo**, um **positivo obrigatório** ou uma **asserção de
 * identidade** — e o motivo está escrito ao lado da asserção, não num documento à parte.
 *
 * Os valores fictícios carregam a marca literal `FICTICIO-NAO-E-SEGREDO-`. Isso não é
 * enfeite: é o que permite varrer **todos** os arquivos do runtime procurando a marca em
 * claro e cada valor em quatro codificações (cru, hex, base64, base64url) de uma vez só.
 * Uma marca reconhecível transforma "nenhum valor vazou" de intenção em busca executável.
 *
 * O autoteste roda por padrão no cofre **em memória**, de propósito: um valor fictício
 * gravado no chaveiro real do operador ficaria lá depois do teste, e o teste passaria a
 * poluir exatamente o ambiente que ele existe para proteger.
 */

import { randomBytes, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { AuditLog, hashOf } from "./audit.ts";
import { ClipboardError, type Clipboard } from "./clipboard.ts";
import {
  FaultInjectingKeychain,
  KeychainError,
  MemoryKeychain,
  type Keychain,
} from "./keychain.ts";
import { SecretSidecar, SidecarError } from "./sidecar.ts";

export const MARCA_FICTICIA = "FICTICIO-NAO-E-SEGREDO-";

export type Resultado = "pass" | "fail" | "precondicao";

export interface Cenario {
  readonly id: string;
  readonly nome: string;
  readonly outcome: Resultado;
  readonly detalhe: string;
}

export interface RelatorioAutoteste {
  readonly cenarios: Cenario[];
  readonly outcome: Resultado;
}

export interface OpcoesAutoteste {
  readonly keychain: Keychain;
  readonly clipboard: () => Promise<Clipboard>;
  readonly auditPath: string;
  readonly denylistPath: string;
  /** Raiz varrida em busca de vazamento — o runtime do sidecar, não o repositório. */
  readonly raiz: string;
}

/** Valor fictício: marca literal legível + 24 bytes aleatórios, tudo ASCII. */
function ficticio(): Uint8Array {
  return Buffer.from(`${MARCA_FICTICIA}${randomBytes(24).toString("hex")}`, "utf8");
}

function pass(id: string, nome: string, detalhe: string): Cenario {
  return { id, nome, outcome: "pass", detalhe };
}

function fail(id: string, nome: string, detalhe: string): Cenario {
  return { id, nome, outcome: "fail", detalhe };
}

function precondicao(id: string, nome: string, detalhe: string): Cenario {
  return { id, nome, outcome: "precondicao", detalhe };
}

function exigirClipboard(): Promise<Clipboard> {
  throw new ClipboardError("unavailable", "este cenario nao usa area de transferencia");
}

function montar(opcoes: OpcoesAutoteste, keychain: Keychain): SecretSidecar {
  return new SecretSidecar({
    keychain,
    clipboard: opcoes.clipboard ?? exigirClipboard,
    audit: new AuditLog(opcoes.auditPath),
    denylistFile: opcoes.denylistPath,
  });
}

async function arquivosSob(raiz: string): Promise<string[]> {
  const encontrados: string[] = [];
  const entradas = await readdir(raiz, { withFileTypes: true }).catch(() => []);
  for (const entrada of entradas) {
    const caminho = join(raiz, entrada.name);
    if (entrada.isDirectory()) encontrados.push(...(await arquivosSob(caminho)));
    else if (entrada.isFile()) encontrados.push(caminho);
  }
  return encontrados;
}

/**
 * Cenário 1 — gerar e recuperar, com asserção de **forma**.
 *
 * A asserção que carrega o cenário não é o hash bater, é `Object.keys(alvo)` ser exatamente
 * `["ref", "sha256"]`. Um método que devolvesse o valor "só para depurar" continuaria
 * passando em todas as outras asserções deste arquivo; é esta linha que o reprova.
 */
async function cenarioGenerateRestore(opcoes: OpcoesAutoteste): Promise<Cenario> {
  const id = "generate-e-restore";
  const nome = "generate guarda sem devolver; restore recupera pelo hash";
  const sidecar = montar(opcoes, opcoes.keychain);
  const hashes: string[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const ref = `ficticio-gerado-${i}`;
    const alvo = await sidecar.generate(ref, 32);
    // Comparador por code unit UTF-16: MESMA ordem do `sort()` sem argumento (S2871).
    const campos = Object.keys(alvo)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
      .join(",");
    if (campos !== "ref,sha256") {
      return fail(
        id,
        nome,
        `generate devolveu os campos "${campos}"; valor de segredo nao pode sair`,
      );
    }
    if (!/^[0-9a-f]{64}$/.test(alvo.sha256)) {
      return fail(id, nome, `sha256 nao e hex de 64: "${alvo.sha256.slice(0, 12)}…"`);
    }
    const volta = await sidecar.restore_from_keychain(ref);
    if (volta.sha256 !== alvo.sha256) {
      return fail(id, nome, `restore de ${ref} devolveu hash diferente do que generate gravou`);
    }
    hashes.push(alvo.sha256);
  }
  if (new Set(hashes).size !== hashes.length) {
    return fail(id, nome, "dois refs receberam o mesmo valor; geracao nao e independente");
  }
  return pass(id, nome, `5 refs gerados, recuperados pelo hash e distintos entre si`);
}

/**
 * Cenário 2 — área de transferência, nas duas direções.
 *
 * Preserva o que estava ali **antes** e restaura no `finally`. Sem isso o teste destrói o
 * conteúdo do operador para provar uma limpeza, o que é uma péssima troca.
 */
async function cenarioAreaDeTransferencia(opcoes: OpcoesAutoteste): Promise<Cenario> {
  const id = "area-de-transferencia";
  const nome = "captura limpa a area; saida cega repoe o que estava no cofre";
  let clipboard: Clipboard;
  try {
    clipboard = await opcoes.clipboard();
  } catch {
    return precondicao(id, nome, "sem area de transferencia nesta sessao; nao ha o que medir");
  }
  const preservado = await clipboard.read();
  const sidecar = montar(opcoes, opcoes.keychain);
  const ref = "ficticio-captura";
  try {
    await clipboard.wipe();
    const marca = ficticio();
    await clipboard.write(marca);

    const capturado = await sidecar.copy_button_capture(ref);
    if (capturado.sha256 !== hashOf(marca)) {
      return fail(id, nome, "o hash do capturado difere do que estava na area de transferencia");
    }
    const aposCaptura = await clipboard.read();
    if (aposCaptura.length !== 0) {
      return fail(id, nome, `a area ainda devolve ${aposCaptura.length} bytes apos a captura`);
    }

    const saida = await sidecar.copy_to_clipboard(ref, 0);
    if (saida.sha256 !== capturado.sha256) {
      return fail(id, nome, "copy_to_clipboard devolveu hash diferente do que guardou");
    }
    const naArea = await clipboard.read();
    if (!Buffer.from(naArea).equals(Buffer.from(marca))) {
      return fail(id, nome, "o que voltou para a area difere do que saiu do cofre");
    }
    await clipboard.wipe();
    const final = await clipboard.read();
    if (final.length !== 0) {
      return fail(id, nome, `a area nao ficou vazia apos a limpeza final (${final.length} bytes)`);
    }
    return pass(
      id,
      nome,
      `captura conferida, limpeza provada vazia e saida cega identica (${marca.length} bytes)`,
    );
  } finally {
    if (preservado.length > 0) await clipboard.write(preservado).catch(() => undefined);
    else await clipboard.wipe().catch(() => undefined);
  }
}

/**
 * Cenário 3 — falha do cofre aborta a operação.
 *
 * Aqui está a razão de `FaultInjectingKeychain` morar no módulo do cofre e não no arquivo
 * de teste: o cenário precisa **produzir** a falha. Afirmar "falha de cofre aborta" sem
 * injetar uma falha é exatamente o tipo de cobertura aparente que este repositório recusa.
 */
async function cenarioFailClosed(opcoes: OpcoesAutoteste): Promise<Cenario> {
  const id = "fail-closed-no-cofre";
  const nome = "cofre indisponivel aborta toda operacao, sem gravar nada";
  const memoria = new MemoryKeychain();
  const injetado = new FaultInjectingKeychain(memoria, ["put", "get", "delete", "list"]);
  const sidecar = montar(opcoes, injetado);
  const problemas: string[] = [];
  const operacoes: Array<[nome: string, executar: () => Promise<unknown>]> = [
    ["generate", () => sidecar.generate("ficticio-falha", 32)],
    ["restore", () => sidecar.restore_from_keychain("ficticio-falha")],
    ["list", () => sidecar.list()],
    ["delete", () => sidecar.delete("ficticio-falha")],
    ["test_endpoint", () => sidecar.test_endpoint("ficticio-falha", "http", "http://127.0.0.1:1/")],
    ["denylist", () => sidecar.denylist_update("ficticio-falha", "a".repeat(64), "b".repeat(64))],
  ];
  for (const [operacao, executar] of operacoes) {
    try {
      await executar();
      problemas.push(`${operacao} NAO falhou`);
    } catch (error) {
      if (!(error instanceof KeychainError)) {
        problemas.push(`${operacao} falhou com ${(error as Error).name}, nao com KeychainError`);
      }
    }
  }
  const sobraram = await memoria.list();
  if (sobraram.length !== 0)
    problemas.push(`o cofre guardou ${sobraram.length} ref(s) durante as falhas`);
  if (problemas.length > 0) return fail(id, nome, problemas.join("; "));
  return pass(id, nome, `${operacoes.length} operacoes abortadas e nenhum ref gravado`);
}

/**
 * Cenário 4 — o audit prova sem carregar o valor.
 *
 * A varredura sozinha seria vácuo: um arquivo vazio não contém nada e passaria. O controle
 * positivo obrigatório é o `sha256` **estar** lá — se o hash está presente e o valor não
 * está, a ausência foi medida, não presumida.
 */
async function cenarioAuditSemValor(opcoes: OpcoesAutoteste): Promise<Cenario> {
  const id = "audit-sem-valor";
  const nome = "nenhum valor ficticio nos arquivos do runtime; o sha256 esta";
  const valores: Uint8Array[] = [];
  const sidecar = montar(opcoes, opcoes.keychain);
  for (let i = 1; i <= 5; i += 1) {
    const valor = ficticio();
    valores.push(valor);
    await opcoes.keychain.put(`ficticio-auditado-${i}`, valor);
    await sidecar.restore_from_keychain(`ficticio-auditado-${i}`);
  }
  const violacoes: string[] = [];
  const arquivos = await arquivosSob(opcoes.raiz);
  for (const arquivo of arquivos) {
    const bytes = await readFile(arquivo);
    const texto = bytes.toString("utf8");
    if (texto.includes(MARCA_FICTICIA)) {
      violacoes.push(`${arquivo}: marca ficticia em claro`);
    }
    for (const [posicao, valor] of valores.entries()) {
      const formas: Array<[string, string | Buffer]> = [
        ["cru", Buffer.from(valor)],
        ["hex", Buffer.from(valor).toString("hex")],
        ["base64", Buffer.from(valor).toString("base64")],
        ["base64url", Buffer.from(valor).toString("base64url")],
      ];
      for (const [forma, alvo] of formas) {
        const achou = Buffer.isBuffer(alvo) ? bytes.includes(alvo) : texto.includes(alvo);
        if (achou) violacoes.push(`${arquivo}: valor ${posicao + 1} em ${forma}`);
      }
    }
  }
  const audit = new AuditLog(opcoes.auditPath);
  const lido = await audit.read();
  if (lido.malformadas > 0) violacoes.push(`audit com ${lido.malformadas} linha(s) malformada(s)`);
  const textoAudit = await readFile(opcoes.auditPath, "utf8");
  for (const [posicao, valor] of valores.entries()) {
    if (!textoAudit.includes(hashOf(valor))) {
      violacoes.push(`sha256 do valor ${posicao + 1} ausente do audit (controle positivo falhou)`);
    }
  }
  if (violacoes.length > 0) return fail(id, nome, violacoes.slice(0, 4).join("; "));
  return pass(
    id,
    nome,
    `${arquivos.length} arquivo(s) varridos, ${valores.length} valores ausentes e ${valores.length} hashes presentes`,
  );
}

/**
 * Cenário 5 — a sonda de autenticação e a denylist.
 *
 * O par `401 → 200` é medido contra um servidor local que **recusa de verdade** credencial
 * errada. É o mesmo par que o teste de fechamento do DBT-36 exige, e é por isso que a sonda
 * fala autenticação em vez de alcance: um `ping` de TCP dá o mesmo resultado para a senha
 * certa e para a errada.
 */
async function cenarioSondaEDenylist(opcoes: OpcoesAutoteste): Promise<Cenario> {
  const id = "sonda-401-200-e-denylist";
  const nome = "credencial antiga da 401, nova da 200; denylist grava e recusa hash divergente";
  const bom = ficticio();
  const ruim = ficticio();
  const esperado = `Bearer ${Buffer.from(bom).toString("utf8")}`;
  const servidor = createServer((requisicao, resposta) => {
    const recebido = requisicao.headers.authorization ?? "";
    // Nunca ecoa o que recebeu: um servidor de teste que devolve o cabecalho na resposta
    // seria ele proprio um vazamento, e o teste passaria a provar o contrario do que quer.
    if (recebido === esperado) {
      resposta.writeHead(200);
      resposta.end("ok");
    } else {
      resposta.writeHead(401);
      resposta.end("nao");
    }
  });
  await new Promise<void>((pronto) => servidor.listen(0, "127.0.0.1", pronto));
  const porta = (servidor.address() as AddressInfo).port;
  const url = `http://127.0.0.1:${porta}/`;
  const sidecar = montar(opcoes, opcoes.keychain);
  try {
    await opcoes.keychain.put("ficticio-velho", ruim);
    await opcoes.keychain.put("ficticio-novo", bom);
    const velho = await sidecar.test_endpoint("ficticio-velho", "http", url);
    const novo = await sidecar.test_endpoint("ficticio-novo", "http", url);
    if (velho.status !== 401) {
      return fail(id, nome, `valor antigo deveria dar 401 e deu ${velho.status}`);
    }
    if (novo.status !== 200) {
      return fail(id, nome, `valor novo deveria dar 200 e deu ${novo.status}`);
    }
    await sidecar.denylist_update("ficticio-velho", velho.sha256, novo.sha256);
    const denylist = await readFile(opcoes.denylistPath, "utf8").catch(() => "");
    if (!denylist.includes(velho.sha256) || !denylist.includes(novo.sha256)) {
      return fail(id, nome, "a denylist nao registrou o par de hashes da rotacao");
    }
    let recusou = false;
    try {
      await sidecar.denylist_update("ficticio-velho", novo.sha256, velho.sha256);
    } catch (error) {
      recusou = error instanceof SidecarError && error.reason === "precondicao";
    }
    if (!recusou) {
      return fail(id, nome, "a denylist aceitou sha256_old divergente do que esta no cofre");
    }
    return pass(
      id,
      nome,
      `401 do valor antigo e 200 do novo em 127.0.0.1:${porta}; par gravado e divergencia recusada`,
    );
  } finally {
    await new Promise<void>((pronto) => servidor.close(() => pronto()));
  }
}

function agregar(cenarios: Cenario[]): Resultado {
  if (cenarios.some((cenario) => cenario.outcome === "fail")) return "fail";
  if (cenarios.some((cenario) => cenario.outcome === "precondicao")) return "precondicao";
  return "pass";
}

export async function runSelftest(opcoes: OpcoesAutoteste): Promise<RelatorioAutoteste> {
  // Never replace an operator's similarly named item. Track attempted writes as
  // well: a provider can persist an item before reporting an uncertain result.
  const prefix = `selftest-${randomUUID()}-`,
    owned = new Set<string>();
  if ((await opcoes.keychain.list()).some((ref) => ref.startsWith(prefix)))
    throw new KeychainError("failure", "namespace de autoteste ja existe");
  const scoped: Keychain = {
    kind: opcoes.keychain.kind,
    put: async (ref, value) => {
      owned.add(prefix + ref);
      await opcoes.keychain.put(prefix + ref, value);
    },
    get: (ref) => opcoes.keychain.get(prefix + ref),
    delete: (ref) => opcoes.keychain.delete(prefix + ref),
    list: async () =>
      (await opcoes.keychain.list())
        .filter((ref) => ref.startsWith(prefix))
        .map((ref) => ref.slice(prefix.length)),
  };
  const isolated = { ...opcoes, keychain: scoped };
  const cenarios: Cenario[] = [];
  let failure: unknown = null;
  try {
    cenarios.push(await cenarioGenerateRestore(isolated));
    cenarios.push(await cenarioAreaDeTransferencia(isolated));
    cenarios.push(await cenarioFailClosed(isolated));
    cenarios.push(await cenarioSondaEDenylist(isolated));
    // Por ultimo: depende do que os anteriores escreveram no audit.
    cenarios.push(await cenarioAuditSemValor(isolated));
  } catch (error) {
    failure = error;
  }
  for (const ref of owned) {
    try {
      await opcoes.keychain.delete(ref);
    } catch (error) {
      failure = error;
    }
  }
  try {
    if ((await opcoes.keychain.list()).some((ref) => ref.startsWith(prefix)))
      throw new KeychainError("failure", "cleanup nominal do autoteste incompleto");
  } catch (error) {
    failure = error;
  }
  if (failure) throw failure;
  return { cenarios, outcome: agregar(cenarios) };
}

/**
 * `precondicao` sai com `2`, distinto do `1` de veredicto — a mesma taxonomia das guardas
 * do repositório. Sem cofre nem área de transferência, um autoteste que saísse `1` estaria
 * dizendo que o sidecar está quebrado quando o que falta é bancada.
 */
export function exitCodeFor(relatorio: RelatorioAutoteste): number {
  if (relatorio.outcome === "fail") return 1;
  if (relatorio.outcome === "precondicao") return 2;
  return 0;
}
