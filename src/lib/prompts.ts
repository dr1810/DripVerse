export type Scene = { id: string; label: string; description: string };

export const FASHION_SCENES: Scene[] = [
  { id: "rooftop", label: "Golden-hour rooftop", description: "a city rooftop at golden hour with warm low sun and a soft skyline bokeh" },
  { id: "studio", label: "Minimal studio", description: "a clean seamless paper studio with soft diffused key light and a subtle shadow" },
  { id: "street", label: "Neon street", description: "a rain-slick night street with neon signs reflecting on the pavement" },
  { id: "beach", label: "Desert dunes", description: "rolling sand dunes under a clear sky with crisp midday light" },
];

export const IMAGINATION_STARTERS: string[] = [
  "A cat astronaut planting flowers on the moon",
  "A dragon who runs a tiny bakery",
  "A treehouse city where the birds are the bus drivers",
  "A robot and a snail racing through a mushroom forest",
];

export const IMAGINATION_STYLES = [
  { id: "storybook", label: "Storybook", description: "a warm, whimsical children's storybook illustration with soft gouache textures and gentle colors" },
  { id: "watercolor", label: "Watercolor", description: "a loose, dreamy watercolor illustration with visible paper texture" },
  { id: "papercraft", label: "Paper cut-out", description: "a layered paper cut-out illustration with soft shadows between layers" },
] as const;

export type ImaginationStyleId = (typeof IMAGINATION_STYLES)[number]["id"];

export function buildFashionPrompt(opts: { scene: string; notes?: string }): string {
  const notes = opts.notes?.trim();
  return [
    "Create a photorealistic, magazine-quality editorial fashion photograph.",
    "The attached image shows the hero garment. Reproduce that exact garment faithfully:",
    "- keep its exact color and shade,",
    "- keep its silhouette, cut, fit and length,",
    "- keep every visible detail (graphics, prints, pockets, seams, stitching, neckline, hems, buttons, texture).",
    "Do not redesign, recolor, add logos, or remove details from the garment.",
    "Style it on a fictional adult model (do not reproduce the face of any real person, including anyone in the reference image), wearing simple complementary pieces that do not distract from the garment.",
    `Scene: ${opts.scene}.`,
    notes ? `Creative direction from the user: ${notes}.` : "",
    "Professional lighting, shallow depth of field, the garment clearly visible and in focus. No added text, captions or watermarks.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildImaginationPrompt(opts: { description?: string; hasDrawing: boolean; style: string }): string {
  const desc = opts.description?.trim();
  return [
    `Create ${opts.style}.`,
    "This is purely fictional artwork for a playful creative app. Depict only fictional characters and places; no real people, no photographic realism, no personal details, no text or lettering.",
    opts.hasDrawing
      ? "The attached image is a hand-drawn sketch. Keep its main subjects, their poses, the overall composition and its key colors recognizable, while turning it into a polished illustration."
      : "",
    desc ? `The idea to illustrate: ${desc}.` : "",
    "Keep every main idea from the input visible in the picture. Friendly, imaginative, suitable for all ages.",
  ]
    .filter(Boolean)
    .join("\n");
}
