import "server-only";
import { NextResponse } from "next/server";
import { GenerationError } from "@/lib/gemini";
import { CatalogError } from "@/lib/shopify/catalog";
import { InputError } from "@/lib/upload";

const STATUS: Record<string, number> = {
  invalid_input: 400,
  missing_key: 503,
  bad_key: 502,
  model_unavailable: 502,
  blocked: 422,
  quota: 429,
  timeout: 504,
  no_image: 502,
  bad_output: 502,
  provider_error: 502,
  catalog_unavailable: 502,
  catalog_rejected: 502,
  catalog_bad_response: 502,
  catalog_rate_limited: 429,
};

export function ok(body: unknown) {
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}

export function fail(code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status: STATUS[code] ?? 500, headers: { "Cache-Control": "no-store" } });
}

/** Maps known errors to truthful responses. Logs the route and error category only, never inputs. */
export function handle(route: string, err: unknown) {
  if (err instanceof InputError) return fail("invalid_input", err.message);
  if (err instanceof GenerationError || err instanceof CatalogError) {
    console.warn(`[${route}] failed: ${err.code}`);
    return fail(err.code, err.message);
  }
  console.warn(`[${route}] failed: unexpected`);
  return fail("provider_error", "Something went wrong. Please retry.");
}

export async function formOf(req: Request): Promise<FormData> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > 20 * 1024 * 1024) throw new InputError("Request is too large.");
  try {
    return await req.formData();
  } catch {
    throw new InputError("Expected multipart form data.");
  }
}
