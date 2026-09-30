/**
 * Bancada do sidecar secreto-injetor (F14-1 / DBT-32).
 *
 * O autoteste da CLI mede o sidecar contra o ambiente **real** — área de transferência de
 * verdade, cofre de verdade. Em CI não existe nenhum dos dois, e é por isso que o núcleo
 * recebe as duas dependências por injeção: aqui elas são de bancada, e os cinco cenários
 * rodam de forma determinística em vez de serem pulados.
 *
 * O teste não repete o autoteste: ele mede o que o autoteste **não consegue medir sobre si
 * mesmo**. O cenário `audit-sem-valor` afirma "não achei valor nenhum"; sozinho, ele passaria
 * igualmente se não procurasse. O controle negativo abaixo planta um valor sob a raiz e exige
 * que a varredura o encontre — sem isso "não achei" não é "medi".
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AuditLog, SEM_VALOR } from "../../scripts/secret-sidecar/audit";
import { ClipboardError, type Clipboard } from "../../scripts/secret-sidecar/clipboard";
import {
  FaultInjectingKeychain,
  KeychainError,
  MemoryKeychain,
  type Keychain,
} from "../../scripts/secret-sidecar/keychain";
import {
  MARCA_FICTICIA,
  exitCodeFor,
  runSelftest,
  type RelatorioAutoteste,
} from "../../scripts/secret-sidecar/selftest";
import { SecretSidecar, SidecarError } from "../../scripts/secret-sidecar/sidecar";

const CENARIOS = [
  "generate-e-restore",
  "area-de-transferencia",
  "fail-closed-no-cofre",
  "sonda-401-200-e-denylist",
  "audit-sem-valor",
];

/** Área de transferência em memória: a bancada que substitui o Wayland/X11 em CI. */
class BancadaClipboard implements Clipboard {
  readonly kind = "bancada";
  private buffer = new Uint8Array(0);

  async read(): Promise<Uint8Array> {
    return new Uint8Array(this.buffer);
  }

  async write(bytes: Uint8Array): Promise<void> {
    this.buffer = new Uint8Array(bytes);
  }

  async types(): Promise<string[]> {
    return ["text/plain"];
  }

  async wipe(): Promise<void> {
    this.buffer = new Uint8Array(0);
    const restante = await this.read();
    if (restante.length > 0) {
      throw new ClipboardError(
        "not-empty",
        `a area de transferencia ainda devolve ${restante.length} bytes apos a limpeza`,
      );
    }
  }
}

/**
 * Área de transferência que **não** limpa. Existe para exercitar a metade difícil do
 * contrato de `copy_button_capture`: guardar primeiro e limpar depois.
 */
class ClipboardQueNaoLimpa extends BancadaClipboard {
  override async wipe(): Promise<void> {
    const restante = await this.read();
    if (restante.length > 0) {
      throw new ClipboardError(
        "not-empty",
        `a area de transferencia ainda devolve ${restante.length} bytes apos a limpeza`,
      );
    }
  }
}

