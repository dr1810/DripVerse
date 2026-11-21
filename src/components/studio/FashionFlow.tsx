/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import type { Evaluation, Interpretation } from "@/lib/ai/types";
import { MODEL_ROLES } from "@/lib/models";
import { FASHION_SCENES } from "@/lib/prompts";
import type { ClothingProduct } from "@/lib/shopify/types";
import { MAX_PROMPT_CHARS, MAX_SCENE_CHARS } from "@/lib/validation";
import { prepareImage } from "@/lib/prepareImage";
import { NON_RETRYABLE, postForm, type ApiError } from "./api";
import EvaluationCard from "./EvaluationCard";
import ProductCard from "./ProductCard";
import SketchPad, { type SketchPadHandle } from "./SketchPad";

type Sample = { id: string; label: string; thumb: string; png: string; query: string };
const SAMPLES: Sample[] = [
  { id: "sunset", label: "Orange pocket tee", thumb: "/samples/tee-sunset.svg", png: "/samples/tee-sunset.png", query: "orange pocket t-shirt" },
  { id: "midnight", label: "Navy star tee", thumb: "/samples/tee-midnight.svg", png: "/samples/tee-midnight.png", query: "navy star graphic t-shirt" },
  { id: "sage", label: "Sage stripe tee", thumb: "/samples/tee-sage.svg", png: "/samples/tee-sage.png", query: "sage green striped t-shirt" },
];

type Source = "photo" | "draw" | "describe";
type Step = "idle" | "running" | "done" | "error" | "skipped";
type Shot = { image: string; sceneLabel: string; product?: ClothingProduct; evaluation?: Evaluation; evalError?: string };

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];

