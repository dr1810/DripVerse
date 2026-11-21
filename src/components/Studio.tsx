"use client";

import { useEffect, useRef, useState } from "react";
import { FASHION_SCENES, IMAGINATION_STARTERS, IMAGINATION_STYLES } from "@/lib/prompts";
import { MAX_PROMPT_CHARS, MAX_SCENE_CHARS, type Mode } from "@/lib/validation";
import { prepareImage } from "@/lib/prepareImage";

type Sample = { id: string; label: string; src: string };

const SAMPLE_TEES: Sample[] = [
  { id: "sunset", label: "Sunset pocket tee", src: "/samples/tee-sunset.svg" },
  { id: "midnight", label: "Midnight star tee", src: "/samples/tee-midnight.svg" },
  { id: "sage", label: "Sage stripe tee", src: "/samples/tee-sage.svg" },
];
const SAMPLE_DRAWING: Sample = { id: "rocket-cat", label: "Rocket cat doodle", src: "/samples/drawing-rocket-cat.svg" };

type Picture = { kind: "sample"; sample: Sample } | { kind: "upload"; file: File; previewUrl: string };

type Status =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "done"; image: string; text?: string; model?: string; fallback: boolean }
  | { state: "error"; code: string; message: string };

const FLOW = [
  { label: "Create profile", status: "later" },
  { label: "Main page", status: "live" },
  { label: "Generate scenery", status: "live" },
  { label: "Shopify picks", status: "later" },
  { label: "Shop & buy", status: "later" },
] as const;

