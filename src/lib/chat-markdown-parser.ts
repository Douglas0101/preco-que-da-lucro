/** The chat supports paired bold markers on one line; other markup is literal. */
export function parseChatMarkdownLine(line: string) {
  return line.split(/(\*\*.+?\*\*)/g).map((raw) => {
    const bold = raw.length > 4 && raw.startsWith("**") && raw.endsWith("**");
    return { raw, bold, text: bold ? raw.slice(2, -2) : raw };
  });
}

export function visibleChatMarkdownText(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      parseChatMarkdownLine(line)
        .map((part) => part.text)
        .join(""),
    )
    .join("\n");
}
