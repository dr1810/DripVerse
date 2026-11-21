import { NextResponse } from "next/server";
import { GenerationError, generateImage, type GenerationErrorCode } from "@/lib/gemini";
import {
  FASHION_SCENES,
  IMAGINATION_STYLES,
  buildFashionPrompt,
  buildImaginationPrompt,
} from "@/lib/prompts";
import {
  MAX_PROMPT_CHARS,
  MAX_SCENE_CHARS,
  MAX_UPLOAD_BYTES,
  containsPersonalDetails,
  isAllowedImageType,
  isMode,
  sniffImageType,
} from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const STATUS: Record<GenerationErrorCode | "invalid_input", number> = {
  invalid_input: 400,
  missing_key: 503,
  bad_key: 502,
  blocked: 422,
  quota: 429,
  timeout: 504,
  no_image: 502,
  provider_error: 502,
};

function fail(code: keyof typeof STATUS, message: string) {
  return NextResponse.json({ error: { code, message } }, { status: STATUS[code], headers: { "Cache-Control": "no-store" } });
}

function field(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: Request) {
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (contentLength > MAX_UPLOAD_BYTES + 64 * 1024) return fail("invalid_input", "Upload is larger than 5 MB.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("invalid_input", "Expected multipart form data.");
  }

  const mode = field(form, "mode");
  if (!isMode(mode)) return fail("invalid_input", "Unknown mode.");

  const prompt = field(form, "prompt");
  if (prompt.length > MAX_PROMPT_CHARS) return fail("invalid_input", `Description must be ${MAX_PROMPT_CHARS} characters or fewer.`);

  // Image (optional in Imagination, required in Fashion). Read into memory only; never persisted or logged.
  let image: { mimeType: string; base64: string } | undefined;
  const file = form.get("image");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) return fail("invalid_input", "Image must be 5 MB or smaller.");
    if (!isAllowedImageType(file.type)) return fail("invalid_input", "Image must be PNG, JPEG or WebP.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sniffed = sniffImageType(bytes);
    if (!sniffed) return fail("invalid_input", "That file doesn't look like a PNG, JPEG or WebP image.");
    image = { mimeType: sniffed, base64: Buffer.from(bytes).toString("base64") };
  }

  let fullPrompt: string;
  if (mode === "fashion") {
    if (!image) return fail("invalid_input", "Add a garment photo or pick a sample tee.");
    const sceneId = field(form, "sceneId");
    const customScene = field(form, "scene");
    if (customScene.length > MAX_SCENE_CHARS) return fail("invalid_input", `Scene must be ${MAX_SCENE_CHARS} characters or fewer.`);
    const scene = customScene || FASHION_SCENES.find((s) => s.id === sceneId)?.description;
    if (!scene) return fail("invalid_input", "Pick a scene or describe one.");
    fullPrompt = buildFashionPrompt({ scene, notes: prompt });
  } else {
    if (!image && !prompt) return fail("invalid_input", "Upload a drawing, write a description, or both.");
    if (containsPersonalDetails(prompt)) {
      return fail("invalid_input", "Keep it fictional: please remove personal details like emails, phone numbers or addresses.");
    }
    const style = IMAGINATION_STYLES.find((s) => s.id === field(form, "styleId")) ?? IMAGINATION_STYLES[0];
    fullPrompt = buildImaginationPrompt({ description: prompt, hasDrawing: Boolean(image), style: style.description });
  }

  try {
    const result = await generateImage({ prompt: fullPrompt, image });
    return NextResponse.json(
      {
        image: `data:${result.mimeType};base64,${result.base64}`,
        text: result.text,
        model: result.model,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof GenerationError) {
      // Log the error category only — never prompts, images or keys.
      console.warn(`[generate] ${mode} failed: ${err.code}`);
      return fail(err.code, err.message);
    }
    console.warn(`[generate] ${mode} failed: unexpected`);
    return fail("provider_error", "Something went wrong. Please retry.");
  }
}
