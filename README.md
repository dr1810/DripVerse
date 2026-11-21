# DripVerse

Imagine it. Wear it. Find it.

DripVerse shows real clothes in imagined worlds, then takes you to the store that sells them. Kids get their own mode: draw an outfit, pick a world, meet the character who wears it.

- **Fashion Mode.** Show us a tee (photo, drawing or words) and pick a scene. Gemini reads the garment, Shopify finds real matching products, Nano Banana puts you or a model in the scene wearing the one you pick, and a second Gemini model checks that the garment survived.
- **Imagination Mode.** For kids. Drawings and made-up ideas only, never photos. A friendly helper describes the drawing and suggests ideas, and the result is a stylized character. There's no shopping here; buying is for grown-ups, in Fashion Mode.

## How it works

```
Upload / sketch / describe
  → Gemini 4 Hydrogen   reads garment + scene → structured attributes + search query   (/api/interpret)
  → Shopify Catalog     search_catalog by words + photo → real products                 (/api/products)
  → user picks a product
  → Nano Banana 2       scene generated from the product's own photo                   (/api/generate)
  → Gemini 4 Neon       compares product photo vs result → fidelity scores + feedback  (/api/evaluate)
  → shop link (the merchant's variant URL, exactly as Shopify returned it)
```

| Role | Model / API | Why |
| --- | --- | --- |
| Model A: interpretation | `gemini-4-hydrogen` | Fast and multimodal: garment colors, pattern, details, scene, and a shopper-style query, as validated JSON |
| Model B: visual evaluation | `gemini-4-neon` | Stronger reasoning for side-by-side judgment: color, shape, pattern and details scores, mismatches, and feedback for "Apply feedback and regenerate" |
| Image generation | Nano Banana 2, `gemini-3.1-flash-image` | Generates the scene from reference images (product photo, optional selfie, or kid's drawing) |
| Commerce | Shopify Global Catalog, `search_catalog` over UCP at `catalog.shopify.com/api/ucp/mcp` | Over a billion real products. Search by text and by photo (`like`). No API key needed |

Model ids were checked against Google's model list (ai.google.dev/gemini-api/docs/models). Each one can be changed with an env var, without touching the UI.

## Setup

```bash
npm install
cp .env.example .env.local   # put your Gemini API key in GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

- The Gemini key stays on the server (`.env.local` is git-ignored). Shopify catalog search needs no key.
- In a Claude Code cloud session, start the server with `NODE_USE_ENV_PROXY=1 npm run dev` so Node's fetch uses the session's proxy. There, the key can be a Network secret for `generativelanguage.googleapis.com` sent in the `x-goog-api-key` header.

## Demo script (about 2 minutes)

1. **Hero:** "Imagine it. Wear it. Find it." Scroll to **Under the hood**: two Gemini 4 models, one real store.
2. **Fashion:**
   1. Keep the *Orange pocket tee* sample (or upload a tee), pick *Tokyo at night*, and press **Find it on Shopify**.
   2. Point out the Gemini 4 Hydrogen interpretation chips, then the real Shopify cards with live prices and stores.
   3. Pick one and press **Generate my universe**. When Gemini 4 Neon's fidelity card appears, open the merchant link.
3. **Compare universes:** switch to *Mars colony* and generate again. Results stack in **Your universes**. Try **Apply feedback and regenerate**.
4. **Imagination:** draw a cape on the canvas, pick *Space carnival*, and press **Create my character**. Show the helper's ideas and the "ideas kept" score.

## Evaluation

See [`eval/RESULTS.md`](eval/RESULTS.md). Test data comes from Shopify, with merchant color labels as ground truth, plus deliberately messy sketches. The structured workflow is compared against a photo-only search baseline and a single-call generation baseline.

```bash
npm run dev                          # in one terminal
npm run eval:testset && npm run eval
```

## Safety and honesty

- Images must be PNG, JPEG or WebP, 5 MB or smaller, and are checked by their actual bytes. Uploads and results are held in memory only and never logged; logs record error categories only.
- Product images are fetched only from `cdn.shopify.com`. Products, prices and links come only from Shopify responses; there are no fake fallbacks.
- No claims about fit or sizing; the app tells you to check the store page.
- Imagination Mode refuses photos and personal details, uses stylized characters, and has no shopping.
- Provider safety filters stay on. Blocked content, quota, timeouts, unavailable models and replies without an image all show clear errors.

## Checks

```bash
npm run typecheck && npm run lint && npm run build
```
