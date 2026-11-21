# DripVerse: project notes for Claude Code

Next.js 15 App Router + TypeScript. No database; uploads and results are transient (in memory only, never logged).

## Architecture
- `src/lib/models.ts`: model roles and ids (Gemini 4 Hydrogen = interpret, Gemini 4 Neon = evaluate, Nano Banana 2 = image). Env vars override the ids.
- `src/lib/gemini.ts`: the single Gemini client (`generateImage`, `generateJson`) with error mapping.
- `src/lib/ai/interpret.ts`, `src/lib/ai/evaluate.ts`: Model A and Model B, each with a JSON schema and output validation.
- `src/lib/shopify/catalog.ts`: Shopify Global Catalog (UCP over MCP JSON-RPC) at `https://catalog.shopify.com/api/ucp/mcp`: `search_catalog`, `get_product`. Never invent products, prices or links.
- API routes: `/api/interpret` → `/api/products` → `/api/generate` → `/api/evaluate`.
- UI: `src/components/studio/FashionFlow.tsx`, `ImaginationFlow.tsx`.

## Rules
- Keep secrets server-side. Validate image type/size (`src/lib/upload.ts`). Only fetch product images from `cdn.shopify.com`.
- Imagination Mode: drawings and fictional text only; no photos; no shopping.
- Show truthful errors; never substitute fake results.
- Checks: `npx tsc --noEmit && npm run lint && npm run build`.
- In a Claude Code cloud container, start servers with `NODE_USE_ENV_PROXY=1` so Node's fetch uses the egress proxy.
