# DripVerse

See what you imagine.

DripVerse puts a favorite tee somewhere unexpected, or turns a sketch into a world of its own. One page, two modes, one Generate button.

- **Fashion Mode.** Same tee, new scene. Pick a tee and a place. The color, cut and details stay true.
- **Imagination Mode.** A whole world from a doodle. Add a sketch, a few words or both, and get a storybook scene.

## Setup

```bash
npm install
cp .env.example .env.local   # then put your real key in GEMINI_API_KEY (.env.local is git-ignored)
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-side only; never exposed to the browser. |
| `GEMINI_IMAGE_MODEL` | Defaults to `gemini-2.5-flash-image`. Use `gemini-3-pro-image-preview` for Nano Banana Pro. |
| `GEMINI_TIMEOUT_MS` | Optional; defaults to 60000. |

Next.js loads `.env.local` on the server only; the key never reaches the browser.

In a Claude Code cloud session, add the key as a **Network secret** for `generativelanguage.googleapis.com`, sent in the `x-goog-api-key` header. Then `.env.local` can hold any placeholder value, and the proxy swaps in the real key.

Without a key, the app still runs. Generate then shows a placeholder clearly labelled **SAMPLE RESULT (fallback)** instead of a real image.

## Two-mode demo

1. **Fashion**: keep *Sunset pocket tee* selected, pick *Golden-hour rooftop*, and press **Generate**. Try *Midnight star tee* with *Neon street* to show that the graphic is preserved.
2. Switch to **Imagination**: select *Rocket cat doodle*, tap the starter *A cat astronaut planting flowers on the moon*, keep *Storybook*, and press **Generate**.
3. Show **Regenerate**. Shopify recommendations and checkout come next.

## Showcase images

The landing page reads its before/after pairs from `src/lib/showcase.ts`. Until real outputs exist, it shows hand-drawn concept art labelled "Concept art". To swap in real Nano Banana results:

```bash
npm run dev
node scripts/generate-showcase.mjs http://localhost:3000
```

Then point `output.src` at the new files in `public/showcase/` and set `generated: true`.

## How it works

- `src/app/api/generate/route.ts` is the single POST route for both modes (multipart form). It validates mode, text length (500 characters, or 200 for a scene), image type (PNG, JPEG or WebP, checked by magic bytes) and size (5 MB or less). In Imagination Mode it also rejects obvious personal details such as emails, phone numbers and addresses.
- `src/lib/gemini.ts` holds the one shared `@google/genai` client. Provider safety settings stay at their defaults. Errors are mapped to `blocked`, `quota`, `timeout`, `no_image`, `bad_key` and `missing_key`.
- `src/lib/prompts.ts` has a prompt builder for each mode, plus the scenes, starters and styles.
- Privacy: before upload, the browser re-encodes images to 1024px or smaller, which strips EXIF data. Uploads and results are held only in memory and never stored. Server logs record the error category only, never prompts or images.

## Checks

```bash
npx tsc --noEmit && npm run lint && npm run build
```
