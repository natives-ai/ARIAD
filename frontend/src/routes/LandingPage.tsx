import { Link } from "react-router-dom";

const workflowSteps = [
  {
    title: "Collect what is already decided",
    body:
      "Bring in the world, key characters, current progress, and the required episode endpoint without forcing a finished outline first."
  },
  {
    title: "Shape the current episode on canvas",
    body:
      "Use major events, minor events, and detail beats to make the episode flow visible before moving into storyboard work."
  },
  {
    title: "Ask for help only where you are stuck",
    body:
      "Open keyword suggestions on a selected node, choose what fits, and keep every final decision under creator control."
  }
];

const proofPoints = [
  {
    label: "Deadline fit",
    body: "Episode-first structure support for serial webtoon deadlines"
  },
  {
    label: "Editable",
    body: "Node cards you can revise instead of one-shot generated prose"
  },
  {
    label: "Creator-led",
    body: "Keyword-first AI assistance that avoids taking over authorship"
  },
  {
    label: "Consistent",
    body: "Reference objects for stable people, places, and things"
  }
];

export function LandingPage() {
  return (
    <main className="marketing-page marketing-page-landing">
      <nav className="marketing-nav" aria-label="ARIAD marketing navigation">
        <Link className="marketing-brand" to="/">
          ARIAD
        </Link>
        <div className="marketing-nav-links">
          <Link to="/explanation">How it works</Link>
          <Link className="marketing-nav-cta" to="/workspace">
            Open workspace
          </Link>
        </div>
      </nav>

      <section className="marketing-hero" aria-labelledby="landing-title">
        <div className="marketing-hero-copy">
          <p className="eyebrow">AI-assisted story structure for webtoon creators</p>
          <h1 id="landing-title">Lock the next episode structure before the deadline locks you.</h1>
          <p className="hero-lede">
            ARIAD helps solo serial webtoon creators turn a rough episode requirement into a usable
            structure draft faster, while keeping the author in control of every creative choice.
          </p>
          <div className="marketing-actions">
            <Link className="button-link button-link-primary" to="/workspace">
              Start structuring an episode
            </Link>
            <Link className="button-link button-link-secondary" to="/explanation">
              See how ARIAD works
            </Link>
          </div>
        </div>

        <aside className="hero-board" aria-label="ARIAD episode structure preview">
          <div className="hero-board-lane">
            <span>Major event</span>
            <article>Meeting at the cafe</article>
            <article className="is-end">Mother tells him to leave</article>
          </div>
          <div className="hero-board-lane">
            <span>Minor event</span>
            <article>Uneasy small talk</article>
            <article>Pressure quietly escalates</article>
          </div>
          <div className="hero-board-lane">
            <span>Minor detail</span>
            <article>Hidden intention</article>
            <article>Gesture cue</article>
            <article>Reaction beat</article>
          </div>
        </aside>
      </section>

      <section className="marketing-proof-grid" aria-label="ARIAD value summary">
        {proofPoints.map((point) => (
          <article className="marketing-proof-card" key={point.label}>
            <span>{point.label}</span>
            <strong>{point.body}</strong>
          </article>
        ))}
      </section>

      <section className="marketing-section split-section" aria-labelledby="why-title">
        <div>
          <p className="eyebrow">Built for the real bottleneck</p>
          <h2 id="why-title">The problem is not always ideas. It is deciding the episode flow in time.</h2>
        </div>
        <p>
          Weekly-style production turns story delay into total production delay. ARIAD focuses on the
          moment after an upload, when the creator already knows the broad direction but still needs to
          bridge the current episode coherently enough to begin storyboarding and drawing.
        </p>
      </section>

      <section className="marketing-section workflow-section" aria-labelledby="workflow-title">
        <p className="eyebrow">A creator-owned workflow</p>
        <h2 id="workflow-title">From stuck beat to workable structure</h2>
        <div className="workflow-cards">
          {workflowSteps.map((step, index) => (
            <article className="workflow-card" key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
