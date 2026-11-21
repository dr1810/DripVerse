/** Shared, client-safe result types for the Gemini 4 roles. */
export type GarmentAttributes = {
  category: string;
  primaryColor: string;
  colors: string[];
  pattern: string;
  style: string;
  details: string[];
  description: string;
};

export type Interpretation = {
  garment: GarmentAttributes;
  scene: { setting: string; mood: string; lighting: string };
  search: { query: string; category: string; color: string; style: string };
  confidence: number;
  ambiguities: string[];
  kidSummary: string;
  ideas: string[];
  model: string;
};

export type AspectScore = { score: number; notes: string };

export type Evaluation = {
  overallScore: number;
  verdict: "faithful" | "partial" | "mismatch";
  color: AspectScore;
  shape: AspectScore;
  pattern: AspectScore;
  details: AspectScore;
  mismatches: string[];
  feedback: string;
  model: string;
};
