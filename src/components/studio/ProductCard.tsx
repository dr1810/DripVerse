/* eslint-disable @next/next/no-img-element */
"use client";

import type { ClothingProduct } from "@/lib/shopify/types";

export default function ProductCard({ p, selected, onSelect }: { p: ClothingProduct; selected: boolean; onSelect: () => void }) {
  return (
    <button className={`product ${selected ? "on" : ""}`} onClick={onSelect} aria-pressed={selected}>
      <div className="productImg">{p.imageUrl ? <img src={p.imageUrl} alt={p.imageAlt ?? p.title} loading="lazy" /> : <span>No image</span>}</div>
      <div className="productBody">
        <span className="productTitle">{p.title}</span>
        <span className="productMerchant">{p.merchant}</span>
        <span className="productPrice">{p.price ?? "Price on store"}</span>
      </div>
    </button>
  );
}
