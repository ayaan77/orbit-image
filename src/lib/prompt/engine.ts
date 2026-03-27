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

function buildPersonaContext(
  context: BrandContext,
  request: GenerateRequest,
): string {
  if (!context.personas?.length || !request.persona) return "";

  const match = context.personas.find(
    (p) =>
      p.name.toLowerCase() === request.persona!.toLowerCase() ||
      p.id === request.persona,
  );
  if (!match) return "";

  const parts: string[] = [`Targeting persona: ${match.name}`];
  if (match.role) parts.push(`(${match.role})`);
  if (match.goals?.length) {
    parts.push(`who values ${match.goals.slice(0, 2).join(" and ")}`);
  }
  if (match.pain_points?.length) {
    parts.push(`and struggles with ${match.pain_points[0]}`);
  }

  return (
    parts.join(" ") +
    ". Tailor the visual mood and subject matter accordingly."
  );
}

function buildAudienceContext(
  context: BrandContext,
  request: GenerateRequest,
): string {
  if (!context.audiences?.length || !request.audience) return "";

  const match = context.audiences.find(
    (a) =>
      a.name.toLowerCase() === request.audience!.toLowerCase() ||
      a.id === request.audience,
  );
  if (!match) return "";

  return `Target audience: ${match.name}. Ensure the visual resonates with this segment's expectations and preferences.`;
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
  context: BrandContext | null
): PromptBundle {
  const template = getTemplate(request.purpose);
  const colorSection = context ? buildColorPromptSection(context.colours) : "";
  const personality = context ? deriveBrandPersonality(context) : "Visual style: professional, polished, modern.";
  const styleModifier = buildStyleModifier(request.style);
  const personaContext = context ? buildPersonaContext(context, request) : "";
  const audienceContext = context ? buildAudienceContext(context, request) : "";
  const proofContext = context ? buildProofContext(context) : "";

  const focusSection = template.focusAreas
    .map((area) => `- ${area}`)
    .join("\n");

  const promptParts = [
    `${template.prefix} "${request.topic}".`,
    "",
    colorSection,
    personality,
    styleModifier,
    personaContext,
    audienceContext,
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
