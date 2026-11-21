/* eslint-disable @next/next/no-img-element */
import Reveal from "@/components/Reveal";
import ModelsExplainer from "@/components/ModelsExplainer";
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
            <a href="#how">How it works</a>
            <a href="#studio">Create</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-h">
          <Reveal>
            <h1 id="hero-h">Imagine it. Wear it. Find it.</h1>
            <p className="lede">See real clothes in imagined worlds, then buy the exact piece from a real store.</p>
            <a href="#studio" className="cta">
              Start creating
            </a>
          </Reveal>
          <Reveal className="heroVisual" delay={150}>
            <img src="/showcase/hero.svg" alt="Illustration: an orange pocket tee floating above a flowering storybook moon" />
          </Reveal>
        </section>

        <section id="fashion" className="feature" aria-labelledby="fashion-h">
          <Reveal>
            <p className="eyebrow">Fashion Mode</p>
            <h2 id="fashion-h">Same tee. New scene.</h2>
            <p className="lede">Show us a tee. We find the real one on Shopify and drop you into any world wearing it.</p>
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
            <p className="lede">Kids draw an outfit and meet the character who wears it. No photos needed.</p>
            <a href="#try-imagination" className="link">
              Try Imagination Mode ›
            </a>
          </Reveal>
          <Reveal delay={100}>
            <Transformation pair={imagination} />
          </Reveal>
        </section>

        <section id="how" className="feature engineSection" aria-labelledby="how-h">
          <Reveal>
            <p className="eyebrow">Under the hood</p>
            <h2 id="how-h">Two Gemini 4 models. One real store.</h2>
            <p className="lede">Each model has one job, so every step is fast, checkable and honest.</p>
          </Reveal>
          <Reveal delay={100}>
            <ModelsExplainer />
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
