import { generateImage, type InlineImage } from "@/lib/gemini";
import { fail, formOf, handle, ok } from "@/lib/http";
import { FASHION_SCENES, IMAGINATION_STYLES, KID_WORLDS, buildBaselinePrompt, buildCharacterPrompt, buildFashionScenePrompt } from "@/lib/prompts";
import { fetchProductImage } from "@/lib/shopify/catalog";
import { readImage, text } from "@/lib/upload";
import { containsPersonalDetails, MAX_PROMPT_CHARS, MAX_SCENE_CHARS } from "@/lib/validation";
import type { GarmentAttributes } from "@/lib/ai/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function parseAttributes(raw: string): Partial<GarmentAttributes> | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return undefined;
    const str = (x: unknown) => (typeof x === "string" ? x.slice(0, 80) : undefined);
    const list = (x: unknown) => (Array.isArray(x) ? x.filter((i): i is string => typeof i === "string").map((i) => i.slice(0, 80)).slice(0, 6) : undefined);
    return { category: str(v.category), primaryColor: str(v.primaryColor), colors: list(v.colors), pattern: str(v.pattern), details: list(v.details) };
  } catch {
    return undefined;
  }
}

/** Step 3: Nano Banana generation. Fashion uses the selected product's real photo as the clothing reference. */
export async function POST(req: Request) {
  try {
    const form = await formOf(req);
    const mode = text(form, "mode", 20);

    if (mode === "fashion") {
      const custom = text(form, "scene", MAX_SCENE_CHARS);
      const scene = custom || FASHION_SCENES.find((s) => s.id === text(form, "sceneId", 40))?.description;
      if (!scene) return fail("invalid_input", "Pick a scene or describe one.");
      const productImageUrl = text(form, "productImageUrl", 2000);
      let reference: InlineImage | undefined;
      if (productImageUrl) reference = await fetchProductImage(productImageUrl);
      else reference = await readImage(form, "garment");
      if (!reference) return fail("invalid_input", "Select a product or add a garment image.");
      // Evaluation-only baseline: one direct call, no interpretation, no verified attributes.
      if (form.get("baseline") === "1") {
        const out = await generateImage({ prompt: buildBaselinePrompt(scene), images: [reference] });
        return ok({ image: `data:${out.mimeType};base64,${out.base64}`, model: out.model, baseline: true });
      }
      const selfie = await readImage(form, "selfie");
      const prompt = buildFashionScenePrompt({
        scene,
        productTitle: text(form, "productTitle", 200) || undefined,
        attributes: parseAttributes(text(form, "attributes", 4000)),
        hasSelfie: Boolean(selfie),
        notes: text(form, "notes", MAX_PROMPT_CHARS) || undefined,
        feedback: text(form, "feedback", 400) || undefined,
      });
      const out = await generateImage({ prompt, images: selfie ? [reference, selfie] : [reference] });
      return ok({ image: `data:${out.mimeType};base64,${out.base64}`, model: out.model, text: out.text });
    }

    if (mode === "imagination") {
      // Children's mode: no photos of people are accepted; only a drawing and/or a fictional idea.
      if (form.get("selfie")) return fail("invalid_input", "Imagination Mode uses drawings only, not photos.");
      const drawing = await readImage(form, "drawing");
      const description = text(form, "description", MAX_PROMPT_CHARS);
      if (!drawing && !description) return fail("invalid_input", "Draw or describe an outfit first.");
      if (containsPersonalDetails(description)) return fail("invalid_input", "Keep it fictional: please remove personal details.");
      const custom = text(form, "scene", MAX_SCENE_CHARS);
      const world = custom || KID_WORLDS.find((s) => s.id === text(form, "sceneId", 40))?.description;
      if (!world) return fail("invalid_input", "Pick a world or describe one.");
      const style = IMAGINATION_STYLES.find((s) => s.id === text(form, "styleId", 40)) ?? IMAGINATION_STYLES[0];
      const prompt = buildCharacterPrompt({
        world,
        style: style.description,
        description,
        summary: text(form, "summary", 400) || undefined,
        hasDrawing: Boolean(drawing),
      });
      const out = await generateImage({ prompt, images: drawing ? [drawing] : [] });
      return ok({ image: `data:${out.mimeType};base64,${out.base64}`, model: out.model, text: out.text });
    }

    return fail("invalid_input", "Unknown mode.");
  } catch (err) {
    return handle("generate", err);
  }
}
