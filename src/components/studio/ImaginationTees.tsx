/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import type { ClothingProduct } from "@/lib/shopify/types";
import { postForm } from "./api";

const THEME_QUERIES: Record<string, string> = {
  candy: "pastel rainbow graphic t-shirt",
  ocean: "ocean sea turtle graphic t-shirt",
  dino: "dinosaur graphic t-shirt",
  space: "space planets graphic t-shirt",
};

export default function ImaginationTees({ theme }: { theme: string }) {
  const [products, setProducts] = useState<ClothingProduct[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function findTees() {
    setLoading(true);
    setFailed(false);
    const form = new FormData();
    form.set("query", THEME_QUERIES[theme] ?? "colorful illustrated graphic t-shirt");
    form.set("category", "t-shirt");
    const result = await postForm<{ products: ClothingProduct[] }>("/api/products", form);
    if (result.ok) setProducts(result.data.products.filter((product) => product.imageUrl).slice(0, 6));
    else setFailed(true);
    setLoading(false);
  }

  return (
    <section className="imaginationTees" aria-labelledby="imagination-tees-heading" aria-busy={loading}>
      <h4 id="imagination-tees-heading">Tee ideas for your world</h4>
      <p className="note">Explore illustrated tees from Shopify. Shopping is for grown-ups in Fashion Mode.</p>
      {products === null && (
        <button className="pill ghostPill" type="button" disabled={loading} onClick={findTees}>
          {loading ? "Finding tees…" : failed ? "Try again" : "See tee ideas"}
        </button>
      )}
      {failed && <p className="note" role="status">Tee ideas couldn’t load right now.</p>}
      {products?.length === 0 && <p className="note" role="status">No tee ideas turned up for this theme.</p>}
      {products && products.length > 0 && (
        <ul className="productStrip" tabIndex={0} aria-label="Recommended tees">
          {products.map((product) => (
            <li className="product" key={product.id}>
              <div className="productImg"><img src={product.imageUrl} alt="" loading="lazy" /></div>
              <div className="productBody"><span className="productTitle" title={product.title}>{product.title}</span></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
