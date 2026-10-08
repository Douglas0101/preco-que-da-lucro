import type { ReactNode } from "react";
import { parseChatMarkdownLine } from "@/lib/chat-markdown-parser";

/**
 * Renderização mínima e segura de markdown do chat (SEC-001, lote 02).
 *
 * Suporta apenas `**negrito**` e quebras de linha. O conteúdo vem do gateway
 * de IA (terceiro não confiável — V7 correção #14): tudo vira text node ou
 * <strong>, que o React escapa por construção. Nenhum HTML é avaliado, em
 * nenhuma hipótese — não existe caminho de `dangerouslySetInnerHTML`.
 */
export function renderChatMarkdown(text: string): ReactNode[] {
  const lineOccurrences = new Map<string, number>();
  return text.split("\n").map((line) => {
    const occurrence = lineOccurrences.get(line) ?? 0;
    lineOccurrences.set(line, occurrence + 1);
    return <div key={`${line}-${occurrence}`}>{renderLine(line)}</div>;
  });
}

function renderLine(line: string): ReactNode[] {
  const partOccurrences = new Map<string, number>();
  return parseChatMarkdownLine(line).map((part) => {
    const occurrence = partOccurrences.get(part.raw) ?? 0;
    partOccurrences.set(part.raw, occurrence + 1);
    const key = `${part.raw}-${occurrence}`;
    if (part.bold) {
      return <strong key={key}>{part.text}</strong>;
    }
    return <span key={key}>{part.text}</span>;
  });
}
