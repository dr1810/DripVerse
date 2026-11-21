"use client";

import { useEffect, useRef, useState } from "react";
import type { Mode } from "@/lib/validation";
import FashionFlow from "./studio/FashionFlow";
import ImaginationFlow from "./studio/ImaginationFlow";

export default function Studio() {
  const [mode, setMode] = useState<Mode>("fashion");
  const ref = useRef<HTMLElement>(null);

  // "Try … ›" links land here with the right mode.
  useEffect(() => {
    function onHash() {
      const h = window.location.hash;
      if (h === "#try-fashion" || h === "#try-imagination") {
        setMode(h === "#try-fashion" ? "fashion" : "imagination");
        ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", "#studio");
      }
    }
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <section id="studio" ref={ref} className="studio" aria-labelledby="studio-h">
      <div className="studioHead">
        <h2 id="studio-h">Start creating.</h2>
        <p className="lede">
          {mode === "fashion" ? "Show us a tee, find the real one on Shopify, and see yourself somewhere new." : "Draw an outfit, pick a world, and meet the character who wears it."}
        </p>
        <div className="segmented" role="tablist" aria-label="Mode" data-mode={mode}>
          <span className="segThumb" aria-hidden />
          <button role="tab" aria-selected={mode === "fashion"} onClick={() => setMode("fashion")}>
            Fashion
          </button>
          <button role="tab" aria-selected={mode === "imagination"} onClick={() => setMode("imagination")}>
            Imagination
          </button>
        </div>
      </div>
      {/* Both flows stay mounted so switching modes never loses work. */}
      <div hidden={mode !== "fashion"}>
        <FashionFlow />
      </div>
      <div hidden={mode !== "imagination"}>
        <ImaginationFlow />
      </div>
    </section>
  );
}