export default function FashionFlow() {
  const [source, setSource] = useState<Source>("photo");
  const [sample, setSample] = useState<Sample | null>(SAMPLES[0]);
  const [upload, setUpload] = useState<{ file: File; url: string } | null>(null);
  const [selfie, setSelfie] = useState<{ file: File; url: string } | null>(null);
  const [description, setDescription] = useState("");
  const [sceneId, setSceneId] = useState(FASHION_SCENES[0].id);
  const [customScene, setCustomScene] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  const [steps, setSteps] = useState<Record<"interpret" | "search" | "generate" | "evaluate", Step>>({
    interpret: "idle",
    search: "idle",
    generate: "idle",
    evaluate: "idle",
  });
  const [interp, setInterp] = useState<Interpretation | null>(null);
  const [interpError, setInterpError] = useState<ApiError | null>(null);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<ClothingProduct[] | null>(null);
  const [searchError, setSearchError] = useState<ApiError | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selected, setSelected] = useState<ClothingProduct | null>(null);
  const [genError, setGenError] = useState<ApiError | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [active, setActive] = useState(0);

  const sketchRef = useRef<SketchPadHandle>(null);
  const garmentBlob = useRef<Blob | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selfieRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const productsRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    for (const u of [upload, selfie]) if (u) URL.revokeObjectURL(u.url);
  }, [upload, selfie]);

  const sceneLabel = customScene.trim() || FASHION_SCENES.find((s) => s.id === sceneId)?.label || "";
  const busy = Object.values(steps).includes("running");
  const shot = shots[active];

  function pick(e: React.ChangeEvent<HTMLInputElement>, set: (v: { file: File; url: string } | null) => void) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPT.includes(file.type)) return setInputError("Please choose a PNG, JPEG or WebP image.");
    setInputError(null);
    set({ file, url: URL.createObjectURL(file) });
  }

  async function garment(): Promise<Blob | null> {
    if (source === "photo") {
      if (upload) return prepareImage(upload.file, { photo: true });
      if (sample) return prepareImage(sample.png, { photo: false });
      return null;
    }
    if (source === "draw") return sketchRef.current && !sketchRef.current.isEmpty() ? sketchRef.current.toBlob() : null;
    return null;
  }

  function sceneFields(form: FormData) {
    form.set("sceneId", sceneId);
    form.set("scene", customScene);
  }

  async function runSearch(q: string, img: Blob | null) {
    setSteps((s) => ({ ...s, search: "running" }));
    setSearchError(null);
    setProducts(null);
    setSelected(null);
    const form = new FormData();
    form.set("query", q);
    if (img) {
      form.set("useImage", "1");
      form.set("image", img, "garment.png");
    }
    const r = await postForm<{ products: ClothingProduct[]; warnings: string[] }>("/api/products", form);
    if (!r.ok) {
      setSearchError(r.error);
      setSteps((s) => ({ ...s, search: "error" }));
      return;
    }
    setProducts(r.data.products);
    setWarnings(r.data.warnings ?? []);
    setSelected(r.data.products[0] ?? null);
    setSteps((s) => ({ ...s, search: "done" }));
  }

  async function findIt() {
    setInputError(null);
    let img: Blob | null = null;
    try {
      img = await garment();
    } catch (err) {
      return setInputError(err instanceof Error ? err.message : "Couldn't read that image.");
    }
    if (!img && !description.trim()) return setInputError("Add a garment photo, a drawing, or a description first.");
    garmentBlob.current = img;
    setInterp(null);
    setInterpError(null);
    setSteps({ interpret: "running", search: "idle", generate: "idle", evaluate: "idle" });
    productsRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });

    const form = new FormData();
    form.set("mode", "fashion");
    form.set("description", description);
    if (img) form.set("image", img, "garment.png");
    sceneFields(form);
    const r = await postForm<Interpretation>("/api/interpret", form);
    let q: string;
    if (r.ok) {
      setInterp(r.data);
      setSteps((s) => ({ ...s, interpret: "done" }));
      q = r.data.search.query;
    } else {
      // Truthful fallback: say interpretation failed, then search with the shopper's own words.
      setInterpError(r.error);
      setSteps((s) => ({ ...s, interpret: "error" }));
      q = description.trim() || (source === "photo" && !upload && sample ? sample.query : "");
      if (!q) return;
    }
    setQuery(q);
    await runSearch(q, source === "photo" ? img : null);
  }

  async function evaluate(image: string, product: ClothingProduct | undefined, index: number) {
    setSteps((s) => ({ ...s, evaluate: "running" }));
    const form = new FormData();
    form.set("kind", "product");
    form.set("generated", image);
    if (product?.imageUrl) form.set("referenceUrl", product.imageUrl);
    else if (garmentBlob.current) form.set("reference", garmentBlob.current, "garment.png");
    else return setSteps((s) => ({ ...s, evaluate: "skipped" }));
    if (interp) form.set("expected", [interp.garment.description, interp.garment.details.join(", ")].filter(Boolean).join(" | "));
    const r = await postForm<Evaluation>("/api/evaluate", form);
    setShots((all) => all.map((sh, i) => (i === index ? { ...sh, evaluation: r.ok ? r.data : undefined, evalError: r.ok ? undefined : r.error.message } : sh)));
    setSteps((s) => ({ ...s, evaluate: r.ok ? "done" : "error" }));
  }

  async function generate(opts: { feedback?: string; useOwnGarment?: boolean } = {}) {
    const product = opts.useOwnGarment ? undefined : (selected ?? undefined);
    if (!product?.imageUrl && !garmentBlob.current) return setGenError({ code: "invalid_input", message: "Select a product with an image first." });
    setGenError(null);
    setSteps((s) => ({ ...s, generate: "running", evaluate: "idle" }));
    if (window.matchMedia("(max-width: 900px)").matches) stageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const form = new FormData();
    form.set("mode", "fashion");
    sceneFields(form);
    if (product?.imageUrl) {
      form.set("productImageUrl", product.imageUrl);
      form.set("productTitle", product.title);
    } else if (garmentBlob.current) form.set("garment", garmentBlob.current, "garment.png");
    if (interp) form.set("attributes", JSON.stringify(interp.garment));
    if (opts.feedback) form.set("feedback", opts.feedback);
    if (selfie) {
      try {
        form.set("selfie", await prepareImage(selfie.file, { photo: true }), "selfie.jpg");
      } catch {
        /* selfie optional */
      }
    }
    const r = await postForm<{ image: string; model: string }>("/api/generate", form);
    if (!r.ok) {
      setGenError(r.error);
      setSteps((s) => ({ ...s, generate: "error" }));
      return;
    }
    const index = shots.length;
    setShots((all) => [...all, { image: r.data.image, sceneLabel, product }]);
    setActive(index);
    setSteps((s) => ({ ...s, generate: "done" }));
    await evaluate(r.data.image, product, index);
  }

  const STEP_LABELS: [keyof typeof steps, string, string][] = [
    ["interpret", "Read your style", MODEL_ROLES.interpret.name],
    ["search", "Find it on Shopify", "Shopify Catalog"],
    ["generate", "Generate your universe", MODEL_ROLES.image.name],
    ["evaluate", "Check the garment", MODEL_ROLES.evaluate.name],
  ];

  return (
    <div className="workspace">
      <div className="controls">
        <div className="group">
          <h3>
            <span className="num">1</span>Your clothing
          </h3>
          <div className="tabs" role="tablist" aria-label="Clothing input">
            {(["photo", "draw", "describe"] as Source[]).map((s) => (
              <button key={s} role="tab" aria-selected={source === s} className={source === s ? "on" : ""} onClick={() => setSource(s)}>
                {s === "photo" ? "Photo" : s === "draw" ? "Draw" : "Describe"}
              </button>
            ))}
          </div>
          {source === "photo" && (
            <div className="samples">
              {SAMPLES.map((s) => {
                const on = !upload && sample?.id === s.id;
                return (
                  <button key={s.id} className={`sample ${on ? "on" : ""}`} aria-pressed={on} onClick={() => (setUpload(null), setSample(s))}>
                    <img src={s.thumb} alt="" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
              {upload ? (
                <button className="sample on" onClick={() => setUpload(null)} aria-label="Remove your upload">
                  <img src={upload.url} alt="" />
                  <span>Your photo ✕</span>
                </button>
              ) : (
                <button className="sample upload" onClick={() => fileRef.current?.click()}>
                  <span className="plus" aria-hidden>
                    +
                  </span>
                  <span>Upload a tee</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept={ACCEPT.join(",")} hidden onChange={(e) => pick(e, setUpload)} />
            </div>
          )}
          {source === "draw" && <SketchPad ref={sketchRef} />}
          <label className="field">
            <span>{source === "describe" ? "Describe the clothing" : "Anything to add?"}</span>
            <textarea
              className="text"
              rows={2}
              maxLength={MAX_PROMPT_CHARS}
              value={description}
              placeholder={source === "describe" ? "An oversized black tee with a neon green lightning bolt" : "Optional, e.g. oversized fit"}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="selfieRow">
            {selfie ? (
              <>
                <img src={selfie.url} alt="Your selfie" />
                <span>Your photo is used for this image only and never stored.</span>
                <button className="linkBtn" onClick={() => setSelfie(null)}>
                  Remove
                </button>
              </>
            ) : (
              <button className="linkBtn" onClick={() => selfieRef.current?.click()}>
                + Add yourself (optional selfie, adults only)
              </button>
            )}
            <input ref={selfieRef} type="file" accept={ACCEPT.join(",")} hidden onChange={(e) => pick(e, setSelfie)} />
          </div>
        </div>

        <div className="group">
          <h3>
            <span className="num">2</span>Pick a scene
          </h3>
          <div className="chips">
            {FASHION_SCENES.map((s) => (
              <button key={s.id} className={`chip ${!customScene.trim() && sceneId === s.id ? "on" : ""}`} onClick={() => (setSceneId(s.id), setCustomScene(""))}>
                {s.label}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Or describe your own</span>
            <input className="text" value={customScene} maxLength={MAX_SCENE_CHARS} placeholder="A futuristic concert on Mars" onChange={(e) => setCustomScene(e.target.value)} />
          </label>
        </div>

        {inputError && (
          <p className="inlineError" role="alert">
            {inputError}
          </p>
        )}
        <button className="generate secondaryGen" onClick={findIt} disabled={busy}>
          {steps.interpret === "running" ? <span className="dots">Reading your style</span> : steps.search === "running" ? <span className="dots">Searching Shopify</span> : "Find it on Shopify"}
        </button>

        <div ref={productsRef} className="group findings" aria-live="polite">
          {interp && (
            <div className="interp">
              <p className="interpHead">
                <span className="badge">{interp.model}</span> sees
              </p>
              <p className="interpDesc">{interp.garment.description}</p>
              <div className="tags">
                {[interp.garment.category, ...interp.garment.colors, interp.garment.pattern, interp.garment.style, ...interp.garment.details]
                  .filter(Boolean)
                  .slice(0, 9)
                  .map((t, i) => (
                    <span key={t + i} className="tag">
                      {t}
                    </span>
                  ))}
              </div>
              {interp.confidence < 0.6 && (
                <p className="note">Low confidence ({Math.round(interp.confidence * 100)}%){interp.ambiguities.length ? `: ${interp.ambiguities.join("; ")}` : ""}</p>
              )}
            </div>
          )}
          {interpError && (
            <p className="inlineWarn">
              Gemini interpretation failed: {interpError.message}
              {query ? " Searched Shopify with your own words instead." : " Add a description to search Shopify without it."}
            </p>
          )}
          {(steps.search !== "idle" || products) && (
            <form
              className="queryRow"
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim()) runSearch(query.trim(), source === "photo" ? garmentBlob.current : null);
              }}
            >
              <label className="visually-hidden" htmlFor="q">
                Shopify search
              </label>
              <input id="q" className="text" value={query} maxLength={120} onChange={(e) => setQuery(e.target.value)} />
              <button className="pill" disabled={busy || !query.trim()}>
                Search
              </button>
            </form>
          )}
          {steps.search === "running" && (
            <div className="productGrid">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="product skeleton" />
              ))}
            </div>
          )}
          {searchError && (
            <div className="errorInline" role="alert">
              <p>Shopify search failed: {searchError.message}</p>
              {!NON_RETRYABLE.has(searchError.code) && (
                <button className="pill" onClick={() => runSearch(query, source === "photo" ? garmentBlob.current : null)}>
                  Try again
                </button>
              )}
            </div>
          )}
          {products && products.length === 0 && <p className="note">No matching products on Shopify. Try different words.</p>}
          {products && products.length > 0 && (
            <>
              <h3>
                <span className="num">3</span>Choose a real product
              </h3>
              {warnings.map((w) => (
                <p key={w} className="inlineWarn">
                  {w}
                </p>
              ))}
              <div className="productGrid">
                {products.map((p) => (
                  <ProductCard key={p.id} p={p} selected={selected?.id === p.id} onSelect={() => setSelected(p)} />
                ))}
              </div>
              <p className="fine">Live results from Shopify&apos;s catalog. Prices and stock are set by each store. Check size and fit on the store page.</p>
            </>
          )}
        </div>

        <div className="generateBar">
          <button className="generate" onClick={() => generate()} disabled={busy || !selected?.imageUrl}>
            {steps.generate === "running" ? <span className="dots">Generating your universe</span> : "Generate my universe"}
          </button>
          {!selected && garmentBlob.current && steps.search !== "running" && (
            <button className="linkBtn center" onClick={() => generate({ useOwnGarment: true })} disabled={busy}>
              Skip shopping and use my own garment
            </button>
          )}
        </div>
      </div>

      <div className="stageCol">
        <ol className="pipeline" aria-label="Progress">
          {STEP_LABELS.map(([k, label, who]) => (
            <li key={k} className={`ps-${steps[k]}`}>
              <span className="dot" aria-hidden />
              <span>
                {label}
                <small>{who}</small>
              </span>
            </li>
          ))}
        </ol>
        <div ref={stageRef} className={`stage s-${steps.generate === "running" ? "loading" : shot ? "done" : "idle"}`} aria-live="polite" aria-busy={steps.generate === "running"}>
          {steps.generate === "running" ? (
            <div className="idle loadingState">
              {selected?.imageUrl && <img className="ghost pulse" src={selected.imageUrl} alt="" />}
              <p>Dressing you for {sceneLabel}. Usually 10 to 30 seconds.</p>
            </div>
          ) : genError ? (
            <div className="errorBox" role="alert">
              <h4>Couldn&apos;t generate</h4>
              <p>{genError.message}</p>
              {!NON_RETRYABLE.has(genError.code) && (
                <button className="pill" onClick={() => generate()}>
                  Try again
                </button>
              )}
            </div>
          ) : shot ? (
            <img key={shot.image.slice(-24)} className="result" src={shot.image} alt={`Generated scene: ${shot.sceneLabel}`} />
          ) : (
            <div className="idle">
              {selected?.imageUrl ? <img className="ghost" src={selected.imageUrl} alt="" /> : null}
              <p>{selected ? `Ready: ${selected.title}` : "Find a real product, then generate your universe."}</p>
            </div>
          )}
        </div>

        {shot && (
          <div className="resultMeta">
            <p className="muted">
              {shot.sceneLabel} · generated live with {MODEL_ROLES.image.name}
            </p>
            {shot.product && (
              <a className="shopLink" href={shot.product.productUrl} target="_blank" rel="noopener noreferrer">
                {shot.product.imageUrl && <img src={shot.product.imageUrl} alt="" />}
                <span>
                  <b>{shot.product.title}</b>
                  <small>
                    {shot.product.price ?? "See price"} at {shot.product.merchant} ↗
                  </small>
                </span>
              </a>
            )}
            {steps.evaluate === "running" && active === shots.length - 1 && <p className="muted">{MODEL_ROLES.evaluate.name} is checking the garment…</p>}
            {shot.evaluation && <EvaluationCard ev={shot.evaluation} />}
            {shot.evalError && <p className="inlineWarn">Fidelity check failed: {shot.evalError}</p>}
            <div className="actions">
              {shot.evaluation?.feedback && shot.evaluation.overallScore < 90 && (
                <button className="pill" disabled={busy} onClick={() => generate({ feedback: shot.evaluation!.feedback })}>
                  Apply feedback and regenerate
                </button>
              )}
              <a className="pill ghostPill" href={shot.image} download="dripverse.png">
                Download
              </a>
            </div>
          </div>
        )}

        {shots.length > 1 && (
          <div className="alts">
            <p className="muted">Your universes</p>
            <div className="altRow">
              {shots.map((sh, i) => (
                <button key={i} className={`alt ${i === active ? "on" : ""}`} onClick={() => setActive(i)} aria-label={`Show ${sh.sceneLabel}`}>
                  <img src={sh.image} alt="" />
                  <span>
                    {sh.sceneLabel}
                    {sh.evaluation ? ` · ${sh.evaluation.overallScore}` : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
