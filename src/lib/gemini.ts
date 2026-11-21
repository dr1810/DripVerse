import "server-only";
import { ApiError, FinishReason, GoogleGenAI, type Part } from "@google/genai";

export const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";

export type GenerationErrorCode =
  | "missing_key"
  | "bad_key"
  | "blocked"
  | "quota"
  | "timeout"
  | "no_image"
  | "provider_error";

export class GenerationError extends Error {
  constructor(
    public code: GenerationErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const BLOCKED_FINISH_REASONS = new Set<string>([
  FinishReason.SAFETY,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.BLOCKLIST,
  FinishReason.SPII,
  FinishReason.IMAGE_SAFETY,
  FinishReason.IMAGE_PROHIBITED_CONTENT,
  FinishReason.RECITATION,
]);

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GenerationError("missing_key", "The server has no GEMINI_API_KEY configured.");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

export type GenerateImageInput = {
  prompt: string;
  image?: { mimeType: string; base64: string };
};

export type GeneratedImage = { mimeType: string; base64: string; text?: string; model: string };

/**
 * One Gemini client shared by both modes. Provider safety settings are left at
 * their defaults (enabled). Prompts and images are never logged.
 */
export async function generateImage(input: GenerateImageInput): Promise<GeneratedImage> {
  const ai = getClient();
  const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS) || 60_000;

  const parts: Part[] = [];
  if (input.image) parts.push({ inlineData: { mimeType: input.image.mimeType, data: input.image.base64 } });
  parts.push({ text: input.prompt });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: { responseModalities: ["IMAGE", "TEXT"], abortSignal: controller.signal },
    });
  } catch (err) {
    throw mapProviderError(err, controller.signal.aborted);
  } finally {
    clearTimeout(timer);
  }

  if (response.promptFeedback?.blockReason) {
    throw new GenerationError("blocked", "The request was blocked by the provider's safety filters. Try a different image or description.");
  }

  const candidate = response.candidates?.[0];
  const outParts = candidate?.content?.parts ?? [];
  const imagePart = outParts.find((p) => p.inlineData?.data);
  const text = outParts
    .map((p) => p.text)
    .filter(Boolean)
    .join(" ")
    .trim();

  if (!imagePart?.inlineData?.data) {
    if (candidate?.finishReason && BLOCKED_FINISH_REASONS.has(candidate.finishReason)) {
      throw new GenerationError("blocked", "The provider declined to create this image. Try a different image or description.");
    }
    throw new GenerationError("no_image", "The model replied without an image. Please try again, or rephrase the prompt.");
  }

  return {
    mimeType: imagePart.inlineData.mimeType || "image/png",
    base64: imagePart.inlineData.data,
    text: text || undefined,
    model,
  };
}

function mapProviderError(err: unknown, aborted: boolean): GenerationError {
  if (err instanceof GenerationError) return err;
  if (aborted || (err instanceof Error && err.name === "AbortError")) {
    return new GenerationError("timeout", "Generation took too long. Please retry.");
  }
  if (err instanceof ApiError) {
    if (err.status === 429) return new GenerationError("quota", "The image model's quota or rate limit was reached. Wait a moment and retry.");
    if (err.status === 401 || err.status === 403 || /api key/i.test(err.message)) {
      return new GenerationError("bad_key", "The server's Gemini API key was rejected.");
    }
    if (err.status === 504 || err.status === 408) return new GenerationError("timeout", "Generation took too long. Please retry.");
  }
  return new GenerationError("provider_error", "The image service had a problem. Please retry.");
}
