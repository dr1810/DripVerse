/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FASHION_SCENES, IMAGINATION_STARTERS, IMAGINATION_STYLES } from "@/lib/prompts";
import { MAX_PROMPT_CHARS, MAX_SCENE_CHARS, type Mode } from "@/lib/validation";
import { prepareImage } from "@/lib/prepareImage";

type Sample = { id: string; label: string; thumb: string; png: string };

const SAMPLE_TEES: Sample[] = [
  { id: "sunset", label: "Sunset pocket tee", thumb: "/samples/tee-sunset.svg", png: "/samples/tee-sunset.png" },
  { id: "midnight", label: "Midnight star tee", thumb: "/samples/tee-midnight.svg", png: "/samples/tee-midnight.png" },
  { id: "sage", label: "Sage stripe tee", thumb: "/samples/tee-sage.svg", png: "/samples/tee-sage.png" },
];
const SAMPLE_DRAWING: Sample = {
  id: "rocket-cat",
  label: "Rocket cat doodle",
  thumb: "/samples/drawing-rocket-cat.svg",
  png: "/samples/drawing-rocket-cat.png",
};

type Picture = { kind: "sample"; sample: Sample } | { kind: "upload"; file: File; previewUrl: string };

type Status =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "done"; image: string; text?: string; model?: string; fallback: boolean }
  | { state: "error"; code: string; message: string };

const ACCEPT = ["image/png", "image/jpeg", "image/webp"];

