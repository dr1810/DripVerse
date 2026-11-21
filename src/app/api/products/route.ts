import { fail, formOf, handle, ok } from "@/lib/http";
import { searchClothing } from "@/lib/shopify/catalog";
import { readImage, text } from "@/lib/upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Step 2: real product discovery in Shopify's Global Catalog (search_catalog). Optional photo similarity via `like`. */
export async function POST(req: Request) {
  try {
    const form = await formOf(req);
    const query = text(form, "query", 120);
    if (!query) return fail("invalid_input", "Search query is required.");
    const likeImage = form.get("useImage") === "1" ? await readImage(form, "image") : undefined;
    const result = await searchClothing(
      { query, category: text(form, "category", 60), color: text(form, "color", 40) || undefined, style: text(form, "style", 60) || undefined },
      { limit: 8, likeImage },
    );
    return ok({ ...result, query, usedImage: Boolean(likeImage) });
  } catch (err) {
    return handle("products", err);
  }
}
