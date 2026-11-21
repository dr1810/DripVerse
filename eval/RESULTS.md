# DripVerse evaluation (Element 119)

Reproducible: `npm run eval:testset` (builds the test set from Shopify), then `npm run eval` (runs everything through the app's real API routes). Raw output is in `eval/results/*.json`.

## Test data

- **12 real products** from Shopify's Global Catalog, picked automatically. Each comes from a fixed list of queries (written before seeing results), and the first result with an image and exactly one merchant color is taken. See `eval/testset.json`.
- **Ground truth** is the merchant's own `Color` option label plus the query's category. We didn't write it, so it is independent of our pipeline. It is also noisy: the "purple graphic t-shirt" item is labelled `Black` by its merchant.
- **3 programmatically drawn messy sketches** (`eval/sketches/`): a random scribble, two overlapping garments, and a faint, almost blank outline. The correct behavior is low confidence or listed ambiguities, not a confident guess.

## What is measured

| Metric | Structured multimodel workflow | Baseline |
| --- | --- | --- |
| Color / category extraction accuracy | Gemini 4 interpretation vs merchant labels | none |
| Search relevance@5 (color family + category match in the title and colors of the top 5) | Gemini 4 query + photo similarity | Shopify photo similarity only, generic query |
| Garment fidelity of the generated scene (0–100, scored by Gemini 4 Neon) | Product photo + verified attributes prompt | Single direct Nano Banana call ("Put this clothing item in …") |
| Messy-sketch behavior | Share flagged uncertain | none |

## Results: run of 2026-11-21 20:26 UTC

| Metric | Result |
| --- | --- |
| Baseline photo-only search relevance@5 (n=12) | **0.733** (measured) |
| Structured search relevance@5 | **not measured**: blocked, Gemini key rejected (`bad_key`) |
| Color / category extraction accuracy | **not measured**: blocked (`bad_key`) |
| Generation fidelity, structured vs baseline (n=2 attempted) | **not measured**: blocked (`bad_key`) |
| Messy sketches flagged uncertain (n=3) | **not measured**: blocked (`bad_key`) |

No Gemini-based metric has been measured yet, because every Gemini call in this environment was rejected with `API_KEY_INVALID`. Nothing here claims an improvement over the baseline.

## Known limitations seen so far

- The baseline photo search sends the product's own catalog image, so it can find the same listing or near-duplicates. Its 0.733 is likely optimistic.
- The catalog never returns an empty list. Even a nonsense query ("zzqxv plorptastic glorbwear") came back with unrelated products, so relevance has to be judged, not assumed.
- The catalog's anonymous rate limit was hit during test-set building (HTTP 429). The client now waits for `Retry-After` once, and the eval scripts pace their calls.
- Some catalog prices come back in a different currency from the one requested (e.g. ZAR when USD was requested). The app shows them as returned.
