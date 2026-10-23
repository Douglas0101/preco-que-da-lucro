import axe from "axe-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";

async function expectNoAxeViolations(container: HTMLElement) {
  const result = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(result.violations).toEqual([]);
}

describe("chat UI primitives", () => {
  it("aligns the person and the consultant turns with semantic content", async () => {
    const { container } = render(
      <>
        <Message align="end">
          <MessageAvatar>V</MessageAvatar>
          <MessageContent>
            <MessageHeader>Você</MessageHeader>
            <Bubble align="end" variant="default">
              <BubbleContent>Quanto custa meu produto?</BubbleContent>
            </Bubble>
          </MessageContent>
        </Message>

        <Message align="start">
          <MessageAvatar>IA</MessageAvatar>
          <MessageContent>
            <MessageHeader>Consultor</MessageHeader>
            <Bubble align="start" variant="tinted">
              <BubbleContent>Vamos calcular juntos.</BubbleContent>
            </Bubble>
            <MessageFooter>Copiar</MessageFooter>
          </MessageContent>
        </Message>
      </>,
    );

    const turns = container.querySelectorAll('[data-slot="message"]');
    expect(turns).toHaveLength(2);
    expect(turns[0]).toHaveAttribute("data-align", "end");
    expect(turns[1]).toHaveAttribute("data-align", "start");
    expect(screen.getByText("Quanto custa meu produto?")).toBeInTheDocument();
    expect(screen.getByText("Vamos calcular juntos.")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="bubble"][data-variant="tinted"]')).not.toBeNull();
    await expectNoAxeViolations(container);
  });

  it("composes the prompt input with a named send action", async () => {
    const { container } = render(
      <form>
        <InputGroup>
          <InputGroupTextarea aria-label="Mensagem para o consultor" />
          <InputGroupAddon align="block-end">
            <InputGroupText>Enter envia</InputGroupText>
            <InputGroupButton type="submit" aria-label="Enviar">
              Enviar
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>,
    );

    expect(screen.getByRole("textbox", { name: "Mensagem para o consultor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar" })).toHaveAttribute("type", "submit");
    expect(container.querySelector('[data-slot="input-group"]')).not.toBeNull();
    await expectNoAxeViolations(container);
  });

  it("renders the thread inside the labelled scroller with its anchor", () => {
    const { container } = render(
      <MessageScrollerProvider autoScroll>
        <MessageScroller>
          <MessageScrollerViewport aria-label="Histórico da conversa">
            <MessageScrollerContent role="log">
              <MessageScrollerItem messageId="turn-1" scrollAnchor>
                <Message align="end">
                  <MessageContent>
                    <Bubble align="end">
                      <BubbleContent>Primeira pergunta</BubbleContent>
                    </Bubble>
                  </MessageContent>
                </Message>
              </MessageScrollerItem>
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      </MessageScrollerProvider>,
    );

    expect(screen.getByRole("log")).toHaveTextContent("Primeira pergunta");
    expect(container.querySelector('[data-slot="message-scroller"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="message-scroller-item"]')).not.toBeNull();
  });
});
