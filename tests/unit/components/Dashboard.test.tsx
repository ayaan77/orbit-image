// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Dashboard } from "@/components/Dashboard";

vi.mock("@/lib/client/storage", () => ({
  getApiKey: () => "",
}));

describe("Dashboard", () => {
  it("renders without crashing", () => {
    render(<Dashboard />);
    expect(screen.getAllByText("Dashboard").length).toBeGreaterThanOrEqual(1);
  });

  it("renders all navigation tab labels", () => {
    render(<Dashboard />);
    // Use getAllByText to handle React 19 StrictMode double-render
    expect(screen.getAllByText("Overview").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Apps").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Playground").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Usage").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Quick Start").length).toBeGreaterThanOrEqual(1);
  });

  it("shows Overview content by default", () => {
    render(<Dashboard />);
    expect(screen.getAllByText("Overview").length).toBeGreaterThanOrEqual(1);
  });
});
