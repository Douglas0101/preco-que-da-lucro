/**
 * CLI do sidecar. É a superfície que o operador e o pipeline usam.
 *
 * **Nenhum subcomando aceita um segredo como argumento.** Não existe `put`: a única entrada
 * de valor é `capture`, que lê da área de transferência. Isso é uma propriedade de desenho,
 * não uma omissão — um argumento de linha de comando aparece em `ps`, no histórico do shell
 * e no journal do systemd, e um cofre que aceita o valor por `argv` vaza pelo `argv`.
 *
 * Toda saída é JSON com `ref`, `sha256` e escalares de diagnóstico. O valor não tem por onde
 * sair: não há caminho de código que o imprima.
 *
 * Códigos de saída, na mesma taxonomia das guardas do repositório: `0` sucesso, `1`
 * veredicto (falhou ou recusado por política), `2` **pré-condição** — o ambiente não permite
 * medir (sem cofre, sem área de transferência, ref inexistente).
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { AuditLog } from "./audit.ts";
import { ClipboardError, detectClipboard, type Clipboard } from "./clipboard.ts";
import { KeychainError, MemoryKeychain, type Keychain } from "./keychain.ts";
import { exitCodeFor, runSelftest } from "./selftest.ts";
import { SecretServiceKeychain } from "./secret-service.ts";
import {
  SecretSidecar,
  SidecarError,
  ROTATION_PROVIDERS,
  type RotationProvider,
} from "./sidecar.ts";

const USO = `sidecar <comando> [flags]

Cofre e area de transferencia:
  generate <ref> [--bytes=32]        gera valor novo; devolve ref e sha256
  capture <ref>                      captura o que o botao "copiar" colocou na area e limpa
  copy-out <ref> [--ttl-ms=30000]    poe o valor na area para colar; limpa ao fim do TTL
  clear                              limpa a area de transferencia e confere
  restore <ref>                      prova que o valor e recuperavel; devolve so o sha256
  delete <ref>                       remove o ref do cofre
  list                               lista os nomes de ref (nunca os valores)

Entrega e verificacao:
  inject <ref> <url> --confirm       entrega o valor a um host da allowlist
  test <ref> --kind=http|db --target=<alvo>
                                     status bruto; nao prova closure de provedor
  test-provider <ref> --provider=<nome> --identity=<metadado>
                                     probe protegido, sem body/valores no output
  denylist <ref> <sha256_old> <sha256_new>
                                     registra a aposentadoria de um valor

Diagnostico:
  health                             estado medido do cofre e da area
  selftest [--backend=memoria|cofre] os cinco cenarios, com valores ficticios
  verify                             le o audit e conta linhas e malformadas

Flags: --backend=cofre|memoria  --root=<dir>  --audit=<arquivo>  --denylist=<arquivo>
       --bytes=<n>  --ttl-ms=<ms>  --kind=http|db  --target=<alvo>  --confirm
       --provider=neon|vercel|sonar|context7|deepseek|github  --identity=<metadado>

Nenhum subcomando aceita valor de segredo como argumento, por desenho.`;

export interface Caminhos {
  readonly raiz: string;
  readonly audit: string;
  readonly denylist: string;
}

export function resolveCaminhos(
  env: NodeJS.ProcessEnv = process.env,
  overrides: { root?: string; audit?: string; denylist?: string } = {},
): Caminhos {
  const raiz =
    overrides.root ?? env.SIDECAR_ROOT ?? join(homedir(), ".mcp-runtime", "secret-sidecar");
  return {
    raiz,
    audit: overrides.audit ?? env.SIDECAR_AUDIT ?? join(raiz, "audit.jsonl"),
    denylist: overrides.denylist ?? env.SIDECAR_DENYLIST ?? join(raiz, "denylist.jsonl"),
  };
}

interface Argumentos {
  readonly posicionais: string[];
  readonly flags: Map<string, string | true>;
}

export function parseArgs(argv: string[]): Argumentos {
  const posicionais: string[] = [];
  const flags = new Map<string, string | true>();
  for (const bruto of argv) {
    if (!bruto.startsWith("--")) {
      posicionais.push(bruto);
      continue;
    }
    const corpo = bruto.slice(2);
    const igual = corpo.indexOf("=");
    if (igual === -1) flags.set(corpo, true);
    else flags.set(corpo.slice(0, igual), corpo.slice(igual + 1));
  }
  return { posicionais, flags };
}

function exigirPosicional(posicionais: string[], indice: number, nome: string): string {
  const valor = posicionais[indice];
  if (valor === undefined || valor === "") {
    throw new SidecarError("precondicao", `falta o argumento <${nome}>`);
  }
  return valor;
}

function exigirRef(posicionais: string[]): string {
  const ref = exigirPosicional(posicionais, 1, "ref");
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(ref)) {
    throw new SidecarError("precondicao", `ref invalido: use [A-Za-z0-9._-], ate 64 caracteres`);
  }
  return ref;
}

function flagTexto(flags: Map<string, string | true>, nome: string): string | undefined {
  const valor = flags.get(nome);
  return typeof valor === "string" ? valor : undefined;
}

function flagBooleana(flags: Map<string, string | true>, nome: string): boolean {
  return flags.get(nome) === true || flags.get(nome) === "true";
}

function comoNumero(texto: string | undefined, padrao: number): number {
  if (texto === undefined) return padrao;
  const numero = Number(texto);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new SidecarError("precondicao", `valor numerico invalido: ${texto}`);
  }
  return numero;
}

/** O valor de um erro de precondição sai com `2`; qualquer outra coisa com `1`. */
/**
 * O valor de um erro de precondição sai com `2`; qualquer outra coisa com `1`.
 *
 * `locked`, `unavailable` e `missing` são **pré-condição**, não veredicto: nos três casos o
 * ambiente não permite medir — o cofre está trancado e exige desbloqueio, não há serviço de
 * segredos no barramento, ou não existe valor naquele ref. `denied` e `failure` são veredicto:
 * a política recusou, ou a coisa quebrou. A distinção não é decorativa — ela é o que faz o
 * relatório de uma rotação dizer se o valor foi recusado ou se a bancada estava desmontada.
 */
