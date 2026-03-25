import type { ImagePurpose } from "@/types/api";
import type { PurposeTemplate } from "./types";

const TEMPLATES: Record<ImagePurpose, PurposeTemplate> = {
  "blog-hero": {
    defaultDimensions: { width: 1536, height: 1024 },
    prefix:
      "Professional editorial-style hero image for a blog article about",
    suffix:
      "Clean composition with clear visual hierarchy. Modern, polished feel suitable for a professional digital marketing blog. No text overlays.",
    focusAreas: [
      "conceptual visualization of the topic",
      "professional and authoritative mood",
      "brand colors prominent in composition",
    ],
  },
  "social-og": {
    defaultDimensions: { width: 1536, height: 1024 },
    prefix: "Eye-catching social media Open Graph image about",
    suffix:
      "Bold, attention-grabbing composition designed to stand out in social feeds. Strong visual concept. No text or logos.",
    focusAreas: [
      "immediate visual impact",
      "bold use of brand colors",
      "clear central concept",
    ],
  },
  "ad-creative": {
    defaultDimensions: { width: 1024, height: 1024 },
    prefix:
      "High-converting advertising creative visual for",
    suffix:
      "Conversion-focused design with strong visual hierarchy. Clean, professional, and action-oriented. No text overlays.",
    focusAreas: [
      "visual hierarchy guiding attention",
      "conversion-oriented mood",
      "brand-aligned aesthetic",
    ],
  },
  "case-study": {
    defaultDimensions: { width: 1536, height: 1024 },
    prefix:
      "Professional case study illustration depicting results and success for",
    suffix:
      "Data-driven visual feel with before/after or growth concepts. Professional and proof-oriented. No text or specific numbers in the image.",
    focusAreas: [
      "growth and improvement visualization",
      "data-visualization aesthetic",
      "professional and trustworthy mood",
    ],
  },
  icon: {
    defaultDimensions: { width: 1024, height: 1024 },
    prefix: "Minimalist symbolic icon representing",
    suffix:
      "Simple, clean, and modern. Single concept, flat or semi-flat style. Centered composition on a clean background.",
    focusAreas: [
      "symbolic representation",
      "primary brand color dominant",
      "minimal and recognizable",
    ],
  },
  infographic: {
    defaultDimensions: { width: 1024, height: 1536 },
    prefix:
      "Structured infographic-style visual background for content about",
    suffix:
      "Multi-section visual structure with clear flow. Uses brand color palette across sections. Abstract data-visualization feel. No text.",
    focusAreas: [
      "structured layout with visual sections",
      "multi-color from brand palette",
      "information hierarchy through visual weight",
    ],
  },
};

export function getTemplate(purpose: ImagePurpose): PurposeTemplate {
  return TEMPLATES[purpose];
}

export function getDefaultDimensions(
  purpose: ImagePurpose
): { width: number; height: number } {
  return { ...TEMPLATES[purpose].defaultDimensions };
}
