import type { BrandContext } from "@/lib/cortex/types";
import type { GenerateRequest } from "@/types/api";
import type { PromptBundle } from "./types";
import { buildColorPromptSection } from "./color-mapper";
import { getTemplate, getDefaultDimensions } from "./templates";

function deriveBrandPersonality(context: BrandContext): string {
  const rules = context.voice.brand_voice_rules;
  const parts: string[] = [];

  if (rules.tone_spectrum) {
    parts.push(`${rules.tone_spectrum} tone`);
  }
  if (rules.proof_style) {
    parts.push(`${rules.proof_style} aesthetic`);
  }

  const companyName = context.company.company?.name;
  if (companyName) {
    parts.push(`reflecting the brand identity of ${companyName}`);
  }

  return parts.length > 0
    ? `Visual style: ${parts.join(", ")}.`
    : "";
}

function buildStyleModifier(style?: string): string {
  if (!style) return "";

  const styleMap: Record<string, string> = {
    photographic: "Photorealistic photography style with natural lighting and depth of field.",
    illustration: "Modern digital illustration style with clean lines and stylized forms.",
    "3d-render": "3D rendered style with volumetric lighting and realistic materials.",
    "flat-design": "Flat design style with bold shapes, clean edges, and minimal gradients.",
    abstract: "Abstract art style with geometric forms, flowing shapes, and artistic composition.",
    minimalist: "Ultra-minimalist style with maximum whitespace, single focal point, and restrained palette.",
  };

  return styleMap[style] ?? "";
}

function buildProofContext(context: BrandContext): string {
  if (!context.proof) return "";

  const parts: string[] = [];

  if (context.proof.case_studies?.length) {
    const cs = context.proof.case_studies[0];
    if (cs.metric) {
      parts.push(`Reflecting proven results like ${cs.metric}`);
    }
  }

  if (context.proof.stats?.length) {
    const stat = context.proof.stats[0];
    if (stat.stat && stat.context) {
      parts.push(`drawing on ${stat.stat} of ${stat.context}`);
    }
  }

  return parts.length > 0
    ? `Context: ${parts.join(", ")}. Convey authority and proven expertise visually.`
    : "";
}

function buildNegativePrompt(): string {
  return [
    "No text, watermarks, or logos",
    "No generic stock photo feel",
    "No clipart or cartoon style unless explicitly requested",
    "No overly corporate or stiff compositions",
    "No blurry or low-quality elements",
    "No hands holding devices unless relevant",
  ].join(". ");
}

export function assemblePrompt(
  request: GenerateRequest,
  context: BrandContext
): PromptBundle {
  const template = getTemplate(request.purpose);
  const colorSection = buildColorPromptSection(context.colours);
  const personality = deriveBrandPersonality(context);
  const styleModifier = buildStyleModifier(request.style);
  const proofContext = buildProofContext(context);

  const focusSection = template.focusAreas
    .map((area) => `- ${area}`)
    .join("\n");

  const promptParts = [
    `${template.prefix} "${request.topic}".`,
    "",
    colorSection,
    personality,
    styleModifier,
    "",
    `Focus areas:\n${focusSection}`,
    "",
    proofContext,
    template.suffix,
  ].filter(Boolean);

  const dimensions = request.dimensions
    ? { width: request.dimensions.width, height: request.dimensions.height }
    : getDefaultDimensions(request.purpose);

  return {
    positive: promptParts.join("\n").trim(),
    negative: buildNegativePrompt(),
    dimensions,
    quality: request.quality ?? "hd",
    count: request.count ?? 1,
  };
}
