"use client";

const MAX_EDGE = 1024;
export const MAX_RAW_BYTES = 15 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

/**
 * Loads a user file or bundled sample into a canvas and re-encodes it at most
 * 1024px on the long edge. Re-encoding strips metadata (e.g. EXIF location)
 * and keeps the upload far below the server's 5 MB limit.
 */
export async function prepareImage(source: File | string, opts: { photo: boolean }): Promise<Blob> {
  if (source instanceof File) {
    if (!ACCEPTED.includes(source.type)) throw new Error("Please choose a PNG, JPEG or WebP image.");
    if (source.size > MAX_RAW_BYTES) throw new Error("That image is over 15 MB. Please pick a smaller one.");
  }
  const url = source instanceof File ? URL.createObjectURL(source) : source;
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Couldn't read that image."));
      el.src = url;
    });
    const w = img.naturalWidth || 512;
    const h = img.naturalHeight || 512;
    const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const type = opts.photo ? "image/jpeg" : "image/png";
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.9));
    if (!blob) throw new Error("Couldn't process that image.");
    return blob;
  } finally {
    if (source instanceof File) URL.revokeObjectURL(url);
  }
}
