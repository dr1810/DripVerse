import { MODEL_ROLES } from "@/lib/models";

const ITEMS = [
  { step: "01", ...MODEL_ROLES.interpret, label: "Understands" },
  { step: "02", name: "Shopify Catalog", id: "search_catalog · UCP", job: "Searches over a billion real products by words and by photo, and returns real prices, stores and links.", why: "No invented products: everything you can buy is live.", label: "Finds" },
  { step: "03", ...MODEL_ROLES.image, label: "Creates" },
  { step: "04", ...MODEL_ROLES.evaluate, label: "Checks" },
];

export default function ModelsExplainer() {
  return (
    <ol className="engine">
      {ITEMS.map((m) => (
        <li key={m.step}>
          <span className="engineStep">
            {m.step} · {m.label}
          </span>
          <h3>{m.name}</h3>
          <code>{m.id}</code>
          <p>{m.job}</p>
          <p className="why">{m.why}</p>
        </li>
      ))}
    </ol>
  );
}
