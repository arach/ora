import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type DocsJson = {
  groups: Array<{
    id: string;
    title: string;
    items: Array<{
      id: string;
      title: string;
      description?: string;
      slug?: string;
    }>;
  }>;
};

async function getDocsJson() {
  const path = join(process.cwd(), "..", "docs.json");
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as DocsJson;
}

const codeExample = `<span class="hl-kw">import</span> {
  tokenizeText,
  createEstimatedTimeline,
  OraPlaybackTracker,
} <span class="hl-kw">from</span> <span class="hl-str">"@arach/ora"</span>

<span class="hl-kw">const</span> tokens = <span class="hl-fn">tokenizeText</span>(text)
<span class="hl-kw">const</span> timeline = <span class="hl-fn">createEstimatedTimeline</span>({
  text, tokens, <span class="hl-prop">durationMs</span>: <span class="hl-num">4200</span>,
})

<span class="hl-kw">const</span> tracker = <span class="hl-kw">new</span> <span class="hl-type">OraPlaybackTracker</span>({
  text, tokens, timeline,
  <span class="hl-prop">segments</span>: [{ <span class="hl-prop">id</span>: <span class="hl-str">"p-1"</span>, <span class="hl-prop">start</span>: <span class="hl-num">0</span>, <span class="hl-prop">end</span>: text.length }],
})

<span class="hl-cm">// Feed boundary events from your TTS provider</span>
tracker.<span class="hl-fn">updateFromBoundary</span>(<span class="hl-num">18</span>, <span class="hl-num">950</span>)

<span class="hl-cm">// Or fall back to clock-based estimation</span>
tracker.<span class="hl-fn">updateFromClock</span>(<span class="hl-num">2000</span>)

<span class="hl-cm">// Read the current playback state</span>
<span class="hl-kw">const</span> snap = tracker.<span class="hl-fn">snapshot</span>()`;

export default async function HomePage() {
  const docs = await getDocsJson();
  const allItems = docs.groups.flatMap((g) => g.items);

  return (
    <div className="page">
      <header className="header">
        <div className="wrap">
          <Link href="/" className="logo">
            ora
          </Link>
          <nav className="nav">
            <Link href="/docs/overview">Docs</Link>
            <Link href="/docs/api">API</Link>
            <Link
              href="https://github.com/arach/ora"
              target="_blank"
              rel="noreferrer noopener"
            >
              GitHub
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="wrap">
            <p className="eyebrow">Text-to-Speech Runtime</p>
            <h1>
              Know which word
              <br />
              is being spoken.
            </h1>
            <p className="hero-sub">
              Ora keeps your interface synchronized with speech output.
              Tokenize, estimate timing, track playback, and front remote
              model servers through a stable worker contract.
            </p>
            <div className="hero-actions">
              <code className="install">bun add @arach/ora</code>
              <Link href="/docs/quickstart" className="link-arrow">
                Quickstart <ArrowRight size={14} />
              </Link>
              <Link href="/playground" className="link-arrow">
                Playground <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        <section className="surface">
          <div className="wrap">
            <div className="surface-panel">
              <p className="surface-text">
                Drop in a PDF and <mark>shape</mark> the reading surface from
                the file outward.
              </p>
              <div className="surface-bar">
                <div className="surface-fill" />
              </div>
              <div className="surface-readout">
                <div>
                  <span>Token</span>
                  <strong>shape</strong>
                </div>
                <div>
                  <span>Segment</span>
                  <strong>paragraph-1</strong>
                </div>
                <div>
                  <span>Elapsed</span>
                  <strong>00:00.95</strong>
                </div>
                <div>
                  <span>Source</span>
                  <strong>boundary</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="points">
          <div className="wrap">
            <div className="point">
              <span className="point-num">01</span>
              <div>
                <h3>Provider timing is unreliable</h3>
                <p>
                  Most TTS APIs don&apos;t expose word-level boundaries. When
                  they do, the format varies. You can&apos;t build a UI on
                  inconsistent signals.
                </p>
              </div>
            </div>
            <div className="point">
              <span className="point-num">02</span>
              <div>
                <h3>Estimated fallback is hard</h3>
                <p>
                  Building a usable timing model from text shape and total
                  duration requires careful tokenization and proportional time
                  distribution.
                </p>
              </div>
            </div>
            <div className="point">
              <span className="point-num">03</span>
              <div>
                <h3>Inference should stay replaceable</h3>
                <p>
                  Ora should own the runtime boundary, not the internals of
                  every model stack. Put MLX Audio, system speech, or another
                  backend behind the worker and keep the client surface stable.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="code">
          <div className="wrap">
            <div className="code-label">example.ts</div>
            <pre
              className="code-block"
              dangerouslySetInnerHTML={{ __html: codeExample }}
            />
            <div className="stats">
              <span>~4kb gzipped</span>
              <span>0 dependencies</span>
              <span>ESM + CJS</span>
              <span>TypeScript-first</span>
            </div>
          </div>
        </section>

        <section className="links">
          <div className="wrap">
            <h2>Resources</h2>
            <nav className="link-list">
              {allItems.map((item) => (
                <Link key={item.id} href={item.slug ?? `/docs/${item.id}`}>
                  {item.title} <ArrowRight size={14} />
                </Link>
              ))}
              <Link href="/llms.txt">
                llms.txt <ArrowRight size={14} />
              </Link>
            </nav>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="wrap footer-row">
          <span>Ora · MIT · 2025</span>
          <nav>
            <Link
              href="https://github.com/arach/ora"
              target="_blank"
              rel="noreferrer noopener"
            >
              GitHub
            </Link>
            <Link
              href="https://www.npmjs.com/package/@arach/ora"
              target="_blank"
              rel="noreferrer noopener"
            >
              npm
            </Link>
            <Link href="/docs/overview">Docs</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
