import type { ReactNode } from "react";

/**
 * Renderização mínima e segura de markdown do chat (SEC-001, lote 02).
 *
 * Suporta apenas `**negrito**` e quebras de linha. O conteúdo vem do gateway
 * de IA (terceiro não confiável — V7 correção #14): tudo vira text node ou
 * <strong>, que o React escapa por construção. Nenhum HTML é avaliado, em
 * nenhuma hipótese — não existe caminho de `dangerouslySetInnerHTML`.
 */
export function renderChatMarkdown(text: string): ReactNode[] {
  return text.split("\n").map((line, index) => <div key={index}>{renderLine(line)}</div>);
}

function renderLine(line: string): ReactNode[] {
  return line.split(/(\*\*.+?\*\*)/g).map((part, index) => {
    if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}
