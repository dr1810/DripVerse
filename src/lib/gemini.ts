import "server-only";
import { ApiError, FinishReason, GoogleGenAI, type Part } from "@google/genai";
import { modelFor } from "@/lib/models";

export type GenerationErrorCode =
  | "missing_key"
  | "bad_key"
  | "model_unavailable"
  | "blocked"
  | "quota"
  | "timeout"
  | "no_image"
  | "bad_output"
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

export type InlineImage = { mimeType: string; base64: string };

export function imagePart(img: InlineImage): Part {
  return { inlineData: { mimeType: img.mimeType, data: img.base64 } };
}

async function call<T>(model: string, run: (ai: GoogleGenAI, signal: AbortSignal) => Promise<T>): Promise<T> {
  const ai = getClient();
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS) || 90_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(ai, controller.signal);
  } catch (err) {
    throw mapProviderError(err, controller.signal.aborted, model);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Nano Banana: one scene from a prompt plus reference images (product photo, optional selfie or sketch).
 * Provider safety settings stay at their defaults. Prompts and images are never logged.
 */
export async function generateImage(input: { prompt: string; images?: InlineImage[] }): Promise<InlineImage & { text?: string; model: string }> {
  const model = modelFor("image");
  const parts: Part[] = [...(input.images ?? []).map(imagePart), { text: input.prompt }];
  const response = await call(model, (ai, signal) =>
    ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
      config: { responseModalities: ["IMAGE", "TEXT"], abortSignal: signal },
    }),
  );
  if (response.promptFeedback?.blockReason) {
    throw new GenerationError("blocked", "The request was blocked by the provider's safety filters. Try a different image or description.");
  }
  const candidate = response.candidates?.[0];
  const outParts = candidate?.content?.parts ?? [];
  const img = outParts.find((p) => p.inlineData?.data);
  const text = outParts.map((p) => p.text).filter(Boolean).join(" ").trim();
  if (!img?.inlineData?.data) {
    if (candidate?.finishReason && BLOCKED_FINISH_REASONS.has(candidate.finishReason)) {
      throw new GenerationError("blocked", "The provider declined to create this image. Try a different image or description.");
    }
    throw new GenerationError("no_image", "The model replied without an image. Please try again, or rephrase.");
  }
  return { mimeType: img.inlineData.mimeType || "image/png", base64: img.inlineData.data, text: text || undefined, model };
}

/** Structured JSON from a Gemini 4 model, validated by the caller. */
export async function generateJson(input: { model: string; system: string; parts: Part[]; schema: object }): Promise<unknown> {
  const response = await call(input.model, (ai, signal) =>
    ai.models.generateContent({
      model: input.model,
      contents: [{ role: "user", parts: input.parts }],
      config: {
        systemInstruction: input.system,
        responseMimeType: "application/json",
        responseJsonSchema: input.schema,
        temperature: 0.2,
        abortSignal: signal,
      },
    }),
  );
  if (response.promptFeedback?.blockReason) {
    throw new GenerationError("blocked", "The request was blocked by the provider's safety filters.");
  }
  const text = response.text;
  if (!text) {
    const reason = response.candidates?.[0]?.finishReason;
    if (reason && BLOCKED_FINISH_REASONS.has(reason)) throw new GenerationError("blocked", "The provider declined this request.");
    throw new GenerationError("bad_output", "The model returned no answer.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new GenerationError("bad_output", "The model's answer wasn't valid JSON.");
  }
}

function mapProviderError(err: unknown, aborted: boolean, model: string): GenerationError {
  if (err instanceof GenerationError) return err;
  if (aborted || (err instanceof Error && err.name === "AbortError")) {
    return new GenerationError("timeout", "The model took too long. Please retry.");
  }
  if (err instanceof ApiError) {
    if (err.status === 429) return new GenerationError("quota", "Quota or rate limit reached. Wait a moment and retry.");
    if (err.status === 401 || err.status === 403 || /api key/i.test(err.message)) {
      return new GenerationError("bad_key", "The server's Gemini API key was rejected.");
    }
    if (err.status === 404) return new GenerationError("model_unavailable", `Model ${model} isn't available to this API key.`);
    if (err.status === 504 || err.status === 408) return new GenerationError("timeout", "The model took too long. Please retry.");
  }
  return new GenerationError("provider_error", "The AI service had a problem. Please retry.");
}
