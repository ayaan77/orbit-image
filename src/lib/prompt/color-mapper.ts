import type { BrandColour, BrandColours } from "@/lib/cortex/types";

interface ColorDirective {
  readonly role: string;
  readonly description: string;
}

const ROLE_MAP: Record<string, string> = {
  primary: "dominant accent and key focal elements",
  secondary: "supporting accents and gradient transitions",
  dark: "backgrounds, shadows, and depth",
  highlight: "call-to-action emphasis and attention points",
  danger: "urgency indicators and warning elements",
  subtle: "soft backgrounds, borders, and divider areas",
  accent: "secondary focal points and warm visual elements",
  success: "positive indicators and growth elements",
};

function mapSingleColor(
  role: string,
  colour: BrandColour
): ColorDirective {
  const roleDescription = ROLE_MAP[role] ?? "visual accent";
  return {
    role,
    description: `${colour.name.toLowerCase()} (${colour.hex}) for ${roleDescription}`,
  };
}

export function mapColorsToDirectives(colours: BrandColours): readonly ColorDirective[] {
  return Object.entries(colours).map(([role, colour]) =>
    mapSingleColor(role, colour as BrandColour)
  );
}

export function buildColorPromptSection(colours: BrandColours): string {
  const directives = mapColorsToDirectives(colours);

  const primary = directives.find((d) => d.role === "primary");
  const secondary = directives.find((d) => d.role === "secondary");
  const dark = directives.find((d) => d.role === "dark");
  const highlight = directives.find((d) => d.role === "highlight");
  const accent = directives.find((d) => d.role === "accent");

  const parts = [
    `Color palette: Use ${primary?.description}`,
    secondary ? `with ${secondary.description}` : "",
    dark ? `against ${dark.description}` : "",
    highlight ? `and ${highlight.description}` : "",
    accent ? `plus ${accent.description}` : "",
  ].filter(Boolean);

  return parts.join(", ") + ".";
}

export function getColorHexList(colours: BrandColours): readonly string[] {
  return Object.values(colours).map(
    (c) => (c as BrandColour).hex
  );
}
