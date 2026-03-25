export interface PromptBundle {
  readonly positive: string;
  readonly negative: string;
  readonly dimensions: { readonly width: number; readonly height: number };
  readonly quality: "standard" | "hd";
  readonly count: number;
}

export interface PurposeTemplate {
  readonly defaultDimensions: { readonly width: number; readonly height: number };
  readonly prefix: string;
  readonly suffix: string;
  readonly focusAreas: readonly string[];
}
