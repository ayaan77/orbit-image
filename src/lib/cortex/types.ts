/** Cortex MCP response types — derived from actual API responses */

export interface BrandColour {
  readonly hex: string;
  readonly name: string;
  readonly usage: string;
}

export interface BrandColours {
  readonly primary: BrandColour;
  readonly secondary: BrandColour;
  readonly dark: BrandColour;
  readonly highlight: BrandColour;
  readonly danger: BrandColour;
  readonly subtle: BrandColour;
  readonly accent: BrandColour;
  readonly success: BrandColour;
}

export interface BrandVoiceRules {
  readonly tone_spectrum: string;
  readonly jargon_level: string;
  readonly proof_style: string;
  readonly sentence_preference: string;
  readonly first_person: string;
  readonly forbidden_words: readonly string[];
  readonly style_notes: readonly string[];
}

export interface BrandVoice {
  readonly brand_voice: {
    readonly practitioner_phrases: readonly string[];
    readonly authority_signals: readonly string[];
  };
  readonly brand_voice_rules: BrandVoiceRules;
}

export interface BrandConfig {
  readonly id: string;
  readonly name: string;
  readonly domain: string;
  readonly site_url: string;
}

export interface CompanyData {
  readonly brand_config: BrandConfig;
  readonly brand_voice_rules: BrandVoiceRules;
  readonly brand_colours: BrandColours;
  readonly stats: Record<string, string>;
  readonly services: {
    readonly primary: readonly string[];
    readonly landing_page_types: readonly string[];
  };
  readonly company: {
    readonly name: string;
    readonly domain: string;
  };
}

export interface ProofItem {
  readonly stat?: string;
  readonly context?: string;
  readonly use_when?: string;
  readonly client?: string;
  readonly metric?: string;
  readonly title?: string;
  readonly industry?: string;
}

export interface ProofData {
  readonly case_studies?: readonly ProofItem[];
  readonly reviews?: readonly ProofItem[];
  readonly portfolio?: readonly ProofItem[];
  readonly stats?: readonly ProofItem[];
  readonly voice?: readonly string[];
}

export interface Persona {
  readonly id: string;
  readonly name: string;
  readonly role?: string;
  readonly goals?: readonly string[];
  readonly pain_points?: readonly string[];
  readonly objections?: readonly string[];
}

export interface Audience {
  readonly id: string;
  readonly name: string;
  readonly icp?: Record<string, unknown>;
  readonly content_strategy?: Record<string, unknown>;
}

export interface BrandInfo {
  readonly id: string;
  readonly files: number;
  readonly active: boolean;
}

/** Aggregated brand context used by the prompt engine */
export interface BrandContext {
  readonly colours: BrandColours;
  readonly voice: BrandVoice;
  readonly company: CompanyData;
  readonly personas?: readonly Persona[];
  readonly proof?: ProofData;
}