function codigoDe(error: unknown): number {
  if (error instanceof SidecarError) return error.reason === "precondicao" ? 2 : 1;
  if (error instanceof KeychainError) {
    return error.reason === "missing" || error.reason === "unavailable" || error.reason === "locked"
      ? 2
      : 1;
  }
  if (error instanceof ClipboardError) return error.reason === "unavailable" ? 2 : 1;
  return 1;
}

function emitir(corpo: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(corpo)}\n`);
}

/**
 * Resolve o cofre pedido. `cofre` fala com o Secret Service da sessão; em CI não há
 * barramento, e é por isso que `memoria` existe — não como atalho, mas como bancada.
 */
async function abrirCofre(
  backend: string,
  audit: AuditLog,
  paths: Caminhos,
  recursos: Recursos,
): Promise<{ keychain: Keychain; sidecar: SecretSidecar }> {
  let keychain: Keychain;
  if (backend === "memoria") {
    keychain = new MemoryKeychain();
  } else if (backend === "cofre") {
    const servico = new SecretServiceKeychain();
    await servico.open();
    keychain = servico;
  } else {
    throw new SidecarError("precondicao", `backend desconhecido: ${backend}`);
  }
  // Registrado antes do primeiro uso: se a operação seguinte falhar, o `finally` do `main`
  // ainda encontra o cofre aberto para fechar.
  recursos.cofre = keychain;
  const sidecar = new SecretSidecar({
    keychain,
    clipboard: () => detectClipboard(),
    audit,
    denylistFile: paths.denylist,
  });
  return { keychain, sidecar };
}

interface Recursos {
  cofre?: Keychain;
}

/**
 * Invólucro fino cuja única responsabilidade é **fechar o que abriu**. Sem o `finally` o
 * resultado é impresso e o processo pendura: o socket do Secret Service mantém o event loop
 * vivo, e um comando que já respondeu e não sai trava qualquer pipeline que o encadeie.
 * Medido antes desta correção: `health --backend=cofre` sob `timeout 10` → exit 124.
 */
export async function main(argv: string[]): Promise<number> {
  const recursos: Recursos = {};
  try {
    return await despachar(argv, recursos);
  } finally {
    recursos.cofre?.close?.();
  }
}

async function despachar(argv: string[], recursos: Recursos): Promise<number> {
  const { posicionais, flags } = parseArgs(argv);
  const comando = posicionais[0];
  if (comando === undefined || comando === "ajuda" || flagBooleana(flags, "help")) {
    process.stdout.write(`${USO}\n`);
    return 0;
  }
  const paths = resolveCaminhos(process.env, {
    ...(flagTexto(flags, "root") === undefined ? {} : { root: flagTexto(flags, "root") }),
    ...(flagTexto(flags, "audit") === undefined ? {} : { audit: flagTexto(flags, "audit") }),
    ...(flagTexto(flags, "denylist") === undefined
      ? {}
      : { denylist: flagTexto(flags, "denylist") }),
  });
  const audit = new AuditLog(paths.audit);
  const backend = flagTexto(flags, "backend") ?? "cofre";

  switch (comando) {
    case "selftest": {
      const escolhido = flagTexto(flags, "backend") ?? "memoria";
      let keychain: Keychain;
      if (escolhido === "cofre") {
        const servico = new SecretServiceKeychain();
        await servico.open();
        keychain = servico;
      } else {
        keychain = new MemoryKeychain();
      }
      recursos.cofre = keychain;
      const relatorio = await runSelftest({
        keychain,
        clipboard: () => detectClipboard(),
        auditPath: paths.audit,
        denylistPath: paths.denylist,
        raiz: paths.raiz,
      });
      for (const cenario of relatorio.cenarios) {
        process.stdout.write(
          `${cenario.outcome.toUpperCase().padEnd(11)} ${cenario.id}: ${cenario.detalhe}\n`,
        );
      }
      emitir({ comando, outcome: relatorio.outcome, cenarios: relatorio.cenarios.length });
      return exitCodeFor(relatorio);
    }

    case "verify": {
      const lido = await audit.read();
      const porOp = new Map<string, number>();
      for (const registro of lido.records) {
        porOp.set(registro.op, (porOp.get(registro.op) ?? 0) + 1);
      }
      emitir({
        comando,
        audit: paths.audit,
        linhas: lido.linhas,
        malformadas: lido.malformadas,
        por_op: Object.fromEntries(porOp),
      });
      return lido.malformadas > 0 ? 1 : 0;
    }
  }

  const { sidecar } = await abrirCofre(backend, audit, paths, recursos);

  switch (comando) {
    case "generate": {
      const ref = exigirRef(posicionais);
      emitir({
        comando,
        ...(await sidecar.generate(ref, comoNumero(flagTexto(flags, "bytes"), 32))),
      });
      return 0;
    }
    case "capture": {
      const ref = exigirRef(posicionais);
      emitir({ comando, ...(await sidecar.copy_button_capture(ref)) });
      return 0;
    }
    case "copy-out": {
      const ref = exigirRef(posicionais);
      const ttlMs = comoNumero(flagTexto(flags, "ttl-ms"), 30_000);
      // TTL 0 no núcleo: o CLI assume a limpeza, para poder garantir que ela acontece antes
      // de o processo terminar. Um timer `unref` que morre junto com o processo deixaria o
      // valor na área de transferência para sempre — o oposto do que este comando promete.
      const alvo = await sidecar.copy_to_clipboard(ref, 0);
      process.stderr.write(
        `valor na area de transferencia; cole no console agora. Limpeza automatica em ${ttlMs}ms.\n`,
      );
      await new Promise<void>((pronto) => setTimeout(pronto, ttlMs));
      const area: Clipboard = await detectClipboard();
      await area.wipe();
      emitir({ comando, ...alvo, limpo: true });
      return 0;
    }
    case "clear": {
      const area = await detectClipboard();
      await area.wipe();
      emitir({ comando, limpo: true, area: area.kind });
      return 0;
    }
    case "inject": {
      const ref = exigirRef(posicionais);
      const url = exigirPosicional(posicionais, 2, "url");
      emitir({
        comando,
        ...(await sidecar.inject_env_console(ref, url, {
          confirm: flagBooleana(flags, "confirm"),
        })),
      });
      return 0;
    }
    case "test-provider": {
      const ref = exigirRef(posicionais);
      const provider = flagTexto(flags, "provider") as RotationProvider;
      if (!ROTATION_PROVIDERS.includes(provider))
        throw new SidecarError("precondicao", "provider ausente/invalido");
      const identity = flagTexto(flags, "identity") ?? "";
      const result = await sidecar.test_provider(ref, provider, identity);
      emitir({ comando, ref, ...result });
      return result.authentication === "authenticated" && result.identity_match
        ? 0
        : result.authentication === "rejected"
          ? 1
          : 2;
    }
    case "test": {
      const ref = exigirRef(posicionais);
      const kind = flagTexto(flags, "kind") ?? "http";
      if (kind !== "http" && kind !== "db") {
        throw new SidecarError("precondicao", `kind deve ser http ou db, veio "${kind}"`);
      }
      const alvo = flagTexto(flags, "target");
      const resultado = await sidecar.test_endpoint(ref, kind, alvo);
      emitir({ comando, kind, ...resultado });
      return resultado.status === 200 ? 0 : 1;
    }
    case "denylist": {
      const ref = exigirRef(posicionais);
      const antigo = exigirPosicional(posicionais, 2, "sha256_old");
      const novo = exigirPosicional(posicionais, 3, "sha256_new");
      await sidecar.denylist_update(ref, antigo, novo);
      emitir({ comando, ref, sha256_old: antigo, sha256_new: novo });
      return 0;
    }
    case "restore": {
      const ref = exigirRef(posicionais);
      emitir({ comando, ref, ...(await sidecar.restore_from_keychain(ref)) });
      return 0;
    }
    case "delete": {
      const ref = exigirRef(posicionais);
      await sidecar.delete(ref);
      emitir({ comando, ref });
      return 0;
    }
    case "list": {
      emitir({ comando, refs: await sidecar.list() });
      return 0;
    }
    case "health": {
      emitir({ comando, estado: await sidecar.health(), backend });
      return 0;
    }
    default:
      throw new SidecarError("precondicao", `comando desconhecido: ${comando}`);
  }
}

const invocado = process.argv[1] ?? "";
if (invocado.endsWith("cli.ts") || invocado.endsWith("/sidecar")) {
  main(process.argv.slice(2))
    .then((codigo) => {
      process.exitCode = codigo;
    })
    .catch((error: unknown) => {
      const mensagem = error instanceof Error ? error.message : "falha desconhecida";
      process.stderr.write(`sidecar: ${mensagem}\n`);
      process.exitCode = codigoDe(error);
    });
}
