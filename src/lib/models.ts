/**
 * Model roles, verified against Google's model list (ai.google.dev/gemini-api/docs/models).
 * Client-safe: identifiers only, no secrets. Each id can be overridden server-side by env var;
 * the UI shows these defaults to explain who does what.
 */
export const MODEL_ROLES = {
  interpret: {
    id: "gemini-4-hydrogen",
    name: "Gemini 4 Hydrogen",
    env: "GEMINI_INTERPRET_MODEL",
    job: "Reads your garment photo, sketch and scene, and turns them into structured attributes and a Shopify search query.",
    why: "Fast and multimodal, so search starts within seconds.",
  },
  evaluate: {
    id: "gemini-4-neon",
    name: "Gemini 4 Neon",
    env: "GEMINI_EVALUATE_MODEL",
    job: "Compares the generated scene with the real product image and scores how well color, shape, pattern and details survived.",
    why: "Stronger reasoning for careful side-by-side visual judgment.",
  },
  image: {
    id: "gemini-3.1-flash-image",
    name: "Nano Banana 2",
    env: "GEMINI_IMAGE_MODEL",
    job: "Generates the scene, using the selected product's own photo as the clothing reference.",
    why: "Image generation and editing with reference images.",
  },
} as const;

export type ModelRole = keyof typeof MODEL_ROLES;

export function modelFor(role: ModelRole): string {
  const r = MODEL_ROLES[role];
  return (typeof process !== "undefined" && process.env?.[r.env]) || r.id;
}
