import { evaluateConsistency } from "@/lib/ai/evaluate";
import { fail, formOf, handle, ok } from "@/lib/http";
import { fetchProductImage } from "@/lib/shopify/catalog";
import { readDataUrl, readImage, text } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Step 4: Model B compares the clothing reference with the generated scene. */
export async function POST(req: Request) {
  try {
    const form = await formOf(req);
    const kind = text(form, "kind", 20) === "drawing" ? "drawing" : "product";
    const refUrl = text(form, "referenceUrl", 2000);
    const reference = refUrl ? await fetchProductImage(refUrl) : await readImage(form, "reference");
    if (!reference) return fail("invalid_input", "A reference image is required.");
    const generated = readDataUrl(form.get("generated"));
    return ok(await evaluateConsistency({ reference, generated, expected: text(form, "expected", 600) || undefined, kind }));
  } catch (err) {
    return handle("evaluate", err);
  }
}
