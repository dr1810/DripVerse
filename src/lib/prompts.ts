import type { GarmentAttributes } from "@/lib/ai/types";

export type Scene = { id: string; label: string; description: string };

export const FASHION_SCENES: Scene[] = [
  { id: "tokyo", label: "Tokyo at night", description: "a Tokyo street at night, glowing signs, light rain and reflections on the pavement" },
  { id: "nyc", label: "New York rooftop", description: "a New York City rooftop at golden hour with the skyline behind" },
  { id: "mars", label: "Mars colony", description: "a futuristic Mars colony at dusk, red dunes, domes and a pale blue sunset" },
  { id: "castle", label: "Fantasy castle", description: "the courtyard of a fantasy castle with banners, stone arches and soft morning mist" },
];

export const KID_WORLDS: Scene[] = [
  { id: "candy", label: "Candy cloud kingdom", description: "a candy cloud kingdom with lollipop trees and gumdrop hills" },
  { id: "ocean", label: "Underwater castle", description: "a glowing underwater castle with friendly fish and coral towers" },
  { id: "dino", label: "Dinosaur jungle", description: "a sunny jungle with gentle, smiling dinosaurs and giant ferns" },
  { id: "space", label: "Space carnival", description: "a carnival floating in space with planet balloons and star rides" },
];

export const IMAGINATION_STARTERS: string[] = [
  "A cape made of rainbows with lightning bolt buttons",
  "Dragon-scale boots and a crown of flowers",
  "A star-covered space suit with jelly bean pockets",
];

export const IMAGINATION_STYLES = [
  { id: "storybook", label: "Storybook", description: "a warm, whimsical children's storybook illustration with soft gouache textures" },
  { id: "cartoon", label: "3D cartoon", description: "a friendly, colorful 3D animated cartoon style" },
  { id: "papercraft", label: "Paper cut-out", description: "a layered paper cut-out illustration with soft shadows" },
] as const;

export type ImaginationStyleId = (typeof IMAGINATION_STYLES)[number]["id"];

function attributeLines(a?: Partial<GarmentAttributes>): string {
  if (!a) return "";
  return [
    a.primaryColor || a.colors?.length ? `- colors: ${[a.primaryColor, ...(a.colors ?? [])].filter(Boolean).join(", ")}` : "",
    a.category ? `- garment: ${a.category}` : "",
    a.pattern ? `- pattern: ${a.pattern}` : "",
    a.details?.length ? `- details to keep: ${a.details.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Structured workflow prompt: product photo is the reference, attributes come from Model A. */
export function buildFashionScenePrompt(opts: {
  scene: string;
  productTitle?: string;
  attributes?: Partial<GarmentAttributes>;
  hasSelfie: boolean;
  notes?: string;
  feedback?: string;
}): string {
  return [
    "Create a photorealistic, magazine-quality editorial fashion photograph.",
    `The FIRST attached image is the real product${opts.productTitle ? ` ("${opts.productTitle}")` : ""}. Dress the subject in exactly this garment.`,
    "Reproduce the garment faithfully: same color and shade, same silhouette and cut, same pattern, graphics and logo placement, same pockets, neckline and trims. Do not redesign or recolor it.",
    attributeLines(opts.attributes) ? `Verified garment attributes:\n${attributeLines(opts.attributes)}` : "",
    opts.hasSelfie
      ? "The SECOND attached image shows the person to feature. Keep their general look while placing them naturally in the scene; do not exaggerate or alter body shape."
      : "Style it on a fictional adult model (not a real or famous person).",
    `Scene: ${opts.scene}.`,
    opts.notes ? `Creative direction: ${opts.notes}.` : "",
    opts.feedback ? `Fix from the last review: ${opts.feedback}` : "",
    "The garment must be clearly visible and in focus. No added text, captions or watermarks.",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Baseline for evaluation: a single direct call with no interpretation or verified attributes. */
export function buildBaselinePrompt(scene: string): string {
  return `Put this clothing item in ${scene}. Make it look like a fashion photo.`;
}

export function buildCharacterPrompt(opts: { world: string; style: string; description?: string; summary?: string; hasDrawing: boolean }): string {
  return [
    `Create ${opts.style}.`,
    "Show one friendly, stylized fictional cartoon character (not a real person, not photorealistic) wearing the imagined outfit, exploring a playful world.",
    opts.hasDrawing
      ? "The attached image is a child's drawing of the outfit. Keep its colors, shapes and motifs recognizable, even if they are unusual; do not 'correct' the design."
      : "",
    opts.summary ? `What the outfit looks like: ${opts.summary}` : "",
    opts.description ? `The child's idea: ${opts.description}` : "",
    `World: ${opts.world}.`,
    "Bright, gentle and suitable for all ages. No text, no real brands, no real people.",
  ]
    .filter(Boolean)
    .join("\n");
}
