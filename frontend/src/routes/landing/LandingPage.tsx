// 이 파일은 ARIAD 랜딩 페이지 화면을 구성합니다.
import { Link } from "react-router-dom";

import "./LandingPage.css";
import { AriadLogoMark } from "./components/AriadLogoMark";
import { CanvasPreviewGraphic } from "./components/CanvasPreviewGraphic";

const strengths = [
  {
    title: "Structure before prose",
    body: "Shape the episode flow before polishing dialogue or narration."
  },
  {
    title: "Creator keeps control",
    body: "AI offers clues; you choose what enters the draft."
  },
  {
    title: "Break the stuck beat",
    body: "Open a keyword cloud on one blocked node."
  }
];

const usageNotes = [
  {
    title: "Use lanes as story levels",
    body: "Major is turning points, Minor is scene movement, and Detail is cues or reactions."
  },
  {
    title: "Ask AI through keyword clouds",
    body: "Select one node, request clues, then keep only what fits."
  },
  {
    title: "Keep recurring elements as objects",
    body: "Save people, places, and items as reusable story objects."
  }
];

// ARIAD 소개와 작업공간 진입 CTA를 렌더링합니다.
export function LandingPage() {
  return (
    <main className="marketing-page marketing-page-landing">
      <nav className="marketing-nav" aria-label="ARIAD navigation">
        <Link className="marketing-brand" to="/" aria-label="ARIAD home">
          <AriadLogoMark />
          <span>ARIAD</span>
        </Link>
        <Link className="marketing-nav-cta" to="/workspace">
          Open workspace
        </Link>
      </nav>

      <section className="marketing-hero" aria-labelledby="landing-title">
        <div className="marketing-hero-copy">
          <p className="eyebrow">Episode structure workspace</p>
          <h1 id="landing-title">
            Your story is just one <span className="keyword-cloud-word">clue</span> away
          </h1>
          <p className="hero-lede">
            ARIAD turns loose episode direction into a visible, editable story thread.
          </p>
          <div className="marketing-actions">
            <Link className="button-link button-link-primary" to="/workspace">
              Open workspace
            </Link>
          </div>
        </div>

        <CanvasPreviewGraphic />
      </section>

      <section className="compact-section" aria-labelledby="strengths-title">
        <div className="section-heading">
          <p className="eyebrow">Core strengths</p>
          <h2 id="strengths-title">Why use ARIAD before drafting scenes</h2>
        </div>
        <div className="compact-card-grid">
          {strengths.map((strength) => (
            <article className="compact-card" key={strength.title}>
              <h3>{strength.title}</h3>
              <p>{strength.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="compact-section" aria-labelledby="usage-title">
        <div className="section-heading">
          <p className="eyebrow">How to start</p>
          <h2 id="usage-title">Three things before the canvas</h2>
        </div>
        <div className="usage-list">
          {usageNotes.map((note, index) => (
            <article className="usage-row" key={note.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{note.title}</h3>
                <p>{note.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="final-cta" aria-labelledby="cta-title">
        <h2 id="cta-title">Open the workspace when the next episode needs a path.</h2>
        <Link className="button-link button-link-primary" to="/workspace">
          Open workspace
        </Link>
      </section>
    </main>
  );
}
