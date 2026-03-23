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
  createOraRuntime,
  createOpenAiTtsProvider,
} <span class="hl-kw">from</span> <span class="hl-str">"@arach/ora"</span>

<span class="hl-kw">const</span> runtime = <span class="hl-fn">createOraRuntime</span>({
  providers: [<span class="hl-fn">createOpenAiTtsProvider</span>()],
})
runtime.<span class="hl-fn">setCredentials</span>(<span class="hl-str">"openai"</span>, { <span class="hl-prop">apiKey</span>: <span class="hl-str">process.env.OPENAI_API_KEY</span> })

<span class="hl-kw">const</span> voices = <span class="hl-kw">await</span> runtime.<span class="hl-fn">listVoices</span>(<span class="hl-str">"openai"</span>)
<span class="hl-kw">const</span> voice = voices[<span class="hl-num">0</span>]?.id <span class="hl-kw">??</span> <span class="hl-str">"alloy"</span>

  <span class="hl-kw">const</span> response = <span class="hl-kw">await</span> runtime.<span class="hl-fn">synthesize</span>({
  provider: <span class="hl-str">"openai"</span>,
  text: <span class="hl-str">"Hello, this is Ora speaking."</span>,
  voice,
  <span class="hl-prop">format</span>: <span class="hl-str">"mp3"</span>,
})

<span class="hl-cm">// response.audioData is ready for playback, or use response.audioUrl</span>`;

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
              Build text-to-speech
              <br />
              that just works.
            </h1>
            <p className="hero-sub">
              Ora gives you one consistent runtime for speech synthesis:
              choose a provider, pick a voice, synthesize audio, and ship the result.
              It handles credentials, response normalization, and runtime-level
              provider abstraction so you can stay focused on UX.
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
                Pick a provider, request audio, and render speech output.
              </p>
              <div className="surface-bar">
                <div className="surface-fill" />
              </div>
              <div className="surface-readout">
                <div>
                  <span>Voice</span>
                  <strong>alloy</strong>
                </div>
                <div>
                  <span>Format</span>
                  <strong>mp3</strong>
                </div>
                <div>
                  <span>Response</span>
                  <strong>audio bytes</strong>
                </div>
                <div>
                  <span>Source</span>
                  <strong>buffered</strong>
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
                <h3>Single API across providers</h3>
                <p>
                  Use the same request and response shape for OpenAI, remote worker
                  runtimes, and custom backends.
                </p>
              </div>
            </div>
            <div className="point">
              <span className="point-num">02</span>
              <div>
                <h3>Reliable voice discovery</h3>
                <p>
                  Ask a provider for its available voices and render a clean,
                  consistent voice selector in your app.
                </p>
              </div>
            </div>
            <div className="point">
              <span className="point-num">03</span>
              <div>
                <h3>Production-ready synthesis responses</h3>
                <p>
                  Get normalized audio payloads, metadata, and timing-friendly
                  defaults from one place, with optional streaming when you need it.
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
