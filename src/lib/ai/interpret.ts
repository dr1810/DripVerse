import "server-only";
import type { Part } from "@google/genai";
import { GenerationError, generateJson, imagePart, type InlineImage } from "@/lib/gemini";
import { modelFor } from "@/lib/models";
import type { Interpretation } from "./types";
import { arr, clamp, isObj, s } from "./coerce";

/** Model A (Gemini 4 Hydrogen by default): multimodal interpretation → structured attributes + search query. */

const SCHEMA = {
  type: "object",
  properties: {
    garment: {
      type: "object",
      properties: {
        category: { type: "string", description: "Garment type, e.g. t-shirt, hoodie, dress, jacket" },
        primaryColor: { type: "string" },
        colors: { type: "array", items: { type: "string" } },
        pattern: { type: "string", description: "solid, striped, graphic print, floral, plaid, etc." },
        style: { type: "string", description: "e.g. streetwear, minimalist, vintage, sporty" },
        details: { type: "array", items: { type: "string" }, description: "Visible details: pocket, logo placement, neckline, sleeve length" },
        description: { type: "string", description: "One sentence describing the garment" },
      },
      required: ["category", "primaryColor", "colors", "pattern", "style", "details", "description"],
    },
    scene: {
      type: "object",
      properties: { setting: { type: "string" }, mood: { type: "string" }, lighting: { type: "string" } },
      required: ["setting", "mood", "lighting"],
    },
    search: {
      type: "object",
      properties: {
        query: { type: "string", description: "3-7 words a shopper would type to find this garment" },
        category: { type: "string" },
        color: { type: "string" },
        style: { type: "string" },
      },
      required: ["query", "category", "color", "style"],
    },
    confidence: { type: "number", description: "0 to 1: how clearly the input shows a garment" },
    ambiguities: { type: "array", items: { type: "string" } },
    kidSummary: { type: "string" },
    ideas: { type: "array", items: { type: "string" } },
  },
  required: ["garment", "scene", "search", "confidence", "ambiguities", "kidSummary", "ideas"],
};

const FASHION_SYSTEM = `You are DripVerse's fashion analyst. Describe only the garment that is visible or described.
- Report colors in plain names a shopper uses (e.g. "burnt orange", "navy").
- Never guess brands or invent details you cannot see.
- Do not describe any person, face or body; focus on the clothing only.
- search.query: 3-7 shopper words for this garment (color + pattern/detail + category), no brand names.
- If the input is unclear (messy sketch, no garment, several garments), lower confidence and list what is ambiguous.
- Set kidSummary to "" and ideas to [].`;

const KID_SYSTEM = `You are DripVerse's friendly creative helper for kids. The input is a child's drawing and/or idea of an imaginary outfit.
- Describe the outfit's colors, shapes and patterns faithfully, even if messy; do not "correct" the child's design.
- kidSummary: one cheerful, simple sentence (max 25 words) saying what you see, e.g. "I see a purple cape with yellow stars!"
- ideas: exactly 3 short, playful, age-appropriate suggestions to add to the world or outfit.
- Keep everything fictional. Never ask for or mention names, ages, schools, locations or photos.
- search.query should still summarize the outfit in 3-7 words. If unclear, lower confidence and list ambiguities.`;

export async function interpret(input: {
  mode: "fashion" | "imagination";
  image?: InlineImage;
  description?: string;
  scene?: string;
}): Promise<Interpretation> {
  const model = modelFor("interpret");
  const parts: Part[] = [];
  if (input.image) parts.push(imagePart(input.image));
  parts.push({
    text: [
      input.image ? (input.mode === "fashion" ? "Image: the garment (photo or sketch)." : "Image: the child's drawing.") : "No image provided.",
      input.description ? `Description: ${input.description}` : "",
      input.scene ? `Requested scene: ${input.scene}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });
  const raw = await generateJson({ model, system: input.mode === "fashion" ? FASHION_SYSTEM : KID_SYSTEM, parts, schema: SCHEMA });
  return coerceInterpretation(raw, model);
}

export function coerceInterpretation(raw: unknown, model: string): Interpretation {
  if (!isObj(raw) || !isObj(raw.garment) || !isObj(raw.search)) throw new GenerationError("bad_output", "Interpretation was missing required fields.");
  const g = raw.garment;
  const sc = isObj(raw.scene) ? raw.scene : {};
  const se = raw.search;
  const out: Interpretation = {
    garment: {
      category: s(g.category, 60),
      primaryColor: s(g.primaryColor, 40),
      colors: arr(g.colors, 6, 40),
      pattern: s(g.pattern, 60),
      style: s(g.style, 60),
      details: arr(g.details, 6, 80),
      description: s(g.description, 240),
    },
    scene: { setting: s(sc.setting, 160), mood: s(sc.mood, 80), lighting: s(sc.lighting, 80) },
    search: { query: s(se.query, 80), category: s(se.category, 60), color: s(se.color, 40), style: s(se.style, 60) },
    confidence: clamp(raw.confidence, 0, 1, 0),
    ambiguities: arr(raw.ambiguities, 5, 160),
    kidSummary: s(raw.kidSummary, 200),
    ideas: arr(raw.ideas, 3, 120),
    model,
  };
  if (!out.search.query) out.search.query = [out.garment.primaryColor, out.garment.pattern !== "solid" ? out.garment.pattern : "", out.garment.category].filter(Boolean).join(" ");
  if (!out.search.query) throw new GenerationError("bad_output", "Interpretation produced no search query.");
  return out;
}
