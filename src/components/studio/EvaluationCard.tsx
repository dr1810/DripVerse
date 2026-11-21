"use client";

import type { Evaluation } from "@/lib/ai/types";

const ASPECTS = [
  ["color", "Color"],
  ["shape", "Shape"],
  ["pattern", "Pattern"],
  ["details", "Details"],
] as const;

export default function EvaluationCard({ ev, kid = false }: { ev: Evaluation; kid?: boolean }) {
  return (
    <div className={`evalCard v-${ev.verdict}`}>
      <div className="evalHead">
        <div className="evalScore" aria-label={`Fidelity score ${ev.overallScore} out of 100`}>
          {ev.overallScore}
          <small>/100</small>
        </div>
        <div>
          <p className="evalTitle">{kid ? "Ideas kept from your drawing" : "Garment fidelity"}</p>
          <p className="evalModel">Checked by {ev.model}</p>
        </div>
      </div>
      <div className="bars">
        {ASPECTS.map(([k, label]) => (
          <div key={k} className="bar" title={ev[k].notes}>
            <span>{label}</span>
            <div className="track">
              <div className="fill" style={{ width: `${ev[k].score}%` }} />
            </div>
            <b>{ev[k].score}</b>
          </div>
        ))}
      </div>
      {ev.mismatches.length > 0 && (
        <ul className="mismatches">
          {ev.mismatches.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      {ev.feedback && <p className="feedback">{ev.feedback}</p>}
    </div>
  );
}
