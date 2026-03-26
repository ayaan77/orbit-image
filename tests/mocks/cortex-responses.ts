import type {
  BrandColours,
  BrandVoice,
  CompanyData,
  BrandInfo,
  ProofData,
  Persona,
  Audience,
} from "@/lib/cortex/types";

export const mockColours: BrandColours = {
  primary: { hex: "#410099", name: "Deep Purple", usage: "Primary brand, headings, links, CTA borders" },
  secondary: { hex: "#8a1a9b", name: "Purple", usage: "Secondary purple, gradients, accents" },
  dark: { hex: "#231e46", name: "Dark Navy", usage: "Dark backgrounds, dark-mode boxes, text on light" },
  highlight: { hex: "#ffb600", name: "Gold / Amber", usage: "Highlights, warning boxes, star ratings" },
  danger: { hex: "#f5333f", name: "Red", usage: "Error states, danger warnings" },
  subtle: { hex: "#dcdae9", name: "Light Lavender", usage: "Subtle backgrounds, card borders" },
  accent: { hex: "#F46036", name: "Coral Orange", usage: "Accent CTAs, standout callouts" },
  success: { hex: "#04A777", name: "Teal Green", usage: "Success states, positive metrics" },
};

export const mockBrandVoice: BrandVoice = {
  brand_voice: {
    practitioner_phrases: [
      "In our experience building 3,000+ landing pages...",
      "Across projects for 300+ clients worldwide...",
    ],
    authority_signals: [
      "As a Clutch-recognised leader in conversion optimisation...",
    ],
  },
  brand_voice_rules: {
    tone_spectrum: "professional-casual",
    jargon_level: "practitioner",
    proof_style: "data-first",
    sentence_preference: "short-and-punchy",
    first_person: "we",
    forbidden_words: ["utilize", "leverage", "synergy"],
    style_notes: ["Lead with numbers and data"],
  },
};

export const mockCompany: CompanyData = {
  brand_config: {
    id: "apexure",
    name: "Apexure",
    domain: "www.apexure.com",
    site_url: "https://www.apexure.com",
  },
  brand_voice_rules: mockBrandVoice.brand_voice_rules,
  brand_colours: mockColours,
  stats: {
    years_in_business: "10+",
    projects_completed: "3,000+",
    clients_worldwide: "300+",
  },
  services: {
    primary: ["Landing Page Design & Development", "CRO"],
    landing_page_types: ["Lead Generation", "SaaS", "B2B"],
  },
  company: { name: "Apexure", domain: "www.apexure.com" },
};

export const mockBrands: BrandInfo[] = [
  { id: "apexure", files: 12, active: true },
  { id: "arb", files: 0, active: false },
];

export const mockProof: ProofData = {
  case_studies: [
    {
      client: "DOOR3",
      metric: "CPL reduced from $2,300 to $550",
      industry: "Technology Consulting",
    },
  ],
  stats: [
    {
      stat: "3,000+",
      context: "projects completed",
      use_when: "showing volume of work",
    },
  ],
};

export const mockPersonas: Persona[] = [
  {
    id: "cmo",
    name: "Marketing Director",
    role: "VP of Marketing at a mid-size B2B company",
    goals: ["increase lead quality", "reduce cost per acquisition"],
    pain_points: ["low conversion rates on landing pages"],
    objections: ["too expensive", "long implementation time"],
  },
  {
    id: "dev",
    name: "Developer",
    role: "Full-stack engineer",
    goals: ["fast integration", "clean API"],
    pain_points: ["poor documentation"],
  },
];

export const mockAudiences: Audience[] = [
  {
    id: "enterprise",
    name: "Enterprise B2B",
    icp: { company_size: "500+", industry: "Technology" },
    content_strategy: { tone: "professional", focus: "ROI" },
  },
  {
    id: "smb",
    name: "Small Business",
    icp: { company_size: "10-50" },
  },
];

/** Wraps a value in the MCP JSON-RPC response format */
export function wrapMcpResponse(data: unknown) {
  return {
    jsonrpc: "2.0",
    id: "test-1",
    result: {
      content: [{ type: "text", text: JSON.stringify(data) }],
    },
  };
}
