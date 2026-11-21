// Builds an independently sourced test set from Shopify's live catalog.
// Ground truth = the merchant's own "Color" option label (not written by us) + the category of the fixed query.
// Usage: node eval/build-testset.mjs [baseUrl]   (app must be running)
import { writeFile } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
// Fixed list chosen before seeing results; first product that has an image and exactly one merchant color is taken.
const QUERIES = [
  ["red hoodie", "hoodie"], ["black denim jacket", "jacket"], ["yellow raincoat", "jacket"],
  ["green crewneck sweatshirt", "sweatshirt"], ["white sneakers", "shoes"], ["navy polo shirt", "shirt"],
  ["pink floral dress", "dress"], ["grey sweatpants", "pants"], ["blue striped shirt", "shirt"],
  ["purple graphic t-shirt", "t-shirt"], ["brown leather jacket", "jacket"], ["orange beanie", "hat"],
];

const out = [];
for (const [query, category] of QUERIES) {
  const form = new FormData();
  form.set("query", query);
  await new Promise((r) => setTimeout(r, 2500)); // anonymous catalog rate limit
  const res = await fetch(`${base}/api/products`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) {
    console.error(`${query}: ${data?.error?.code}`);
    continue;
  }
  const pick = data.products.find((p) => p.imageUrl && p.options.filter((o) => o.name.toLowerCase() === "color").length === 1);
  if (!pick) {
    console.error(`${query}: no product with a single merchant color`);
    continue;
  }
  const color = pick.options.find((o) => o.name.toLowerCase() === "color").label;
  out.push({ query, category, id: pick.id, title: pick.title, merchant: pick.merchant, imageUrl: pick.imageUrl, merchantColor: color });
  console.log(`${query} → ${pick.title} [${color}]`);
}
await writeFile("eval/testset.json", JSON.stringify({ builtAt: new Date().toISOString(), items: out }, null, 2));
console.log(`saved ${out.length} items to eval/testset.json`);
