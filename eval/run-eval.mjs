// DripVerse evaluation: structured multimodel workflow vs simple baselines, through the app's real routes.
// Usage: node eval/run-eval.mjs [baseUrl] [--gen N]
// Records failures as failures. Gemini-dependent metrics are reported as "blocked" when the API is unavailable.
import { readFile, readdir, writeFile } from "node:fs/promises";

const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith("http")) ?? "http://localhost:3000";
const genN = Number(args[args.indexOf("--gen") + 1]) || 0;
const { items } = JSON.parse(await readFile("eval/testset.json", "utf8"));

// Basic color families for matching merchant labels ("Electric Orange", "S. Orange") with model output.
const FAMILIES = {
  red: ["red", "crimson", "scarlet", "burgundy", "maroon", "wine", "cherry"],
  orange: ["orange", "rust", "burnt", "tangerine", "coral", "brick"],
  yellow: ["yellow", "mustard", "gold", "lemon", "maize"],
  green: ["green", "olive", "sage", "forest", "mint", "khaki", "lime", "army"],
  blue: ["blue", "navy", "denim", "indigo", "cobalt", "royal", "sky", "teal"],
  purple: ["purple", "violet", "lavender", "lilac", "plum", "grape"],
  pink: ["pink", "rose", "blush", "fuchsia", "magenta"],
  brown: ["brown", "tan", "camel", "chocolate", "mocha", "coffee", "cognac"],
  black: ["black", "jet", "onyx", "charcoal"],
  white: ["white", "ivory", "cream", "off-white", "natural", "ecru"],
  grey: ["grey", "gray", "heather", "ash", "silver", "slate"],
};
const families = (text) => {
  const t = (text || "").toLowerCase();
  return Object.entries(FAMILIES).filter(([, words]) => words.some((w) => t.includes(w))).map(([f]) => f);
};
const CATEGORY_WORDS = {
  hoodie: ["hoodie", "hooded"], jacket: ["jacket", "coat", "raincoat", "parka", "windbreaker"], sweatshirt: ["sweatshirt", "crewneck", "pullover"],
  shoes: ["sneaker", "shoe", "trainer"], shirt: ["shirt", "polo", "button"], dress: ["dress"], pants: ["pant", "jogger", "sweatpant", "trouser"],
  "t-shirt": ["t-shirt", "tee", "t shirt"], hat: ["beanie", "hat", "cap"],
};
const catMatch = (cat, text) => (CATEGORY_WORDS[cat] ?? [cat]).some((w) => (text || "").toLowerCase().includes(w));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(path, form) {
  await sleep(1200); // stay under the anonymous catalog rate limit
  const t0 = Date.now();
  const res = await fetch(`${base}${path}`, { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok && !body.error, body, error: body.error, ms: Date.now() - t0 };
}
async function imageBlob(url) {
  const res = await fetch(url.includes("?") ? `${url}&width=768&format=jpg` : `${url}?width=768&format=jpg`);
  return new Blob([await res.arrayBuffer()], { type: "image/jpeg" });
}
function relevance(products, item) {
  const top = products.slice(0, 5);
  if (!top.length) return 0;
  const want = families(item.merchantColor);
  const hits = top.filter((p) => {
    const text = `${p.title} ${p.colors.join(" ")}`;
    const colorOk = want.length === 0 || families(text).some((f) => want.includes(f));
    return colorOk && catMatch(item.category, p.title);
  });
  return hits.length / top.length;
}
const mean = (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(3) : null);

const rows = [];
const blocked = new Set();
for (const item of items) {
  const row = { id: item.id, title: item.title, merchantColor: item.merchantColor, category: item.category };
  const img = await imageBlob(item.imageUrl);

  // Baseline search: Shopify photo similarity only, generic words, no Gemini.
  const bf = new FormData();
  bf.set("query", "clothing");
  bf.set("useImage", "1");
  bf.set("image", img, "p.jpg");
  const b = await post("/api/products", bf);
  row.baselineRelevance = b.ok ? relevance(b.body.products, item) : null;
  if (!b.ok) row.baselineError = b.error?.code;

  // Structured: Gemini 4 interpretation → attributes + query → Shopify (query + photo).
  const f = new FormData();
  f.set("mode", "fashion");
  f.set("image", img, "p.jpg");
  const r = await post("/api/interpret", f);
  if (!r.ok) {
    row.interpretError = r.error?.code;
    blocked.add(r.error?.code);
  } else {
    const g = r.body.garment;
    const predicted = families([g.primaryColor, ...g.colors].join(" "));
    const truth = families(item.merchantColor);
    row.predictedColor = g.primaryColor;
    row.colorCorrect = truth.length ? predicted.some((x) => truth.includes(x)) : null;
    row.primaryColorCorrect = truth.length ? families(g.primaryColor).some((x) => truth.includes(x)) : null;
    row.categoryCorrect = catMatch(item.category, `${g.category} ${r.body.search.query}`);
    row.query = r.body.search.query;
    row.confidence = r.body.confidence;
    row.interpretMs = r.ms;
    const sf = new FormData();
    sf.set("query", r.body.search.query);
    sf.set("useImage", "1");
    sf.set("image", img, "p.jpg");
    const s = await post("/api/products", sf);
    row.structuredRelevance = s.ok ? relevance(s.body.products, item) : null;
  }
  rows.push(row);
  console.log(JSON.stringify(row));
}

// Generation consistency: structured (product photo + verified attributes) vs baseline single call, scored by Model B.
const gen = [];
for (const item of items.slice(0, genN)) {
  const out = { id: item.id, title: item.title };
  for (const variant of ["structured", "baseline"]) {
    const f = new FormData();
    f.set("mode", "fashion");
    f.set("sceneId", "tokyo");
    f.set("productImageUrl", item.imageUrl);
    f.set("productTitle", item.title);
    if (variant === "baseline") f.set("baseline", "1");
    const g = await post("/api/generate", f);
    if (!g.ok) {
      out[`${variant}Error`] = g.error?.code;
      blocked.add(g.error?.code);
      continue;
    }
    const e = new FormData();
    e.set("kind", "product");
    e.set("referenceUrl", item.imageUrl);
    e.set("generated", g.body.image);
    const ev = await post("/api/evaluate", e);
    out[`${variant}Score`] = ev.ok ? ev.body.overallScore : null;
    out[`${variant}Color`] = ev.ok ? ev.body.color.score : null;
    out[`${variant}Pattern`] = ev.ok ? ev.body.pattern.score : null;
    if (!ev.ok) out[`${variant}EvalError`] = ev.error?.code;
  }
  gen.push(out);
  console.log(JSON.stringify(out));
}

// Messy / ambiguous sketches: the right behavior is low confidence or listed ambiguities, not a confident guess.
const messy = [];
for (const name of (await readdir("eval/sketches")).filter((n) => n.endsWith(".png")).sort()) {
  const f = new FormData();
  f.set("mode", "fashion");
  f.set("image", new Blob([await readFile(`eval/sketches/${name}`)], { type: "image/png" }), name);
  const r = await post("/api/interpret", f);
  if (!r.ok) {
    messy.push({ name, error: r.error?.code });
    blocked.add(r.error?.code);
    continue;
  }
  messy.push({ name, confidence: r.body.confidence, ambiguities: r.body.ambiguities, query: r.body.search.query, flaggedUncertain: r.body.confidence < 0.6 || r.body.ambiguities.length > 0 });
}

const ok = (k) => rows.filter((r) => typeof r[k] === "boolean");
const summary = {
  ranAt: new Date().toISOString(),
  base,
  items: rows.length,
  blockedBy: [...blocked].filter(Boolean),
  attributeExtraction: {
    n: ok("colorCorrect").length,
    colorAccuracy: mean(ok("colorCorrect").map((r) => +r.colorCorrect)),
    primaryColorAccuracy: mean(ok("primaryColorCorrect").map((r) => +r.primaryColorCorrect)),
    categoryAccuracy: mean(ok("categoryCorrect").map((r) => +r.categoryCorrect)),
  },
  searchRelevanceAt5: {
    baselinePhotoOnly: mean(rows.filter((r) => r.baselineRelevance != null).map((r) => r.baselineRelevance)),
    structured: mean(rows.filter((r) => r.structuredRelevance != null).map((r) => r.structuredRelevance)),
    nBaseline: rows.filter((r) => r.baselineRelevance != null).length,
    nStructured: rows.filter((r) => r.structuredRelevance != null).length,
  },
  generationConsistency: {
    n: gen.length,
    structuredMean: mean(gen.filter((g) => g.structuredScore != null).map((g) => g.structuredScore)),
    baselineMean: mean(gen.filter((g) => g.baselineScore != null).map((g) => g.baselineScore)),
  },
  messySketches: { n: messy.length, flaggedUncertain: messy.filter((m) => m.flaggedUncertain).length, errors: messy.filter((m) => m.error).length },
};
const stamp = summary.ranAt.replace(/[:.]/g, "-");
await writeFile(`eval/results/${stamp}.json`, JSON.stringify({ summary, rows, gen, messy }, null, 2));
console.log("\nSUMMARY", JSON.stringify(summary, null, 2));
