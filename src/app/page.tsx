/* eslint-disable @next/next/no-img-element */
import Reveal from "@/components/Reveal";
import Studio from "@/components/Studio";
import { SHOWCASE, type ShowcasePair } from "@/lib/showcase";

function caption(pair: ShowcasePair) {
  return pair.generated ? "Generated with Nano Banana from the sample shown." : "Concept art. Generate the real thing below.";
}

function Pair({ pair, dark = false }: { pair: ShowcasePair; dark?: boolean }) {
  return (
    <figure className={`pair ${dark ? "pairDark" : ""}`}>
      <div className="pairInput">
        <img src={pair.input.src} alt={pair.input.alt} />
        <span>{pair.input.label}</span>
      </div>
      <div className="pairArrow" aria-hidden>
        →
      </div>
      <div className="pairOutput">
        <img src={pair.output.src} alt={pair.output.alt} />
      </div>
      <figcaption>{caption(pair)}</figcaption>
    </figure>
  );
}

const STEPS = [
  { n: "01", title: "Create a profile", body: "4–5 pictures and the stuff you love.", live: false },
  { n: "02", title: "Add pictures & a prompt", body: "A garment, a doodle, or a few words.", live: true },
  { n: "03", title: "Generate the scenery", body: "Nano Banana builds the scene around it.", live: true },
  { n: "04", title: "Shopify picks", body: "Matching products and suggestions.", live: false },
  { n: "05", title: "Shop & buy", body: "At recommended prices.", live: false },
];

export default function Home() {
  const { fashion, imagination } = SHOWCASE;
  return (
    <>
      <nav className="nav" aria-label="Main">
        <div className="navInner">
          <a href="#top" className="wordmark">
            <span className="drop" aria-hidden />
            DripVerse
          </a>
          <div className="navLinks">
            <a href="#fashion">Fashion</a>
            <a href="#imagination">Imagination</a>
            <a href="#how">How it works</a>
          </div>
          <a href="#studio" className="navCta">
            Start creating
          </a>
        </div>
      </nav>

      <main id="top">
        <header className="hero">
          <Reveal>
            <p className="eyebrow">DripVerse</p>
            <h1>
              <span className="line">Imagine it.</span> <span className="line grad">See it.</span>
            </h1>
            <p className="lede">Drop a tee into any scene. Turn a doodle into a storybook world. One tap, no studio.</p>
            <a href="#studio" className="cta">
              Start creating
            </a>
          </Reveal>
          <Reveal className="heroVisual" delay={120}>
            <div className="heroTile">
              <img src={fashion.output.src} alt={fashion.output.alt} />
              <div className="heroChip">
                <img src={fashion.input.src} alt="" />
                <span>Fashion</span>
              </div>
            </div>
            <div className="heroTile">
              <img src={imagination.output.src} alt={imagination.output.alt} />
              <div className="heroChip">
                <img src={imagination.input.src} alt="" />
                <span>Imagination</span>
              </div>
            </div>
          </Reveal>
          {!(fashion.generated && imagination.generated) && <p className="heroNote">Concept art shown. Live results come from the studio below.</p>}
        </header>

        <section id="fashion" className="feature">
          <Reveal>
            <p className="eyebrow">Fashion Mode</p>
            <h2>
              Your fit.
              <br />
              Any scene.
            </h2>
            <p className="lede">Upload a garment and pick a backdrop. Color, cut and every stitch stay true, styled like a magazine cover.</p>
            <a href="#try-fashion" className="link">
              Try Fashion ›
            </a>
          </Reveal>
          <Reveal delay={100}>
            <Pair pair={fashion} />
          </Reveal>
        </section>

        <section id="imagination" className="feature dark">
          <Reveal>
            <p className="eyebrow">Imagination Mode</p>
            <h2>
              A doodle
              <br />
              becomes a world.
            </h2>
            <p className="lede">Sketch it, say it, or both. DripVerse paints a storybook scene that keeps every idea you drew.</p>
            <a href="#try-imagination" className="link">
              Try Imagination ›
            </a>
          </Reveal>
          <Reveal delay={100}>
            <Pair pair={imagination} dark />
          </Reveal>
        </section>

        <section id="how" className="how">
          <Reveal>
            <p className="eyebrow">How it works</p>
            <h2>From idea to image in three taps.</h2>
          </Reveal>
          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.n} className={s.live ? "live" : ""}>
                <Reveal delay={i * 60}>
                  <span className="stepN">{s.n}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                  {!s.live && <span className="soon">Coming soon</span>}
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        <Studio />
      </main>

      <footer className="footer">
        <p>DripVerse. Images are made on request and never stored. Sample garments and drawings are fictional.</p>
      </footer>
    </>
  );
}
