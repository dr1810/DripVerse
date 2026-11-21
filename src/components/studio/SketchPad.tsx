"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

export type SketchPadHandle = { toBlob: () => Promise<Blob | null>; isEmpty: () => boolean; clear: () => void };

const COLORS = ["#1d1d1f", "#e53935", "#fb8c00", "#fdd835", "#43a047", "#1e88e5", "#8e24aa", "#ff80ab"];

/** A small drawing surface (pointer events, works with touch). Output is a PNG blob. */
const SketchPad = forwardRef<SketchPadHandle, { onChange?: (hasInk: boolean) => void }>(function SketchPad({ onChange }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(COLORS[1]);
  const [size, setSize] = useState(8);
  const inkRef = useRef(false);

  const reset = useCallback(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    inkRef.current = false;
    onChange?.(false);
  }, [onChange]);

  useEffect(() => {
    reset();
  }, [reset]);

  useImperativeHandle(ref, () => ({
    toBlob: () =>
      new Promise((resolve) => {
        const c = canvasRef.current;
        if (c) c.toBlob(resolve, "image/png");
        else resolve(null);
      }),
    isEmpty: () => !inkRef.current,
    clear: reset,
  }));

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    move(e);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const p = point(e);
    if (!ctx || !last.current) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!inkRef.current) {
      inkRef.current = true;
      onChange?.(true);
    }
  }

  function up() {
    drawing.current = false;
    last.current = null;
  }

  return (
    <div className="sketch">
      <canvas
        ref={canvasRef}
        width={768}
        height={768}
        aria-label="Drawing canvas"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
      />
      <div className="sketchTools">
        <div className="swatches" role="radiogroup" aria-label="Pen color">
          {COLORS.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={color === c}
              aria-label={`Color ${c}`}
              className={`swatch ${color === c ? "on" : ""}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <label className="sizeCtl">
          <span>Pen</span>
          <input type="range" min={3} max={30} value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Pen size" />
        </label>
        <button className="linkBtn" onClick={reset}>
          Clear
        </button>
      </div>
    </div>
  );
});

export default SketchPad;
