// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TypingIndicator } from "@/components/chat/TypingIndicator";

describe("TypingIndicator", () => {
  it("renders null when typingUsers is empty", () => {
    const { container } = render(<TypingIndicator typingUsers={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "<name> is typing…" for a single user', () => {
    render(<TypingIndicator typingUsers={["Ahmed"]} />);
    expect(screen.getByTestId("typing-indicator")).toBeInTheDocument();
    expect(screen.getByText("Ahmed is typing…")).toBeInTheDocument();
  });

  it('shows "<name1> and <name2> are typing…" for two users', () => {
    render(<TypingIndicator typingUsers={["Ahmed", "Sara"]} />);
    expect(screen.getByText("Ahmed and Sara are typing…")).toBeInTheDocument();
  });

  it('shows "Several people are typing…" for three or more users', () => {
    render(<TypingIndicator typingUsers={["Ahmed", "Sara", "Luis"]} />);
    expect(screen.getByText("Several people are typing…")).toBeInTheDocument();
  });

  it('shows "Several people are typing…" for exactly four users', () => {
    render(<TypingIndicator typingUsers={["A", "B", "C", "D"]} />);
    expect(screen.getByText("Several people are typing…")).toBeInTheDocument();
  });
});