export default function Studio() {
  const [mode, setMode] = useState<Mode>("fashion");
  const [fashionPic, setFashionPic] = useState<Picture | null>({ kind: "sample", sample: SAMPLE_TEES[0] });
  const [drawingPic, setDrawingPic] = useState<Picture | null>({ kind: "sample", sample: SAMPLE_DRAWING });
  const [sceneId, setSceneId] = useState(FASHION_SCENES[0].id);
  const [customScene, setCustomScene] = useState("");
  const [fashionNotes, setFashionNotes] = useState("");
  const [idea, setIdea] = useState(IMAGINATION_STARTERS[0]);
  const [styleId, setStyleId] = useState<string>(IMAGINATION_STYLES[0].id);
  const [statusBy, setStatusBy] = useState<Record<Mode, Status>>({ fashion: { state: "idle" }, imagination: { state: "idle" } });
  const [inputError, setInputError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<Record<Mode, AbortController | null>>({ fashion: null, imagination: null });
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  const status = statusBy[mode];
  const picture = mode === "fashion" ? fashionPic : drawingPic;
  const setPicture = mode === "fashion" ? setFashionPic : setDrawingPic;
  const setStatusFor = useCallback((m: Mode, s: Status) => setStatusBy((prev) => ({ ...prev, [m]: s })), []);

  // Revoke preview URLs so uploads don't linger in memory.
  useEffect(() => {
    const urls = [fashionPic, drawingPic].flatMap((p) => (p?.kind === "upload" ? [p.previewUrl] : []));
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [fashionPic, drawingPic]);

  // "Try Fashion ›" / "Try Imagination ›" links on the page land here with the right mode.
  useEffect(() => {
    function onHash() {
      const h = window.location.hash;
      if (h === "#try-fashion" || h === "#try-imagination") {
        setMode(h === "#try-fashion" ? "fashion" : "imagination");
        setInputError(null);
        sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", "#studio");
      }
    }
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    setInputError(null);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      setInputError("Please choose a PNG, JPEG or WebP image.");
      return;
    }
    setInputError(null);
    setPicture({ kind: "upload", file, previewUrl: URL.createObjectURL(file) });
  }

  const ready = mode === "fashion" ? Boolean(fashionPic) && Boolean(customScene.trim() || sceneId) : Boolean(drawingPic) || Boolean(idea.trim());
  const canGenerate = status.state !== "loading" && ready;

  async function generate() {
    if (!canGenerate) return;
    const m = mode;
    setInputError(null);
    setStatusFor(m, { state: "loading" });
    if (window.matchMedia("(max-width: 900px)").matches) {
      stageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    abortRef.current[m]?.abort();
    const controller = new AbortController();
    abortRef.current[m] = controller;
    try {
      const form = new FormData();
      form.set("mode", m);
      if (picture) {
        const blob =
          picture.kind === "sample"
            ? await prepareImage(picture.sample.png, { photo: false })
            : await prepareImage(picture.file, { photo: m === "fashion" });
        form.set("image", blob, blob.type === "image/png" ? "input.png" : "input.jpg");
      }
      if (m === "fashion") {
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
        setStatusFor(m, { state: "done", image: data.image, text: data.text, model: data.model, fallback: false });
        return;
      }
      const code: string = data?.error?.code ?? "provider_error";
      if (code === "missing_key") {
        setStatusFor(m, { state: "done", image: `/samples/fallback-${m}.svg`, fallback: true });
        return;
      }
      setStatusFor(m, { state: "error", code, message: data?.error?.message ?? "Something went wrong. Please retry." });
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error && err.message ? err.message : "Network error. Please retry.";
      setStatusFor(m, { state: "error", code: "client", message });
    }
  }

  const retryable = status.state === "error" && !["invalid_input", "blocked", "bad_key"].includes(status.code);
  const previewSrc = picture ? (picture.kind === "sample" ? picture.sample.thumb : picture.previewUrl) : null;

  return (
    <section id="studio" ref={sectionRef} className="studio" aria-labelledby="studio-h">
      <div className="studioHead">
        <h2 id="studio-h">Start creating.</h2>
        <p className="lede">Choose a mode, start from a sample or your own image, then press Generate.</p>
        <div className="segmented" role="tablist" aria-label="Mode" data-mode={mode}>
          <span className="segThumb" aria-hidden />
          <button role="tab" aria-selected={mode === "fashion"} onClick={() => switchMode("fashion")}>
            Fashion
          </button>
          <button role="tab" aria-selected={mode === "imagination"} onClick={() => switchMode("imagination")}>
            Imagination
          </button>
        </div>
      </div>

      <div className="workspace" key={mode}>
        <div className="controls">
          <div className="group">
            <h3>
              <span className="num">1</span>
              {mode === "fashion" ? "Choose a garment" : "Add a drawing"}
              {mode === "imagination" && <em>optional</em>}
            </h3>
            {mode === "imagination" && <p className="note">Drawings only. No photos of people or personal details.</p>}
            <div className="samples">
              {(mode === "fashion" ? SAMPLE_TEES : [SAMPLE_DRAWING]).map((s) => {
                const on = picture?.kind === "sample" && picture.sample.id === s.id;
                return (
                  <button
                    key={s.id}
                    className={`sample ${on ? "on" : ""}`}
                    aria-pressed={on}
                    onClick={() => setPicture(on && mode === "imagination" ? null : { kind: "sample", sample: s })}
                  >
                    <img src={s.thumb} alt="" />
                    <span>{s.label}</span>
                  </button>
                );
              })}
              {picture?.kind === "upload" ? (
                <button className="sample on" onClick={() => setPicture(null)} aria-label="Remove your upload">
                  <img src={picture.previewUrl} alt="" />
                  <span>Your upload ✕</span>
                </button>
              ) : (
                <button className="sample upload" onClick={() => fileRef.current?.click()}>
                  <span className="plus" aria-hidden>
                    +
                  </span>
                  <span>Upload your own</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept={ACCEPT.join(",")} hidden onChange={onFile} />
            </div>
          </div>

          {mode === "fashion" ? (
            <div className="group">
              <h3>
                <span className="num">2</span>Pick a scene
              </h3>
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
                <span>Or describe your own scene</span>
                <input
                  className="text"
                  value={customScene}
                  maxLength={MAX_SCENE_CHARS}
                  placeholder="A misty forest trail at sunrise"
                  onChange={(e) => setCustomScene(e.target.value)}
                />
              </label>
              <label className="field">
                <span>
                  Styling notes <em>optional</em>
                </span>
                <textarea
                  className="text"
                  value={fashionNotes}
                  maxLength={MAX_PROMPT_CHARS}
                  rows={2}
                  placeholder="Wide-leg denim, relaxed pose"
                  onChange={(e) => setFashionNotes(e.target.value)}
                />
              </label>
            </div>
          ) : (
            <>
              <div className="group">
                <h3>
                  <span className="num">2</span>Describe the idea
                </h3>
                <div className="chips">
                  {IMAGINATION_STARTERS.map((s) => (
                    <button key={s} className={`chip ${idea === s ? "on" : ""}`} onClick={() => setIdea(s)}>
                      {s}
                    </button>
                  ))}
                </div>
                <label className="field">
                  <span>Your idea</span>
                  <textarea
                    className="text"
                    value={idea}
                    maxLength={MAX_PROMPT_CHARS}
                    rows={2}
                    placeholder="A short, fictional idea"
                    onChange={(e) => setIdea(e.target.value)}
                  />
                </label>
                <small className="count">
                  {idea.length}/{MAX_PROMPT_CHARS}
                </small>
              </div>
              <div className="group">
                <h3>
                  <span className="num">3</span>Style
                </h3>
                <div className="chips">
                  {IMAGINATION_STYLES.map((s) => (
                    <button key={s.id} className={`chip ${styleId === s.id ? "on" : ""}`} onClick={() => setStyleId(s.id)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {inputError && (
            <p className="inlineError" role="alert">
              {inputError}
            </p>
          )}

          <div className="generateBar">
            <button className="generate" onClick={generate} disabled={!canGenerate}>
              {status.state === "loading" ? <span className="dots">Generating</span> : "Generate"}
            </button>
          </div>
        </div>

        <div className="stageCol">
          <div ref={stageRef} className={`stage s-${status.state}`} aria-live="polite" aria-busy={status.state === "loading"}>
            {status.state === "idle" && (
              <div className="idle">
                {previewSrc && <img className="ghost" src={previewSrc} alt="" />}
                <p>{mode === "fashion" ? "Your editorial shot appears here." : "Your storybook scene appears here."}</p>
              </div>
            )}
            {status.state === "loading" && (
              <div className="idle loadingState">
                {previewSrc && <img className="ghost pulse" src={previewSrc} alt="" />}
                <p>{mode === "fashion" ? "Setting the scene…" : "Painting your world…"} Usually 10–30 seconds.</p>
              </div>
            )}
            {status.state === "error" && (
              <div className="errorBox" role="alert">
                <h4>Couldn&apos;t generate</h4>
                <p>{status.message}</p>
                {retryable && (
                  <button className="pill" onClick={generate}>
                    Try again
                  </button>
                )}
              </div>
            )}
            {status.state === "done" && (
              <img key={status.image.slice(-32)} className="result" src={status.image} alt={status.fallback ? "Sample placeholder" : "Generated image"} />
            )}
          </div>
          {status.state === "done" && (
            <div className="resultMeta">
              {status.fallback ? (
                <p className="fallbackBanner">Sample result (fallback): not generated live. The server has no GEMINI_API_KEY.</p>
              ) : (
                <p className="muted">Generated live · {status.model}</p>
              )}
              {status.text && <p className="muted small">{status.text}</p>}
              <div className="actions">
                <button className="pill" onClick={generate}>
                  Regenerate
                </button>
                {!status.fallback && (
                  <a className="pill ghostPill" href={status.image} download={`dripverse-${mode}.png`}>
                    Download
                  </a>
                )}
              </div>
            </div>
          )}
          {mode === "fashion" && (
            <p className="comingSoon">
              <strong>Coming soon:</strong> matching pieces from Shopify, with suggested prices.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
