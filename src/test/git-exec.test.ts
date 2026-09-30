import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gitExecutable, gitSync, resolverGit } from "../../scripts/lib/git-exec";

/**
 * `scripts/lib/git-exec.ts` — a decisão que substitui a resolução de `git` pelo
 * `PATH` ambiente (S4036). O que importa testar aqui não é o caminho feliz, é a
 * tabela de **recusa**: um guarda que só se provou no caminho verde é o que
 * `m02:temporal-guard` e o `dbPrecondition` já existiram para matar.
 */
let raiz: string;

beforeAll(() => {
  raiz = mkdtempSync(join(tmpdir(), "git-exec-"));
});

afterAll(() => {
  rmSync(raiz, { recursive: true, force: true });
});

function dirComGit(nome: string, modo: number, conteudo = "#!/bin/sh\nexit 0\n"): string {
  const dir = join(raiz, nome);
  mkdirSync(dir, { recursive: true });
  const bin = join(dir, "git");
  writeFileSync(bin, conteudo);
  chmodSync(bin, 0o755);
  chmodSync(dir, modo);
  return dir;
}

describe("git-exec — resolução sem PATH ambiente", () => {
  it("resolve um caminho ABSOLUTO em diretório fixo do sistema, e o prova", () => {
    // Controle de não-vacuidade: se isto não resolver, os testes de recusa abaixo
    // estariam passando porque a função não faz nada.
    const exe = gitExecutable();
    expect(exe.startsWith("/")).toBe(true);
    expect(exe).not.toBe("git");
    expect(["/usr/local/bin", "/usr/bin", "/bin"]).toContain(join(exe, ".."));
  });

  it("memoiza: duas chamadas devolvem o mesmo caminho", () => {
    expect(gitExecutable()).toBe(gitExecutable());
  });

  it("executa de verdade — `--version` responde", () => {
    expect(gitSync(["--version"])).toMatch(/^git version /);
  });

  it("NEGATIVO: diretório gravável por outros é recusado, mesmo com `git` executável dentro", () => {
    // Este é o ataque que a regra nomeia: um diretório que qualquer usuário
    // escreve, à frente do real, fornecendo o binário. Um `git` válido e
    // executável dentro dele tem de ser REJEITADO.
    const dir = dirComGit("open-777", 0o777);
    expect(() => resolverGit([dir])).toThrow(/gravável por outros/);
  });

  it("NEGATIVO: diretório sem `git` é recusado nomeando o candidato", () => {
    const vazio = join(raiz, "vazio");
    mkdirSync(vazio, { recursive: true });
    // `statSync` em path inexistente LANÇA (ENOENT), então este caso cai no
    // `catch` — a mensagem tem de dizer "inexistente", não "não é arquivo".
    expect(() => resolverGit([vazio])).toThrow(/inexistente/);
  });

  it("NEGATIVO: um diretório chamado `git` é recusado como 'não é arquivo'", () => {
    // Ramo distinto do anterior: aqui o path EXISTE e não é arquivo, que é
    // exatamente o que um atacante plantaria para desviar a resolução.
    const dir = join(raiz, "git-e-diretorio");
    mkdirSync(join(dir, "git"), { recursive: true });
    chmodSync(dir, 0o755);
    expect(() => resolverGit([dir])).toThrow(/não é arquivo/);
  });

  it("NEGATIVO: `git` sem permissão de execução é recusado", () => {
    const dir = join(raiz, "sem-x");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "git"), "#!/bin/sh\nexit 0\n");
    chmodSync(join(dir, "git"), 0o644);
    chmodSync(dir, 0o755);
    expect(() => resolverGit([dir])).toThrow(/sem permissão de execução/);
  });

  it("NEGATIVO: a mensagem promete nunca recuar para o PATH ambiente", () => {
    // O texto é contrato: é o que impede alguém de "consertar" a falha
    // devolvendo o nome do programa ao `execFileSync`.
    expect(() => resolverGit([join(raiz, "inexistente")])).toThrow(/NUNCA recuar para o PATH/);
  });

  it("NEGATIVO: um diretório gravável não bloqueia o próximo aceitável", () => {
    // A recusa é por candidato, não uma recusa geral: um `o+w` à frente não pode
    // impedir a resolução no `/usr/bin`.
    const aberto = dirComGit("open-777-2", 0o777);
    expect(resolverGit([aberto, "/usr/bin"])).toBe(gitExecutable());
  });
});
