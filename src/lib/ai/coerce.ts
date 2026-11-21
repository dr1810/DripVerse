type Json = Record<string, unknown>;
export const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
export const s = (v: unknown, max = 300): string => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const arr = (v: unknown, maxItems = 8, maxLen = 120): string[] =>
  Array.isArray(v) ? v.flatMap((x) => (typeof x === "string" && x.trim() ? [x.trim().slice(0, maxLen)] : [])).slice(0, maxItems) : [];
export const clamp = (v: unknown, lo: number, hi: number, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
