import { interpret } from "@/lib/ai/interpret";
import { fail, formOf, handle, ok } from "@/lib/http";
import { FASHION_SCENES, KID_WORLDS } from "@/lib/prompts";
import { readImage, text } from "@/lib/upload";
import { containsPersonalDetails, MAX_PROMPT_CHARS, MAX_SCENE_CHARS } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Step 1: Model A reads the garment/sketch + scene and returns structured attributes and a search query. */
export async function POST(req: Request) {
  try {
    const form = await formOf(req);
    const mode = text(form, "mode", 20);
    if (mode !== "fashion" && mode !== "imagination") return fail("invalid_input", "Unknown mode.");
    const image = await readImage(form, "image");
    const description = text(form, "description", MAX_PROMPT_CHARS);
    if (!image && !description) return fail("invalid_input", "Add a garment image, a drawing or a description.");
    if (mode === "imagination" && containsPersonalDetails(description)) {
      return fail("invalid_input", "Keep it fictional: please remove personal details like emails, phone numbers or addresses.");
    }
    const sceneId = text(form, "sceneId", 40);
    const custom = text(form, "scene", MAX_SCENE_CHARS);
    const list = mode === "fashion" ? FASHION_SCENES : KID_WORLDS;
    const scene = custom || list.find((s) => s.id === sceneId)?.description;
    return ok(await interpret({ mode, image, description, scene }));
  } catch (err) {
    return handle("interpret", err);
  }
}
