import "server-only";
import { GenerationError, generateJson, imagePart, type InlineImage } from "@/lib/gemini";
import { modelFor } from "@/lib/models";
import type { AspectScore, Evaluation } from "./types";
import { arr, clamp, isObj, s } from "./coerce";

/** Model B (Gemini 4 Neon by default): visual consistency between the clothing reference and the generated scene. */

const aspect = {
  type: "object",
  properties: { score: { type: "number", description: "0-100" }, notes: { type: "string" } },
  required: ["score", "notes"],
};

const SCHEMA = {
  type: "object",
  properties: {
    overallScore: { type: "number", description: "0-100 overall garment fidelity" },
    verdict: { type: "string", enum: ["faithful", "partial", "mismatch"] },
    color: aspect,
    shape: aspect,
    pattern: aspect,
    details: aspect,
    mismatches: { type: "array", items: { type: "string" } },
    feedback: { type: "string", description: "One or two actionable sentences to improve fidelity on the next generation" },
  },
  required: ["overallScore", "verdict", "color", "shape", "pattern", "details", "mismatches", "feedback"],
};

const SYSTEM = `You are DripVerse's visual QA reviewer. Image 1 is the clothing REFERENCE (a real product photo or a drawing).
Image 2 is a GENERATED scene that should show that same garment.
Judge only the garment, not the background, person or artistic quality.
- color: are the main colors and shades preserved?
- shape: silhouette, cut, sleeve length, neckline, fit.
- pattern: prints, stripes, graphics, logo placement.
- details: pockets, buttons, trims, text, small design elements.
Score each 0-100 strictly; 90+ only when it is clearly the same garment. List concrete mismatches.
If the garment is not visible in image 2, score 0 and say so. For drawings, judge whether the key ideas (colors, shapes, motifs) carried over into the stylized result.
Do not comment on any person's appearance. Do not make claims about physical fit or sizing.`;

export async function evaluateConsistency(input: {
  reference: InlineImage;
  generated: InlineImage;
  expected?: string;
  kind: "product" | "drawing";
}): Promise<Evaluation> {
  const model = modelFor("evaluate");
  const raw = await generateJson({
    model,
    system: SYSTEM,
    schema: SCHEMA,
    parts: [
      { text: `Image 1 (reference ${input.kind === "product" ? "product photo" : "drawing"}):` },
      imagePart(input.reference),
      { text: "Image 2 (generated scene):" },
      imagePart(input.generated),
      { text: input.expected ? `Expected garment attributes: ${input.expected}` : "Evaluate the garment." },
    ],
  });
  return coerceEvaluation(raw, model);
}

function coerceAspect(v: unknown): AspectScore {
  return isObj(v) ? { score: Math.round(clamp(v.score, 0, 100, 0)), notes: s(v.notes, 200) } : { score: 0, notes: "" };
}

export function coerceEvaluation(raw: unknown, model: string): Evaluation {
  if (!isObj(raw)) throw new GenerationError("bad_output", "Evaluation was not an object.");
  const verdict = raw.verdict === "faithful" || raw.verdict === "partial" || raw.verdict === "mismatch" ? raw.verdict : "partial";
  return {
    overallScore: Math.round(clamp(raw.overallScore, 0, 100, 0)),
    verdict,
    color: coerceAspect(raw.color),
    shape: coerceAspect(raw.shape),
    pattern: coerceAspect(raw.pattern),
    details: coerceAspect(raw.details),
    mismatches: arr(raw.mismatches, 6, 200),
    feedback: s(raw.feedback, 400),
    model,
  };
}
