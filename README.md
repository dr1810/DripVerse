# DripVerse

Hackathon demo with two modes, built with Next.js (App Router), TypeScript and Gemini "Nano Banana" image generation.

- **Fashion Mode**: pick a sample tee or upload a clothing photo, then choose or describe a scene. You get an editorial shot that keeps the garment's color, silhouette and details.
- **Imagination Mode**: upload a drawing, write a short idea, or both. Idea starters are included, and the default output is a storybook illustration.

## Setup

```bash
npm install
cp .env.example .env.local   # then set GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-side only; never exposed to the browser. |
| `GEMINI_IMAGE_MODEL` | Defaults to `gemini-2.5-flash-image`. Use `gemini-3-pro-image-preview` for Nano Banana Pro. |
| `GEMINI_TIMEOUT_MS` | Optional; defaults to 60000. |

Without a key, the app still runs. Generate then shows a placeholder clearly labelled **SAMPLE RESULT (fallback)** instead of a real image.

## Two-mode demo

1. **Fashion**: keep *Sunset pocket tee* selected, pick *Golden-hour rooftop*, and press **Generate**. Try *Midnight star tee* with *Neon street* to show that the graphic is preserved.
2. Switch to **Imagination**: select *Rocket cat doodle*, tap the starter *A cat astronaut planting flowers on the moon*, keep *Storybook*, and press **Generate**.
3. Show **Retry** or **Regenerate**, and point out the roadmap strip: Shopify recommendations and checkout come next.

## How it works

- `src/app/api/generate/route.ts` is the single POST route for both modes (multipart form). It validates mode, text length (500 characters, or 200 for a scene), image type (PNG, JPEG or WebP, checked by magic bytes) and size (5 MB or less). In Imagination Mode it also rejects obvious personal details such as emails, phone numbers and addresses.
- `src/lib/gemini.ts` holds the one shared `@google/genai` client. Provider safety settings stay at their defaults. Errors are mapped to `blocked`, `quota`, `timeout`, `no_image`, `bad_key` and `missing_key`.
- `src/lib/prompts.ts` has a prompt builder for each mode, plus the scenes, starters and styles.
- Privacy: before upload, the browser re-encodes images to 1024px or smaller, which strips EXIF data. Uploads and results are held only in memory and never stored. Server logs record the error category only, never prompts or images.

## Checks

```bash
npx tsc --noEmit && npm run lint && npm run build
```
