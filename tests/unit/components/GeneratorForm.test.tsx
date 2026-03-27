// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GeneratorForm } from "@/components/GeneratorForm";

vi.mock("@/lib/client/storage", () => ({
  getApiKey: () => "test-key",
}));

vi.mock("@/components/BrandPicker", () => ({
  BrandPicker: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select data-testid="brand-picker" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Default brand</option>
    </select>
  ),
}));

vi.mock("@/components/BrandPreview", () => ({
  BrandPreview: ({ brand }: { brand: string }) => (
    <div data-testid="brand-preview">{brand}</div>
  ),
}));

describe("GeneratorForm", () => {
  const onSubmit = vi.fn();

  beforeEach(() => {
    onSubmit.mockClear();
  });

  it("renders without crashing", () => {
    render(<GeneratorForm onSubmit={onSubmit} isLoading={false} />);
    // At least one generate button should exist (allow for StrictMode double-render)
    expect(screen.getAllByRole("button", { name: /generate/i }).length).toBeGreaterThanOrEqual(1);
  });

  it("disables submit button while loading", () => {
    render(<GeneratorForm onSubmit={onSubmit} isLoading={true} />);
    const buttons = screen.getAllByRole("button", { name: /generating/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    buttons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it("shows topic input", () => {
    render(<GeneratorForm onSubmit={onSubmit} isLoading={false} />);
    expect(screen.getAllByPlaceholderText(/describe your image/i).length).toBeGreaterThanOrEqual(1);
  });

  it("does not submit when topic is empty", () => {
    render(<GeneratorForm onSubmit={onSubmit} isLoading={false} />);
    fireEvent.click(screen.getAllByRole("button", { name: /generate/i })[0]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with topic when form is submitted", () => {
    render(<GeneratorForm onSubmit={onSubmit} isLoading={false} />);
    fireEvent.change(screen.getAllByPlaceholderText(/describe your image/i)[0], {
      target: { value: "a mountain at sunset" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /generate/i })[0]);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "a mountain at sunset" }),
    );
  });
});
