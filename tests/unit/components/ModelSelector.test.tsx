// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModelSelector } from "@/components/ModelSelector";
import type { ProviderStatus } from "@/lib/client/useProviderStatus";

const allConfigured: ProviderStatus = {
  providers: {
    openai: { configured: true },
    replicate: { configured: true },
    xai: { configured: true },
  },
  defaultModel: "gpt-image-1",
  availableModels: ["gpt-image-1", "dall-e-3", "flux-pro", "flux-dev", "flux-schnell", "grok-aurora"],
};

const onlyOpenai: ProviderStatus = {
  providers: {
    openai: { configured: true },
    replicate: { configured: false },
    xai: { configured: false },
  },
  defaultModel: "gpt-image-1",
  availableModels: ["gpt-image-1", "dall-e-3"],
};

describe("ModelSelector", () => {
  it("renders all 6 model cards", () => {
    render(
      <ModelSelector
        value="gpt-image-1"
        onChange={() => {}}
        purpose="blog-hero"
        quality="hd"
        providerStatus={allConfigured}
      />
    );
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(6);
  });

  it("marks selected model as checked", () => {
    render(
      <ModelSelector
        value="dall-e-3"
        onChange={() => {}}
        purpose="blog-hero"
        quality="hd"
        providerStatus={allConfigured}
      />
    );
    const selected = screen.getByRole("radio", { name: /dall-e 3/i });
    expect(selected).toHaveAttribute("aria-checked", "true");
  });

  it("disables unconfigured provider models", () => {
    render(
      <ModelSelector
        value="gpt-image-1"
        onChange={() => {}}
        purpose="blog-hero"
        quality="hd"
        providerStatus={onlyOpenai}
      />
    );
    const fluxPro = screen.getByRole("radio", { name: /flux 1\.1 pro/i });
    expect(fluxPro).toBeDisabled();
  });

  it("calls onChange when clicking a configured model", () => {
    const onChange = vi.fn();
    render(
      <ModelSelector
        value="gpt-image-1"
        onChange={onChange}
        purpose="blog-hero"
        quality="hd"
        providerStatus={allConfigured}
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: /dall-e 3/i }));
    expect(onChange).toHaveBeenCalledWith("dall-e-3");
  });

  it("does not call onChange when clicking a locked model", () => {
    const onChange = vi.fn();
    render(
      <ModelSelector
        value="gpt-image-1"
        onChange={onChange}
        purpose="blog-hero"
        quality="hd"
        providerStatus={onlyOpenai}
      />
    );
    fireEvent.click(screen.getByRole("radio", { name: /flux 1\.1 pro/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows cost summary line", () => {
    render(
      <ModelSelector
        value="gpt-image-1"
        onChange={() => {}}
        purpose="blog-hero"
        quality="hd"
        providerStatus={allConfigured}
      />
    );
    expect(screen.getByText(/\$0\.042\/image/)).toBeTruthy();
  });

  it("shows 'Recommended' badge for the smart-default model", () => {
    render(
      <ModelSelector
        value="gpt-image-1"
        onChange={() => {}}
        purpose="icon"
        quality="hd"
        providerStatus={allConfigured}
      />
    );
    expect(screen.getByText("Recommended")).toBeTruthy();
  });
});
