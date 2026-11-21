import "server-only";
import { MAX_UPLOAD_BYTES, isAllowedImageType, sniffImageType } from "@/lib/validation";
import type { InlineImage } from "@/lib/gemini";

export class InputError extends Error {}

/** Reads an optional image field from multipart data. Kept in memory only; never written or logged. */
export async function readImage(form: FormData, name: string): Promise<InlineImage | undefined> {
  const file = form.get(name);
  if (!(file instanceof File) || file.size === 0) return undefined;
  if (file.size > MAX_UPLOAD_BYTES) throw new InputError("Images must be 5 MB or smaller.");
  if (!isAllowedImageType(file.type)) throw new InputError("Images must be PNG, JPEG or WebP.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffImageType(bytes);
  if (!sniffed) throw new InputError("That file doesn't look like a PNG, JPEG or WebP image.");
  return { mimeType: sniffed, base64: Buffer.from(bytes).toString("base64") };
}

/** Parses a data: URL produced by our own generate route (sent back for evaluation). */
export function readDataUrl(value: unknown, maxBytes = 8 * 1024 * 1024): InlineImage {
  if (typeof value !== "string") throw new InputError("Missing generated image.");
  const m = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!m) throw new InputError("Generated image must be a PNG, JPEG or WebP data URL.");
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > maxBytes) throw new InputError("Generated image is too large.");
  const sniffed = sniffImageType(new Uint8Array(bytes));
  if (!sniffed) throw new InputError("Generated image data is not a valid image.");
  return { mimeType: sniffed, base64: m[2] };
}

export function text(form: FormData, name: string, max: number): string {
  const v = form.get(name);
  const s = typeof v === "string" ? v.trim() : "";
  if (s.length > max) throw new InputError(`${name} must be ${max} characters or fewer.`);
  return s;
}