export default function Studio() {
  const [mode, setMode] = useState<Mode>("fashion");
  const [fashionPic, setFashionPic] = useState<Picture | null>({ kind: "sample", sample: SAMPLE_TEES[0] });
  const [drawingPic, setDrawingPic] = useState<Picture | null>(null);
  const [sceneId, setSceneId] = useState(FASHION_SCENES[0].id);
  const [customScene, setCustomScene] = useState("");
  const [fashionNotes, setFashionNotes] = useState("");
  const [idea, setIdea] = useState("");
  const [styleId, setStyleId] = useState<string>(IMAGINATION_STYLES[0].id);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [inputError, setInputError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLElement>(null);

  const picture = mode === "fashion" ? fashionPic : drawingPic;
  const setPicture = mode === "fashion" ? setFashionPic : setDrawingPic;

  // Revoke preview URLs so uploads don't linger in memory.
  useEffect(() => {
    const urls = [fashionPic, drawingPic].flatMap((p) => (p?.kind === "upload" ? [p.previewUrl] : []));
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [fashionPic, drawingPic]);

  function switchMode(next: Mode) {
    if (next === mode) return;
    abortRef.current?.abort();
    setMode(next);
    setStatus({ state: "idle" });
    setInputError(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setInputError("Please choose a PNG, JPEG or WebP image.");
      return;
    }
    setInputError(null);
    setPicture({ kind: "upload", file, previewUrl: URL.createObjectURL(file) });
  }

  const canGenerate =
    status.state !== "loading" &&
    (mode === "fashion" ? Boolean(fashionPic) && Boolean(customScene.trim() || sceneId) : Boolean(drawingPic) || Boolean(idea.trim()));

  async function generate() {
    if (!canGenerate) return;
    setInputError(null);
    setStatus({ state: "loading" });
    if (window.matchMedia("(max-width: 860px)").matches) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const thisMode = mode;
    try {
      const form = new FormData();
      form.set("mode", thisMode);
      if (picture) {
        const blob =
          picture.kind === "sample"
            ? await prepareImage(picture.sample.src, { photo: false })
            : await prepareImage(picture.file, { photo: thisMode === "fashion" });
        form.set("image", blob, blob.type === "image/png" ? "input.png" : "input.jpg");
      }
      if (thisMode === "fashion") {
        form.set("sceneId", sceneId);
        form.set("scene", customScene);
        form.set("prompt", fashionNotes);
      } else {
        form.set("prompt", idea);
        form.set("styleId", styleId);
      }
      const res = await fetch("/api/generate", { method: "POST", body: form, signal: controller.signal });
      const data = await res.json().catch(() => null);
      if (controller.signal.aborted) return;
      if (res.ok && data?.image) {
        setStatus({ state: "done", image: data.image, text: data.text, model: data.model, fallback: false });
        return;
      }
      const code: string = data?.error?.code ?? "provider_error";
      if (code === "missing_key") {
        // Clearly-labelled sample so the demo flow stays visible without a key.
        setStatus({ state: "done", image: `/samples/fallback-${thisMode}.svg`, fallback: true });
        return;
      }
      setStatus({ state: "error", code, message: data?.error?.message ?? "Something went wrong. Please retry." });
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error && err.message ? err.message : "Network error. Please retry.";
      setStatus({ state: "error", code: "client", message });
    }
  }

  const retryable = status.state === "error" && !["invalid_input", "blocked", "bad_key"].includes(status.code);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden>
            ◆
          </span>
          DripVerse
        </div>
        <div className="modeSwitch" role="tablist" aria-label="Mode">
          <button role="tab" aria-selected={mode === "fashion"} className={mode === "fashion" ? "on" : ""} onClick={() => switchMode("fashion")}>
            👕 Fashion
          </button>
          <button
            role="tab"
            aria-selected={mode === "imagination"}
            className={mode === "imagination" ? "on" : ""}
            onClick={() => switchMode("imagination")}
          >
            ✏️ Imagination
          </button>
        </div>
      </header>

      <ol className="flow" aria-label="DripVerse flow">
        {FLOW.map((f) => (
          <li key={f.label} className={f.status}>
            {f.label}
            {f.status === "later" && <span className="tag">soon</span>}
          </li>
        ))}
      </ol>

      <main className="grid">
        <section className="panel" aria-labelledby="create-h">
          <h2 id="create-h">{mode === "fashion" ? "Style a garment" : "Bring an idea to life"}</h2>
          <p className="hint">
            {mode === "fashion"
              ? "Pick a sample tee or upload a clothing photo, then choose a scene."
              : "Upload a drawing, write a short idea, or both. Keep it fictional: drawings only, no photos of people or personal details."}
          </p>

          <h3>Picture</h3>
          <div className="pictures">
            {mode === "fashion" ? (
              SAMPLE_TEES.map((s) => (
                <button
                  key={s.id}
                  className={`thumb ${picture?.kind === "sample" && picture.sample.id === s.id ? "selected" : ""}`}
                  onClick={() => setPicture({ kind: "sample", sample: s })}
                  aria-pressed={picture?.kind === "sample" && picture.sample.id === s.id}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.src} alt="" />
                  <span>{s.label}</span>
                </button>
              ))
            ) : (
              <button
                className={`thumb ${picture?.kind === "sample" ? "selected" : ""}`}
                onClick={() => setPicture(picture?.kind === "sample" ? null : { kind: "sample", sample: SAMPLE_DRAWING })}
                aria-pressed={picture?.kind === "sample"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={SAMPLE_DRAWING.src} alt="" />
                <span>{SAMPLE_DRAWING.label}</span>
              </button>
            )}
            {picture?.kind === "upload" ? (
              <button className="thumb selected" onClick={() => setPicture(null)} aria-label="Remove uploaded image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={picture.previewUrl} alt="" />
                <span>Your upload ✕</span>
              </button>
            ) : (
              <button className="thumb upload" onClick={() => fileRef.current?.click()}>
                <span className="plus">＋</span>
                <span>{mode === "fashion" ? "Upload garment" : "Upload drawing"}</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={onFile} />
          </div>

          {mode === "fashion" ? (
            <>
              <h3>Scene</h3>
              <div className="chips">
                {FASHION_SCENES.map((s) => (
                  <button
                    key={s.id}
                    className={`chip ${!customScene.trim() && sceneId === s.id ? "on" : ""}`}
                    onClick={() => {
                      setSceneId(s.id);
                      setCustomScene("");
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <label className="field">
                <span>…or describe your own scene</span>
                <input
                  value={customScene}
                  maxLength={MAX_SCENE_CHARS}
                  placeholder="e.g. a misty forest trail at sunrise"
                  onChange={(e) => setCustomScene(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Styling notes (optional)</span>
                <textarea
                  value={fashionNotes}
                  maxLength={MAX_PROMPT_CHARS}
                  rows={2}
                  placeholder="e.g. paired with wide-leg denim, relaxed pose"
                  onChange={(e) => setFashionNotes(e.target.value)}
                />
                <small>
                  {fashionNotes.length}/{MAX_PROMPT_CHARS}
                </small>
              </label>
            </>
          ) : (
            <>
              <h3>Idea starters</h3>
              <div className="chips">
                {IMAGINATION_STARTERS.map((s) => (
                  <button key={s} className={`chip ${idea === s ? "on" : ""}`} onClick={() => setIdea(s)}>
                    {s}
                  </button>
                ))}
              </div>
              <label className="field">
                <span>Describe your idea</span>
                <textarea
                  value={idea}
                  maxLength={MAX_PROMPT_CHARS}
                  rows={3}
                  placeholder="A short, fictional description"
                  onChange={(e) => setIdea(e.target.value)}
                />
                <small>
                  {idea.length}/{MAX_PROMPT_CHARS}
                </small>
              </label>
              <h3>Style</h3>
              <div className="chips">
                {IMAGINATION_STYLES.map((s) => (
                  <button key={s.id} className={`chip ${styleId === s.id ? "on" : ""}`} onClick={() => setStyleId(s.id)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {inputError && (
            <p className="inlineError" role="alert">
              {inputError}
            </p>
          )}

          <button className="generate" onClick={generate} disabled={!canGenerate}>
            {status.state === "loading" ? "Generating…" : "✨ Generate"}
          </button>
        </section>

        <section ref={resultRef} className="panel result" aria-labelledby="result-h" aria-live="polite" aria-busy={status.state === "loading"}>
          <h2 id="result-h">{mode === "fashion" ? "Your scenery" : "Your illustration"}</h2>
          <div className="stage">
            {status.state === "idle" && <p className="placeholder">Your image will appear here.</p>}
            {status.state === "loading" && (
              <div className="loading">
                <div className="spinner" />
                <p>Creating your {mode === "fashion" ? "editorial shot" : "storybook art"}… this can take 10–30 seconds.</p>
              </div>
            )}
            {status.state === "error" && (
              <div className="errorBox" role="alert">
                <p>
                  <strong>Couldn&apos;t generate.</strong> {status.message}
                </p>
                {retryable && (
                  <button className="secondary" onClick={generate}>
                    ↻ Retry
                  </button>
                )}
              </div>
            )}
            {status.state === "done" && (
              <figure>
                {status.fallback && (
                  <div className="fallbackBanner">SAMPLE RESULT (fallback): not generated live. The server has no GEMINI_API_KEY.</div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={status.image} alt={status.fallback ? "Sample placeholder image" : "Generated image"} />
                <figcaption>
                  {!status.fallback && status.model && <span>Generated live with {status.model}</span>}
                  {status.text && <span className="modelText">{status.text}</span>}
                </figcaption>
                <div className="actions">
                  <button className="secondary" onClick={generate}>
                    ↻ Regenerate
                  </button>
                  {!status.fallback && (
                    <a className="secondary" href={status.image} download={`dripverse-${mode}.png`}>
                      ⬇ Download
                    </a>
                  )}
                </div>
              </figure>
            )}
          </div>

          {mode === "fashion" && (
            <div className="comingSoon">
              <h3>Recommended products</h3>
              <p>Coming next: matching pieces from Shopify, with suggested prices and a buy button.</p>
            </div>
          )}
        </section>
      </main>

      <footer className="footer">Images are created on request and are not stored. Sample garments and drawings are fictional.</footer>
    </div>
  );
}