describe("sidecar secreto-injetor", () => {
  let raiz: string;

  beforeEach(async () => {
    raiz = await mkdtemp(join(tmpdir(), "sidecar-bancada-"));
  });

  afterEach(async () => {
    await rm(raiz, { recursive: true, force: true });
  });

  function caminhos(): { auditPath: string; denylistPath: string } {
    return { auditPath: join(raiz, "audit.jsonl"), denylistPath: join(raiz, "denylist.jsonl") };
  }

  // `keychain: Keychain` declarado, nao inferido do valor padrao: sem a anotacao o parametro
  // estreita para `MemoryKeychain` e o helper passa a recusar qualquer outro cofre — foi
  // exatamente o que aconteceu com `FaultInjectingKeychain`.
  function bancada(
    keychain: Keychain = new MemoryKeychain(),
    area: Clipboard = new BancadaClipboard(),
  ) {
    const { auditPath, denylistPath } = caminhos();
    return new SecretSidecar({
      keychain,
      clipboard: async () => area,
      audit: new AuditLog(auditPath),
      denylistFile: denylistPath,
    });
  }

  async function autoteste(
    keychain: Keychain = new MemoryKeychain(),
    area = new BancadaClipboard(),
  ) {
    return runSelftest({
      keychain,
      clipboard: async () => area,
      raiz,
      ...caminhos(),
    });
  }

  it("roda os cinco cenarios e todos passam", async () => {
    const relatorio: RelatorioAutoteste = await autoteste();

    expect(relatorio.cenarios.map((cenario) => cenario.id)).toEqual(CENARIOS);
    for (const cenario of relatorio.cenarios) {
      expect(cenario.outcome, `${cenario.id}: ${cenario.detalhe}`).toBe("pass");
    }
    expect(relatorio.outcome).toBe("pass");
    expect(exitCodeFor(relatorio)).toBe(0);
  });

  it("controle negativo: valor plantado sob a raiz reprova a varredura de audit", async () => {
    // Sem esta prova, "5 valores ausentes e 5 hashes presentes" seria compatível com uma
    // varredura que não varre nada — o mesmo verde, e nenhuma medição.
    await writeFile(join(raiz, "vazamento-plantado.txt"), `${MARCA_FICTICIA}planta\n`, "utf8");

    const relatorio = await autoteste();
    const varredura = relatorio.cenarios.find((cenario) => cenario.id === "audit-sem-valor");

    expect(varredura?.outcome).toBe("fail");
    // O achado nomeia o ARQUIVO e a CLASSE do vazamento — e nao reproduz a marca. Um relatorio
    // de vazamento que copia o conteudo vazado para dentro de si e um segundo vazamento; o que
    // ele precisa entregar e onde olhar.
    expect(varredura?.detalhe).toContain("vazamento-plantado.txt");
    expect(varredura?.detalhe).toContain("marca ficticia em claro");
    expect(varredura?.detalhe).not.toContain(MARCA_FICTICIA);
    expect(relatorio.outcome).toBe("fail");
    expect(exitCodeFor(relatorio)).toBe(1);
  });

  it("controle positivo: o audit carrega o sha256 e nao carrega o valor", async () => {
    await autoteste();

    const bruto = await readFile(join(raiz, "audit.jsonl"), "utf8");
    expect(bruto).not.toContain(MARCA_FICTICIA);

    const linhas = bruto.split("\n").filter((linha) => linha.trim() !== "");
    expect(linhas.length).toBeGreaterThan(0);
    const registros = linhas.map(
      (linha) => JSON.parse(linha) as { op: string; sha256: string; outcome: string },
    );

    // Invariante do log inteiro: ou e um sha256, ou a marca explicita de que nenhum valor
    // esteve em jogo. Nao existe terceira forma — e "inventar um hash" nao e uma delas.
    for (const registro of registros) {
      expect(registro.sha256, `${registro.op}/${registro.outcome}`).toMatch(
        new RegExp(`^(?:[0-9a-f]{64}|${SEM_VALOR})$`),
      );
    }

    // O `generate` que deu certo carrega o hash do que guardou...
    const gerados = registros.filter(
      (registro) => registro.op === "generate" && registro.outcome === "ok",
    );
    expect(gerados.length).toBeGreaterThanOrEqual(5);
    for (const registro of gerados) {
      expect(registro.sha256).toMatch(/^[0-9a-f]{64}$/);
    }

    // ...e o que falhou marca `sem-valor` em vez de fabricar um hash: o cenario
    // `fail-closed-no-cofre` aborta seis operacoes, entao este ramo tem de existir.
    const semHash = registros.filter(
      (registro) => registro.op === "generate" && registro.outcome !== "ok",
    );
    expect(semHash.length).toBeGreaterThan(0);
    for (const registro of semHash) {
      expect(registro.sha256).toBe(SEM_VALOR);
    }
  });

  it("generate devolve so ref e sha256 — a forma e o que reprova um metodo de depuracao", async () => {
    const alvo = await bancada().generate("ref-de-bancada", 32);

    // Um `get` que devolvesse o valor "so para depurar" passaria em todo o resto. E esta linha
    // que o reprova: a forma do retorno e a asserção, nao a presenca dos campos certos.
    expect(Object.keys(alvo).sort().join(",")).toBe("ref,sha256");
    expect(alvo.ref).toBe("ref-de-bancada");
    expect(alvo.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("copy_button_capture guarda antes de limpar: area que nao limpa nao custa o valor", async () => {
    const cofre = new MemoryKeychain();
    const area = new ClipboardQueNaoLimpa();
    await area.write(new TextEncoder().encode(`${MARCA_FICTICIA}sido`));

    await expect(bancada(cofre, area).copy_button_capture("ref-nao-limpa")).rejects.toThrow(
      /valor guardado, mas a area de transferencia nao foi limpa/,
    );

    // A metade que importa: a falha de limpeza acontece DEPOIS de o valor estar a salvo.
    expect(await cofre.list()).toEqual(["ref-nao-limpa"]);
  });

  it("fail-closed: cofre com falha injetada aborta a operacao", async () => {
    const cofre = new FaultInjectingKeychain(new MemoryKeychain(), [
      "put",
      "get",
      "delete",
      "list",
    ]);

    await expect(bancada(cofre).generate("ref-com-cofre-quebrado", 32)).rejects.toBeInstanceOf(
      KeychainError,
    );
  });

  it("denylist recusa sha256_old que nao corresponde ao cofre", async () => {
    const sidecar = bancada();
    // O cofre precisa ter um valor atual: sem ele nao ha com o que comparar, e a recusa
    // acontece por outro motivo (que o teste seguinte nomeia).
    await sidecar.generate("ref-com-valor", 32);

    let capturado: unknown;
    try {
      await sidecar.denylist_update("ref-com-valor", "0".repeat(64), "1".repeat(64));
    } catch (error) {
      capturado = error;
    }

    expect(capturado).toBeInstanceOf(SidecarError);
    expect((capturado as SidecarError).reason).toBe("precondicao");
  });

  it("denylist sobre ref inexistente falha antes de comparar — a ordem e a assercao", async () => {
    let capturado: unknown;
    try {
      await bancada().denylist_update("ref-sem-valor", "0".repeat(64), "1".repeat(64));
    } catch (error) {
      capturado = error;
    }

    // Nao da para comparar `sha256_old` com um valor que nao existe. A recusa e do cofre, e
    // nao da denylist — distinguish as duas e o que faz o codigo de saida 2 dizer a verdade.
    expect(capturado).toBeInstanceOf(KeychainError);
    expect((capturado as KeychainError).reason).toBe("missing");
  });

  it("mantem a taxonomia 0/1/2 entre aprovado, reprovado e precondicao", () => {
    const relatorio = (outcome: RelatorioAutoteste["outcome"]): RelatorioAutoteste => ({
      cenarios: [],
      outcome,
    });

    expect(exitCodeFor(relatorio("pass"))).toBe(0);
    expect(exitCodeFor(relatorio("fail"))).toBe(1);
    // Precondicao nao e reprovacao: "o ambiente nao permite medir" tem codigo proprio, pelo
    // mesmo motivo que as guardas do repositorio separam o exit 2 do exit 1.
    expect(exitCodeFor(relatorio("precondicao"))).toBe(2);
  });
});
