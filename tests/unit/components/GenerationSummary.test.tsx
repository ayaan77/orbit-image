// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GenerationSummary } from "@/components/GenerationSummary";

describe("GenerationSummary", () => {
  it("renders all configuration chips", () => {
    render(
      <GenerationSummary
        purpose="blog-hero"
        model="gpt-image-1"
        quality="hd"
        count={2}
        brand="apexure"
        style="photographic"
      />
    );
    expect(screen.getByText("Blog Hero")).toBeTruthy();
    expect(screen.getByText("GPT Image 1")).toBeTruthy();
    expect(screen.getByText("HD")).toBeTruthy();
    expect(screen.getByText("2 images")).toBeTruthy();
    expect(screen.getByText("apexure")).toBeTruthy();
    expect(screen.getByText("photographic")).toBeTruthy();
  });

  it("shows estimated cost", () => {
    render(
      <GenerationSummary
        purpose="icon"
        model="flux-schnell"
        quality="standard"
        count={1}
        brand=""
        style=""
      />
    );
    expect(screen.getByText("~$0.003")).toBeTruthy();
  });

  it("omits brand chip when empty", () => {
    render(
      <GenerationSummary
        purpose="blog-hero"
        model="gpt-image-1"
        quality="hd"
        count={1}
        brand=""
        style=""
      />
    );
    expect(screen.queryByText("apexure")).toBeNull();
  });

  it("shows singular 'image' for count=1", () => {
    render(
      <GenerationSummary
        purpose="blog-hero"
        model="gpt-image-1"
        quality="hd"
        count={1}
        brand=""
        style=""
      />
    );
    expect(screen.getByText("1 image")).toBeTruthy();
  });
});
