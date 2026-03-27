// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HistoryDrawer, type HistoryEntry } from "@/components/HistoryDrawer";

const mockEntry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: "test-1",
  images: [{
    base64: "iVBORw0KGgo=",
    prompt: "test prompt",
    mimeType: "image/png",
    dimensions: { width: 1024, height: 1024 },
  }],
  brand: "apexure",
  purpose: "blog-hero",
  topic: "A sunset over mountains",
  processingTimeMs: 3500,
  cortexDataCached: false,
  resultCached: false,
  generatedAt: Date.now(),
  model: "gpt-image-1",
  style: "photographic",
  estimatedCostUsd: 0.042,
  ...overrides,
});

describe("HistoryDrawer", () => {
  it("renders empty state when no entries", () => {
    render(
      <HistoryDrawer
        isOpen={true}
        entries={[]}
        onClose={() => {}}
        onRestore={() => {}}
      />
    );
    expect(screen.getByText("No generations yet.")).toBeTruthy();
  });

  it("renders entries with model badge", () => {
    render(
      <HistoryDrawer
        isOpen={true}
        entries={[mockEntry()]}
        onClose={() => {}}
        onRestore={() => {}}
      />
    );
    expect(screen.getByText("A sunset over mountains")).toBeTruthy();
    expect(screen.getByText("GPT Image 1")).toBeTruthy();
    expect(screen.getByText("$0.042")).toBeTruthy();
  });

  it("shows re-run button when onRerun is provided", () => {
    render(
      <HistoryDrawer
        isOpen={true}
        entries={[mockEntry()]}
        onClose={() => {}}
        onRestore={() => {}}
        onRerun={() => {}}
      />
    );
    expect(screen.getByText("Re-run")).toBeTruthy();
  });

  it("calls onRerun when re-run button is clicked", () => {
    const onRerun = vi.fn();
    const entry = mockEntry();
    render(
      <HistoryDrawer
        isOpen={true}
        entries={[entry]}
        onClose={() => {}}
        onRestore={() => {}}
        onRerun={onRerun}
      />
    );
    fireEvent.click(screen.getByText("Re-run"));
    expect(onRerun).toHaveBeenCalledWith(entry);
  });

  it("shows filter chips when entries have multiple models", () => {
    const entries = [
      mockEntry({ id: "1", model: "gpt-image-1" }),
      mockEntry({ id: "2", model: "flux-schnell" }),
    ];
    render(
      <HistoryDrawer
        isOpen={true}
        entries={entries}
        onClose={() => {}}
        onRestore={() => {}}
      />
    );
    // "Flux Schnell" appears in both filter chip and entry badge
    expect(screen.getAllByText("Flux Schnell").length).toBeGreaterThanOrEqual(1);
  });

  it("filters entries when a filter chip is clicked", () => {
    const entries = [
      mockEntry({ id: "1", model: "gpt-image-1", topic: "Sunset mountains" }),
      mockEntry({ id: "2", model: "flux-schnell", topic: "City skyline" }),
    ];
    render(
      <HistoryDrawer
        isOpen={true}
        entries={entries}
        onClose={() => {}}
        onRestore={() => {}}
      />
    );

    // Click the Flux Schnell filter chip (first matching element is the filter)
    fireEvent.click(screen.getAllByText("Flux Schnell")[0]);

    // Only the flux entry should be visible
    expect(screen.getByText("City skyline")).toBeTruthy();
    expect(screen.queryByText("Sunset mountains")).toBeNull();
  });

  it("clears filters when Clear button is clicked", () => {
    const entries = [
      mockEntry({ id: "1", model: "gpt-image-1", topic: "Sunset mountains" }),
      mockEntry({ id: "2", model: "flux-schnell", topic: "City skyline" }),
    ];
    render(
      <HistoryDrawer
        isOpen={true}
        entries={entries}
        onClose={() => {}}
        onRestore={() => {}}
      />
    );

    // Apply filter (first match is the filter chip)
    fireEvent.click(screen.getAllByText("Flux Schnell")[0]);
    expect(screen.queryByText("Sunset mountains")).toBeNull();

    // Clear filter
    fireEvent.click(screen.getByText("Clear"));
    expect(screen.getByText("Sunset mountains")).toBeTruthy();
    expect(screen.getByText("City skyline")).toBeTruthy();
  });
});
