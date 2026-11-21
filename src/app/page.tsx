/* eslint-disable @next/next/no-img-element */
import Reveal from "@/components/Reveal";
import Studio from "@/components/Studio";
import { SHOWCASE, type ShowcasePair } from "@/lib/showcase";

function Transformation({ pair }: { pair: ShowcasePair }) {
  return (
    <figure className="transform">
      <div className="transformOutput">
        <img src={pair.output.src} alt={pair.output.alt} />
      </div>
      <div className="transformInput">
        <img src={pair.input.src} alt={pair.input.alt} />
        <span>{pair.input.label}</span>
      </div>
      <figcaption>{pair.generated ? "Made with DripVerse from the sample shown." : "Concept art. Make the real thing below."}</figcaption>
    </figure>
  );
}

export default function Home() {
  const { fashion, imagination } = SHOWCASE;
  return (
    <>
      <header className="nav">
        <div className="navInner">
          <a href="#top" className="wordmark">
            DripVerse
          </a>
          <nav className="navLinks" aria-label="Sections">
            <a href="#fashion">Fashion</a>
            <a href="#imagination">Imagination</a>
            <a href="#studio">Create</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-h">
          <Reveal>
            <h1 id="hero-h">See what you imagine.</h1>
            <p className="lede">Put a favorite tee somewhere unexpected, or turn a sketch into a world of its own.</p>
            <a href="#studio" className="cta">
              Start creating
            </a>
          </Reveal>
          <Reveal className="heroVisual" delay={150}>
            <img src="/showcase/hero.svg" alt="An orange pocket tee floating above a flowering storybook moon, with a cat flying past in a rocket" />
          </Reveal>
        </section>

        <section id="fashion" className="feature" aria-labelledby="fashion-h">
          <Reveal>
            <p className="eyebrow">Fashion Mode</p>
            <h2 id="fashion-h">Same tee. New scene.</h2>
            <p className="lede">Pick a tee and a place, and DripVerse keeps its color, cut and every detail.</p>
            <a href="#try-fashion" className="link">
              Try Fashion Mode ›
            </a>
          </Reveal>
          <Reveal delay={100}>
            <Transformation pair={fashion} />
          </Reveal>
        </section>

        <section id="imagination" className="feature alt" aria-labelledby="imagination-h">
          <Reveal>
            <p className="eyebrow">Imagination Mode</p>
            <h2 id="imagination-h">A whole world from a doodle.</h2>
            <p className="lede">Add a sketch, a few words or both, and get a storybook scene that keeps your ideas.</p>
            <a href="#try-imagination" className="link">
              Try Imagination Mode ›
            </a>
          </Reveal>
          <Reveal delay={100}>
            <Transformation pair={imagination} />
          </Reveal>
        </section>

        <Studio />
      </main>

      <footer className="footer">
        <p>Images are made on request and never stored. Sample tees and drawings are fictional.</p>
      </footer>
    </>
  );
}
