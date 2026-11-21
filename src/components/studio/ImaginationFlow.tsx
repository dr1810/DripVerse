/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import type { Evaluation, Interpretation } from "@/lib/ai/types";
import { MODEL_ROLES } from "@/lib/models";
import { IMAGINATION_STARTERS, IMAGINATION_STYLES, KID_WORLDS } from "@/lib/prompts";
import { MAX_PROMPT_CHARS, MAX_SCENE_CHARS } from "@/lib/validation";
import { prepareImage } from "@/lib/prepareImage";
import { NON_RETRYABLE, postForm, type ApiError } from "./api";
import EvaluationCard from "./EvaluationCard";
import SketchPad, { type SketchPadHandle } from "./SketchPad";

const SAMPLE_DRAWING = { thumb: "/samples/drawing-rocket-cat.svg", png: "/samples/drawing-rocket-cat.png" };

type Phase = "idle" | "helping" | "drawing" | "checking" | "done" | "error";

export default function ImaginationFlow() {
  const [source, setSource] = useState<"draw" | "sample" | "upload">("draw");
  const [upload, setUpload] = useState<{ file: File; url: string } | null>(null);
  const [idea, setIdea] = useState("");
  const [worldId, setWorldId] = useState(KID_WORLDS[0].id);
  const [customWorld, setCustomWorld] = useState("");
  const [styleId, setStyleId] = useState<string>(IMAGINATION_STYLES[0].id);
  const [phase, setPhase] = useState<Phase>("idle");
  const [helper, setHelper] = useState<Interpretation | null>(null);
  const [helperError, setHelperError] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const sketchRef = useRef<SketchPadHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    if (upload) URL.revokeObjectURL(upload.url);
  }, [upload]);

  const busy = phase === "helping" || phase === "drawing" || phase === "checking";

  async function drawing(): Promise<Blob | null> {
    if (source === "draw") return sketchRef.current && !sketchRef.current.isEmpty() ? sketchRef.current.toBlob() : null;
    if (source === "sample") return prepareImage(SAMPLE_DRAWING.png, { photo: false });
    return upload ? prepareImage(upload.file, { photo: false }) : null;
  }

  function world(form: FormData) {
    form.set("sceneId", worldId);
    form.set("scene", customWorld);
  }

  async function create() {
    setInputError(null);
    let img: Blob | null;
    try {
      img = await drawing();
    } catch (err) {
      return setInputError(err instanceof Error ? err.message : "Couldn't read that drawing.");
    }
    if (!img && !idea.trim()) return setInputError("Draw your outfit or describe it first.");
    setError(null);
    setEvaluation(null);
    setHelperError(null);
    if (window.matchMedia("(max-width: 900px)").matches) stageRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

    // 1. Creative helper (Model A) — optional; generation continues truthfully if it fails.
    setPhase("helping");
    const hf = new FormData();
    hf.set("mode", "imagination");
    hf.set("description", idea);
    if (img) hf.set("image", img, "drawing.png");
    world(hf);
    const h = await postForm<Interpretation>("/api/interpret", hf);
    if (h.ok) setHelper(h.data);
    else {
      setHelper(null);
      setHelperError(h.error.message);
    }

    // 2. Character generation (Nano Banana).
    setPhase("drawing");
    const gf = new FormData();
    gf.set("mode", "imagination");
    gf.set("description", idea);
    gf.set("styleId", styleId);
    world(gf);
    if (img) gf.set("drawing", img, "drawing.png");
    if (h.ok) gf.set("summary", h.data.garment.description);
    const g = await postForm<{ image: string }>("/api/generate", gf);
    if (!g.ok) {
      setError(g.error);
      setPhase("error");
      return;
    }
    setImage(g.data.image);

    // 3. Ideas-kept check (Model B), only when there is a drawing to compare against.
    if (img) {
      setPhase("checking");
      const ef = new FormData();
      ef.set("kind", "drawing");
      ef.set("reference", img, "drawing.png");
      ef.set("generated", g.data.image);
      if (h.ok) ef.set("expected", h.data.garment.description);
      const e = await postForm<Evaluation>("/api/evaluate", ef);
      if (e.ok) setEvaluation(e.data);
    }
    setPhase("done");
  }

  return (
    <div className="workspace">
      <div className="controls">
        <div className="group">
          <h3>
            <span className="num">1</span>Draw your outfit
          </h3>
          <p className="note">Drawings and made-up ideas only. No photos of people.</p>
          <div className="tabs" role="tablist" aria-label="Drawing input">
            {(["draw", "sample", "upload"] as const).map((s) => (
              <button key={s} role="tab" aria-selected={source === s} className={source === s ? "on" : ""} onClick={() => setSource(s)}>
                {s === "draw" ? "Draw" : s === "sample" ? "Sample" : "Upload"}
              </button>
            ))}
          </div>
          {source === "draw" && <SketchPad ref={sketchRef} />}
          {source === "sample" && (
            <div className="samples one">
              <div className="sample on">
                <img src={SAMPLE_DRAWING.thumb} alt="Sample doodle of a cat in a rocket" />
                <span>Rocket cat doodle</span>
              </div>
            </div>
          )}
          {source === "upload" && (
            <div className="samples one">
              {upload ? (
                <button className="sample on" onClick={() => setUpload(null)} aria-label="Remove drawing">
                  <img src={upload.url} alt="" />
                  <span>Your drawing ✕</span>
                </button>
              ) : (
                <button className="sample upload" onClick={() => fileRef.current?.click()}>
                  <span className="plus" aria-hidden>
                    +
                  </span>
                  <span>Upload a drawing</span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) setUpload({ file: f, url: URL.createObjectURL(f) });
                }}
              />
            </div>
          )}
          <label className="field">
            <span>Tell us about it</span>
            <textarea className="text" rows={2} maxLength={MAX_PROMPT_CHARS} value={idea} placeholder="A cape made of rainbows" onChange={(e) => setIdea(e.target.value)} />
          </label>
          <div className="chips small">
            {IMAGINATION_STARTERS.map((s) => (
              <button key={s} className={`chip ${idea === s ? "on" : ""}`} onClick={() => setIdea(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="group">
          <h3>
            <span className="num">2</span>Pick a world
          </h3>
          <div className="chips">
            {KID_WORLDS.map((w) => (
              <button key={w.id} className={`chip ${!customWorld.trim() && worldId === w.id ? "on" : ""}`} onClick={() => (setWorldId(w.id), setCustomWorld(""))}>
                {w.label}
              </button>
            ))}
          </div>
          <label className="field">
            <span>Or make one up</span>
            <input className="text" value={customWorld} maxLength={MAX_SCENE_CHARS} placeholder="A library on a giant turtle" onChange={(e) => setCustomWorld(e.target.value)} />
          </label>
          <div className="chips small">
            {IMAGINATION_STYLES.map((s) => (
              <button key={s.id} className={`chip ${styleId === s.id ? "on" : ""}`} onClick={() => setStyleId(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {inputError && (
          <p className="inlineError" role="alert">
            {inputError}
          </p>
        )}
        <div className="generateBar">
          <button className="generate" onClick={create} disabled={busy}>
            {phase === "helping" ? <span className="dots">Looking at your drawing</span> : phase === "drawing" ? <span className="dots">Creating your character</span> : phase === "checking" ? <span className="dots">Checking your ideas</span> : "Create my character"}
          </button>
        </div>
        <p className="fine">Shopping lives in Fashion Mode and is for grown-ups.</p>
      </div>

      <div className="stageCol">
        {helper && (
          <div className="helper">
            <p className="helperSays">
              <span className="badge">{helper.model}</span> {helper.kidSummary || helper.garment.description}
            </p>
            {helper.ideas.length > 0 && (
              <div className="chips small">
                {helper.ideas.map((i) => (
                  <button key={i} className="chip" onClick={() => setIdea((cur) => (cur ? `${cur}. ${i}` : i).slice(0, MAX_PROMPT_CHARS))}>
                    + {i}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {helperError && <p className="inlineWarn">The helper couldn&apos;t look at the drawing: {helperError}</p>}
        <div ref={stageRef} className={`stage kid s-${busy ? "loading" : image ? "done" : "idle"}`} aria-live="polite" aria-busy={busy}>
          {busy ? (
            <div className="idle loadingState">
              <p>{phase === "helping" ? "Looking at your drawing…" : phase === "drawing" ? "Creating your character…" : "Checking your ideas…"}</p>
            </div>
          ) : error ? (
            <div className="errorBox" role="alert">
              <h4>Couldn&apos;t create it</h4>
              <p>{error.message}</p>
              {!NON_RETRYABLE.has(error.code) && (
                <button className="pill" onClick={create}>
                  Try again
                </button>
              )}
            </div>
          ) : image ? (
            <img key={image.slice(-24)} className="result" src={image} alt="Your character in their world" />
          ) : (
            <div className="idle">
              <p>Your character appears here.</p>
            </div>
          )}
        </div>
        {image && !busy && (
          <div className="resultMeta">
            <p className="muted">Created with {MODEL_ROLES.image.name}</p>
            {evaluation && <EvaluationCard ev={evaluation} kid />}
            <div className="actions">
              <button className="pill" onClick={create}>
                Make another
              </button>
              <a className="pill ghostPill" href={image} download="my-character.png">
                Save
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
