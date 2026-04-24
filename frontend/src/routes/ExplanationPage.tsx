import { Link } from "react-router-dom";

const principles = [
  {
    title: "Creative ownership stays with the creator",
    body:
      "ARIAD suggests directions, keywords, and small sentence candidates only after the user asks. The creator chooses, edits, moves, deletes, or ignores every suggestion."
  },
  {
    title: "Episode-first, not auto-novel generation",
    body:
      "The first job is helping the current episode reach a usable structure draft. Broad arc intervention stays limited and intentional."
  },
  {
    title: "Structure before prose",
    body:
      "The workspace is built around visible nodes and relationships so the episode can be read as a flow before the creator writes polished lines."
  },
  {
    title: "Keyword-first AI assistance",
    body:
      "AI starts with a keyword cloud for the selected node. Sentence suggestions are gated behind creator-selected keywords so support does not jump straight into over-authoring."
  }
];

const summaryItems = [
  "Map the episode as major events, minor events, and detail beats.",
  "Use AI only on the selected node when you explicitly ask for help.",
  "Choose, edit, move, or ignore every suggestion before it becomes part of the draft."
];

const structureRows = [
  ["Major event", "Turning points, conflict escalation, start/end pressure, episode hooks"],
  ["Minor event", "Causal bridges, scene movement, relationship pressure, pacing"],
  ["Minor detail", "Intentions, gestures, emotional cues, reaction beats, implications"]
];

export function ExplanationPage() {
  return (
    <main className="marketing-page explanation-page">
      <nav className="marketing-nav" aria-label="ARIAD explanation navigation">
        <Link className="marketing-brand" to="/">
          ARIAD
        </Link>
        <div className="marketing-nav-links">
          <Link to="/">Landing</Link>
          <Link className="marketing-nav-cta" to="/workspace">
            Open workspace
          </Link>
        </div>
      </nav>

      <header className="explanation-header">
        <p className="eyebrow">Product explanation</p>
        <h1>ARIAD is a canvas-based structure editor for the episode you need to finish next.</h1>
        <p>
          It is designed for solo serial webtoon creators who already know the world, characters, and
          rough direction, but need help arranging the current episode into usable beats before drawing
          time disappears.
        </p>
        <ul className="explanation-summary" aria-label="ARIAD explanation summary">
          {summaryItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </header>

      <section className="marketing-section explanation-callout" aria-labelledby="not-chat-title">
        <p className="section-kicker">Canvas first</p>
        <h2 id="not-chat-title">Why ARIAD is not just a chat box</h2>
        <p>
          General AI chat can produce ideas, but it is not optimized for comparing, editing, selecting,
          and assembling episode-level structure candidates. ARIAD keeps the work spatial: major events,
          minor events, and detail beats stay visible on the canvas so the creator can judge the episode
          flow directly.
        </p>
      </section>

      <section className="marketing-section principle-grid" aria-labelledby="principles-title">
        <p className="eyebrow">Design principles</p>
        <h2 id="principles-title">The product is helpful only if it does not replace the creator.</h2>
        <div>
          {principles.map((principle) => (
            <article className="principle-card" key={principle.title}>
              <h3>{principle.title}</h3>
              <p>{principle.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section structure-table-section" aria-labelledby="structure-title">
        <div>
          <p className="eyebrow">Three-level structure model</p>
          <h2 id="structure-title">Each node has a clear job inside the episode draft.</h2>
        </div>
        <div className="structure-table" role="table" aria-label="ARIAD node hierarchy explanation">
          {structureRows.map(([level, support]) => (
            <div className="structure-row" role="row" key={level}>
              <strong role="cell">{level}</strong>
              <span role="cell">{support}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="marketing-section final-cta" aria-labelledby="cta-title">
        <div>
          <p className="eyebrow">Try the workspace</p>
          <h2 id="cta-title">Open ARIAD when the next episode still has a gap in the middle.</h2>
        </div>
        <Link className="button-link button-link-primary" to="/workspace">
          Open the episode workspace
        </Link>
      </section>
    </main>
  );
}
