export function CanvasPreviewGraphic() {
  return (
    <figure className="canvas-preview" aria-label="Example structure of an ARIAD canvas">
      <svg
        className="canvas-preview-graphic"
        viewBox="0 0 980 438"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="preview-arrowhead"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>
        <rect className="canvas-preview-viewport" x="1" y="1" width="978" height="436" rx="22" />

        <rect className="canvas-preview-lane-pill" x="88" y="20" width="168" height="34" rx="17" />
        <rect className="canvas-preview-lane-pill" x="406" y="20" width="172" height="34" rx="17" />
        <rect className="canvas-preview-lane-pill" x="707" y="20" width="184" height="34" rx="17" />
        <text className="canvas-preview-lane-text" x="172" y="43" textAnchor="middle">
          MAJOR EVENT LANE
        </text>
        <text className="canvas-preview-lane-text" x="492" y="43" textAnchor="middle">
          MINOR EVENT LANE
        </text>
        <text className="canvas-preview-lane-text" x="799" y="43" textAnchor="middle">
          MINOR DETAIL LANE
        </text>

        <circle className="canvas-preview-divider-dot" cx="331" cy="21" r="7" />
        <circle className="canvas-preview-divider-dot" cx="653" cy="21" r="7" />
        <circle className="canvas-preview-divider-dot" cx="944" cy="21" r="7" />
        <line className="canvas-preview-lane-divider" x1="331" y1="33" x2="331" y2="414" />
        <line className="canvas-preview-lane-divider" x1="653" y1="33" x2="653" y2="414" />
        <line className="canvas-preview-lane-divider" x1="944" y1="33" x2="944" y2="414" />

        <line className="canvas-preview-timeline" x1="172" y1="72" x2="172" y2="405" />
        <circle className="canvas-preview-timeline-dot" cx="172" cy="72" r="7" />
        <circle className="canvas-preview-timeline-dot" cx="172" cy="405" r="7" />
        <line className="canvas-preview-timeline-end" x1="172" y1="405" x2="172" y2="419" />
        <path className="canvas-preview-timeline-arrow" d="M158 419 L186 419 L172 435 Z" />

        <path
          className="canvas-preview-link"
          d="M286 115 C318 115 346 136 378 136"
          markerEnd="url(#preview-arrowhead)"
        />
        <path
          className="canvas-preview-link"
          d="M286 362 C318 362 346 320 378 320"
          markerEnd="url(#preview-arrowhead)"
        />
        <path
          className="canvas-preview-link"
          d="M606 136 C636 136 654 126 685 126"
          markerEnd="url(#preview-arrowhead)"
        />
        <path
          className="canvas-preview-link"
          d="M606 136 C636 136 654 230 685 230"
          markerEnd="url(#preview-arrowhead)"
        />
        <path
          className="canvas-preview-link"
          d="M606 320 C636 320 654 334 685 334"
          markerEnd="url(#preview-arrowhead)"
        />

        <rect className="canvas-preview-node canvas-preview-node-major" x="58" y="72" width="228" height="87" rx="33" />
        <rect className="canvas-preview-node canvas-preview-node-major" x="58" y="318" width="228" height="87" rx="33" />
        <rect className="canvas-preview-node" x="378" y="92" width="228" height="87" rx="33" />
        <rect className="canvas-preview-node" x="378" y="276" width="228" height="87" rx="33" />
        <rect className="canvas-preview-node" x="685" y="82" width="228" height="87" rx="33" />
        <rect className="canvas-preview-node" x="685" y="186" width="228" height="87" rx="33" />
        <rect className="canvas-preview-node" x="685" y="290" width="228" height="87" rx="33" />
      </svg>
    </figure>
  );
}
