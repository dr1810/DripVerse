import "server-only";
import { sniffImageType } from "@/lib/validation";

/**
 * Shopify Global Catalog over UCP/MCP, called directly from the server.
 * Verified against shop.dev/docs/catalog-api and /docs/search (UCP version 2026-08-25):
 *   POST https://catalog.shopify.com/api/ucp/mcp  (JSON-RPC tools/call, no API key required)
 *   tools: search_catalog, lookup_catalog, get_product
 * Products, prices and links shown in the app come only from these responses.
 */
const CATALOG_URL = "https://catalog.shopify.com/api/ucp/mcp";
const DEFAULT_PROFILE = "https://shopify.dev/ucp/agent-profiles/examples/2026-08-25/valid-with-capabilities.json";
const TIMEOUT_MS = 15_000;

import type { CatalogSearchResult, ClothingProduct, ClothingSearchQuery } from "./types";
export type { CatalogSearchResult, ClothingProduct, ClothingSearchQuery };

export class CatalogError extends Error {
  constructor(
    public code: "catalog_unavailable" | "catalog_rejected" | "catalog_bad_response" | "catalog_rate_limited",
    message: string,
  ) {
    super(message);
  }
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

function httpsUrl(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  try {
    return new URL(s).protocol === "https:" ? s : undefined;
  } catch {
    return undefined;
  }
}

export function formatMoney(amountMinor: number, currency: string): string {
  try {
    const f = new Intl.NumberFormat("en-US", { style: "currency", currency });
    return f.format(amountMinor / 10 ** (f.resolvedOptions().maximumFractionDigits ?? 2));
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${currency}`;
  }
}

function firstImage(media: unknown): { url?: string; alt?: string } {
  if (!Array.isArray(media)) return {};
  for (const m of media) {
    if (isObj(m) && m.type === "image") {
      const url = httpsUrl(m.url);
      if (url) return { url, alt: str(m.alt_text) };
    }
  }
  return {};
}

function parseOptions(v: unknown): { name: string; label: string }[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((o) => (isObj(o) && str(o.name) && str(o.label) ? [{ name: str(o.name)!, label: str(o.label)! }] : []));
}

/** Validates one catalog product. Returns null if it lacks what we need to show it truthfully. */
export function parseProduct(raw: unknown): ClothingProduct | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id);
  const title = str(raw.title);
  const variant = Array.isArray(raw.variants) && isObj(raw.variants[0]) ? raw.variants[0] : null;
  if (!id || !title || !variant) return null;
  const productUrl = httpsUrl(variant.url);
  const seller = isObj(variant.seller) ? variant.seller : {};
  const merchant = str(seller.name);
  if (!productUrl || !merchant) return null;

  const price = isObj(variant.price) ? variant.price : null;
  const amountMinor = num(price?.amount);
  const currency = str(price?.currency);
  const img = firstImage(variant.media);
  const productImg = img.url ? img : firstImage(raw.media);
  const options = parseOptions(variant.options);

  const colorSet = new Set<string>();
  for (const o of options) if (o.name.toLowerCase() === "color") colorSet.add(o.label);
  if (Array.isArray(raw.options)) {
    for (const o of raw.options) {
      if (isObj(o) && str(o.name)?.toLowerCase() === "color" && Array.isArray(o.values)) {
        for (const val of o.values) if (isObj(val) && str(val.label)) colorSet.add(str(val.label)!);
      }
    }
  }
  const meta = isObj(raw.metadata) ? raw.metadata : {};
  const features = Array.isArray(meta.top_features) ? meta.top_features.flatMap((f) => (str(f) ? [str(f)!] : [])).slice(0, 4) : [];
  const rating = isObj(raw.rating) && num(raw.rating.value) !== undefined ? { value: num(raw.rating.value)!, count: num(raw.rating.count) ?? 0 } : undefined;

  return {
    id,
    variantId: str(variant.id) ?? id,
    title,
    merchant,
    merchantUrl: httpsUrl(seller.url),
    imageUrl: productImg.url,
    imageAlt: productImg.alt,
    amountMinor,
    currency,
    price: amountMinor !== undefined && currency ? formatMoney(amountMinor, currency) : undefined,
    available: isObj(variant.availability) && typeof variant.availability.available === "boolean" ? variant.availability.available : undefined,
    productUrl,
    options,
    colors: [...colorSet].slice(0, 8),
    features,
    rating,
  };
}

async function callCatalog(tool: "search_catalog" | "get_product", catalog: Json): Promise<Json> {
  const profile = process.env.SHOPIFY_AGENT_PROFILE_URL || DEFAULT_PROFILE;
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (process.env.SHOPIFY_CATALOG_TOKEN) headers.Authorization = `Bearer ${process.env.SHOPIFY_CATALOG_TOKEN}`;

  const send = () =>
    fetch(CATALOG_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: { name: tool, arguments: { meta: { "ucp-agent": { profile } }, catalog } },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  let res: Response;
  try {
    res = await send();
    if (res.status === 429) {
      // Honor Retry-After once (capped) as Shop's docs ask, then give up truthfully.
      const wait = Math.min(Number(res.headers.get("retry-after")) || 2, 5) * 1000;
      await new Promise((r) => setTimeout(r, wait));
      res = await send();
    }
  } catch {
    throw new CatalogError("catalog_unavailable", "Couldn't reach the Shopify catalog. Please retry.");
  }
  if (res.status === 429) throw new CatalogError("catalog_rate_limited", "The Shopify catalog is rate limiting requests. Wait a moment and retry.");
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new CatalogError("catalog_bad_response", `Shopify catalog returned HTTP ${res.status} without JSON.`);
  }
  if (!isObj(body)) throw new CatalogError("catalog_bad_response", "Unexpected catalog response.");
  if (isObj(body.error)) throw new CatalogError("catalog_rejected", str(body.error.message) ?? "The catalog rejected the request.");
  if (!res.ok) throw new CatalogError("catalog_bad_response", `Shopify catalog returned HTTP ${res.status}.`);
  const result = isObj(body.result) ? body.result : null;
  if (result?.isError === true) throw new CatalogError("catalog_rejected", "The catalog tool reported an error.");
  const data = result && isObj(result.structuredContent) ? result.structuredContent : null;
  if (!data) throw new CatalogError("catalog_bad_response", "Catalog response has no structuredContent.");
  if (isObj(data.ucp) && data.ucp.status === "error") {
    const msg = Array.isArray(data.messages) ? data.messages.map((m) => (isObj(m) ? str(m.content) : undefined)).filter(Boolean).join("; ") : "";
    throw new CatalogError("catalog_rejected", msg || "Catalog error.");
  }
  return data;
}

export async function searchClothing(
  q: ClothingSearchQuery,
  opts: { limit?: number; likeImage?: { mimeType: string; base64: string }; country?: string; currency?: string } = {},
): Promise<CatalogSearchResult> {
  const catalog: Json = {
    query: q.query,
    context: { address_country: opts.country ?? "US", currency: opts.currency ?? "USD" },
    filters: { available: true },
    pagination: { limit: Math.min(Math.max(opts.limit ?? 8, 1), 20) },
  };
  if (opts.likeImage) catalog.like = [{ image: { content_type: opts.likeImage.mimeType, data: opts.likeImage.base64 } }];

  const data = await callCatalog("search_catalog", catalog);
  if (!Array.isArray(data.products)) throw new CatalogError("catalog_bad_response", "Catalog response has no products list.");
  const products = data.products.map(parseProduct).filter((p): p is ClothingProduct => p !== null);
  const warnings = Array.isArray(data.messages)
    ? data.messages.flatMap((m) => (isObj(m) && m.type === "warning" && str(m.content) ? [str(m.content)!] : []))
    : [];
  const totalCount = isObj(data.pagination) ? num(data.pagination.total_count) : undefined;
  return { products, totalCount, warnings };
}

export async function getProduct(id: string, opts: { country?: string; currency?: string } = {}): Promise<ClothingProduct | null> {
  const data = await callCatalog("get_product", { id, context: { address_country: opts.country ?? "US", currency: opts.currency ?? "USD" } });
  return parseProduct(data.product);
}

const MAX_PRODUCT_IMAGE_BYTES = 8 * 1024 * 1024;

/**
 * Downloads a catalog product image for use as a generation/evaluation reference.
 * Only Shopify's CDN is allowed (no open proxy / SSRF). Uses the CDN's documented resize parameter.
 */
export async function fetchProductImage(url: string): Promise<{ mimeType: string; base64: string }> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new CatalogError("catalog_rejected", "Invalid product image URL.");
  }
  if (u.protocol !== "https:" || u.hostname !== "cdn.shopify.com") {
    throw new CatalogError("catalog_rejected", "Product images must come from cdn.shopify.com.");
  }
  u.searchParams.set("width", "1024");
  u.searchParams.set("format", "jpg");
  let res: Response;
  try {
    res = await fetch(u, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    throw new CatalogError("catalog_unavailable", "Couldn't download the product image.");
  }
  if (!res.ok) throw new CatalogError("catalog_bad_response", `Product image returned HTTP ${res.status}.`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > MAX_PRODUCT_IMAGE_BYTES) throw new CatalogError("catalog_rejected", "Product image is too large.");
  const mimeType = sniffImageType(buf);
  if (!mimeType) throw new CatalogError("catalog_bad_response", "Product image isn't a PNG, JPEG or WebP.");
  return { mimeType, base64: Buffer.from(buf).toString("base64") };
}
