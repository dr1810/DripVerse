"use client";

export type ApiError = { code: string; message: string };
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/** POSTs multipart data to one of our routes; never throws, always returns a truthful result. */
export async function postForm<T>(url: string, form: FormData, signal?: AbortSignal): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { method: "POST", body: form, signal });
    const body = await res.json().catch(() => null);
    if (res.ok && body && !body.error) return { ok: true, data: body as T };
    return { ok: false, error: body?.error ?? { code: "http_" + res.status, message: `Request failed (HTTP ${res.status}).` } };
  } catch (err) {
    if (signal?.aborted) return { ok: false, error: { code: "aborted", message: "Cancelled." } };
    return { ok: false, error: { code: "network", message: err instanceof Error ? err.message : "Network error." } };
  }
}

export const NON_RETRYABLE = new Set(["invalid_input", "blocked", "bad_key", "missing_key", "model_unavailable"]);
