// Generates the hero showcase images through the app's own /api/generate route.
// Usage: start the app (npm run dev), then: node scripts/generate-showcase.mjs [baseUrl]
import { readFile, writeFile } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const jobs = [
  {
    out: "public/showcase/fashion.png",
    fields: { mode: "fashion", sceneId: "nyc" },
    image: "public/samples/tee-sunset.png",
  },
  {
    out: "public/showcase/imagination.png",
    fields: { mode: "imagination", styleId: "storybook", description: "A cat astronaut with a rocket-shaped suit", sceneId: "space" },
    image: "public/samples/drawing-rocket-cat.png",
  },
];

for (const job of jobs) {
  const form = new FormData();
  for (const [k, v] of Object.entries(job.fields)) form.set(k, v);
  form.set(job.fields.mode === "fashion" ? "garment" : "drawing", new Blob([await readFile(job.image)], { type: "image/png" }), "input.png");
  const t0 = Date.now();
  const res = await fetch(`${base}/api/generate`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) {
    console.error(`${job.out}: ${res.status} ${data?.error?.code}: ${data?.error?.message}`);
    process.exitCode = 1;
    continue;
  }
  const [, mime, b64] = data.image.match(/^data:(.+?);base64,(.+)$/);
  const out = job.out.replace(/\.png$/, mime === "image/jpeg" ? ".jpg" : ".png");
  await writeFile(out, Buffer.from(b64, "base64"));
  console.log(`${out}: ok (${data.model}, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
