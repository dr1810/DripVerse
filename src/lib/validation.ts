export const MAX_PROMPT_CHARS = 500;
export const MAX_SCENE_CHARS = 200;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export type Mode = "fashion" | "imagination";

export function isMode(v: unknown): v is Mode {
  return v === "fashion" || v === "imagination";
}

export function isAllowedImageType(t: string): t is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(t);
}

/** Checks the file's magic bytes so a renamed file can't pass as an image. */
export function sniffImageType(buf: Uint8Array): AllowedImageType | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 12 &&
    String.fromCharCode(...buf.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...buf.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

const PERSONAL_DETAIL_PATTERNS = [
  /[\w.+-]+@[\w-]+\.[\w.]+/, // email
  /(\+?\d[\s-]?){9,}/, // phone-like digit runs
  /\b\d{1,5}\s+\w+\s+(street|st|avenue|ave|road|rd|lane|ln|drive|dr)\b/i, // street address
];

/** Imagination Mode keeps prompts fictional: reject obvious personal details. */
export function containsPersonalDetails(text: string): boolean {
  return PERSONAL_DETAIL_PATTERNS.some((re) => re.test(text));
}
