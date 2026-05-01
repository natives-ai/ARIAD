# SPEC.md

## 0. Meta

- Product: **ARIAD**
- Spec stage: **Initial product specification ready for implementation planning**
- Default product language: **English**
- Planned future localizations: **Korean, Japanese**
- Primary format: **Webtoon**
- Primary user: **Solo creator currently serializing on a recurring schedule**

---

## 1. Product goal

ARIAD helps a solo serial webtoon creator reach a usable structure draft for the current episode faster without feeling that the product has taken over authorship.

The product is **not** a full auto-writing system. It is a **canvas-based structure editor with AI-assisted node content support**.

---

## 2. Core design principles

1. **Creative ownership stays with the creator**
   - The user chooses, edits, moves, deletes, and restructures everything.
   - AI suggests; it does not silently decide.

2. **Episode-first**
   - Initial value centers on helping the current episode.
   - Macro-arc intervention is limited and only user-invoked.

3. **Structure before prose**
   - The tool is built around nodes and relationships, not chat-first generation.
   - Sentence generation is optional and secondary.

4. **Keyword-first assistance**
   - AI first helps through keyword clouds.
   - Sentence suggestions are a fallback when keywords are still not enough.

5. **Canvas-first understanding**
   - Spatial structure is the primary comprehension model.
   - The user should be able to understand episode flow by reading the canvas.

6. **Flexible incompleteness**
   - Empty nodes are allowed.
   - Some nodes may stay as keywords; others may become free text.

---

## 3. Information architecture

### 3.1 Main layout

- **Left sidebar**
  - Project folders
  - Story / episode list
  - Similar mental model to a conversation/sidebar navigator
  - Clicking an item loads that episode page
  - Does **not** continuously display other episodes’ node graphs

- **Top bar**
  - Global reference object library
  - English-first search and insertion
  - Object creation entry point

- **Center**
  - Main story canvas
  - The primary place for node creation, placement, editing, movement, and relationship reading

- **Right panel**
  - Hidden by default
  - Opens only when the user chooses detailed editing
  - Used for deeper editing of selected nodes or reference objects
  - When opened, the viewport recenters around the actively edited node

- **Bottom-right floating controls**
  - Global `+` button for new node creation
  - Undo / redo controls
  - Drawer toggle for local temporary storage

- **Bottom drawer**
  - Episode-local temporary storage for nodes
  - Acts as a holding drawer for the current episode only

- **Node-local popover**
  - Keyword cloud opens near the selected node

---

## 4. Structure model

### 4.1 Node hierarchy

The structure uses a fixed 3-level hierarchy:

1. **Major event**
2. **Minor event**
3. **Minor detail**

Minor detail is used for dialogue / action / direction-level support.

These levels are fixed. Node content remains free-form.

### 4.2 What is fixed vs flexible

- **Fixed**
  - Hierarchy levels
  - Canvas as primary interaction model
  - English canonical UI copy
  - Keyword-first AI support flow

- **Flexible**
  - Node content may be empty, keyword-only, or sentence-level
  - Macro structure may be incomplete
  - The creator may use AI on one node and manual writing on another
  - Reference object types may be extended later

### 4.3 Node meaning

A node is primarily an **information unit inside story structure**.
A node may contain:
- nothing
- keywords
- free-form text

The important thing is not finished prose quality but the fact that a node carries meaningful story information inside a visible structural relationship.

---

## 5. Canvas model

### 5.1 Axes

- **Horizontal axis**
  - Represents hierarchy level
  - Uses 3 vertical lanes:
    - Major event lane
    - Minor event lane
    - Minor detail lane
  - Lower levels should receive more horizontal width because they will usually contain more nodes

- **Vertical axis**
  - Represents both:
    - sequence/order
    - rough story-position/progression
  - It is not just rank ordering; the creator may use vertical position to express approximate placement inside the story flow

### 5.2 Time line

- Only the **major event lane** has the explicit vertical time line containing **start** and **end**
- Major-event nodes are constrained to that lane
- Start and end are properties of placement in that lane, not separately created anchor nodes

### 5.3 Structure truth

The product uses a **hybrid interpretation**:
- Position gives the creator an intuitive structural reading
- Parent-child relationships are still represented by connection lines
- Default relationship is created automatically from nearest valid upper-level parent
- The user may manually rewire via connection handles

---

## 6. Node creation and placement

### 6.1 Primary creation entry point

Primary entry point:
- **Global floating `+` button** at bottom right

Flow:
1. User clicks `+`
2. A new node card appears for dragging
3. User drags it onto the desired canvas position
4. The system snaps it into the nearest valid level lane
5. A default parent relationship is inferred from the nearest valid upper-level node

### 6.2 Why this is primary
- Works on an empty canvas
- Works for unrelated/new nodes
- Easy to understand for first-time users

### 6.3 Other creation methods
- Not required as primary flow in v1
- Double-click on blank canvas may be considered later as an advanced shortcut
- Node-attached `+` is not required in v1

---

## 7. Parent-child relationship rules

### 7.1 Automatic relationship rule

When a node is created or moved, it auto-connects to the **nearest valid upper-level node**.

Examples:
- A minor event connects to the nearest major event
- A minor detail connects to the nearest minor event

### 7.2 Manual relationship override

- Connection lines include small endpoint handles
- The user may drag a handle to another valid parent
- During drag, a candidate relationship preview is shown
- Releasing over a valid parent finalizes the new relationship

### 7.3 Visual rule

- Connection endpoint handles remain visible at all times
- Their contrast should be low enough not to clutter the canvas

### 7.4 Parent movement rule

When a parent moves, all descendants move with it.
- Moving a major event moves its minor events and minor details
- Moving a minor event moves its minor details

---

## 8. Node content states

A node can exist in one of these content states:

1. **Empty node**
2. **Keyword node**
3. **Free-text node**

The system does not force completion.
Empty nodes are allowed if they help the creator understand the structure.

### 8.1 Saved state rule
A node saves either:
- keyword state, or
- free-text state

It does not need to store both as the canonical visible state.

### 8.2 Selected AI keywords after sentence writing
- Selected AI-generated keywords remain in a **collapsed state**
- They can be revealed later
- Inside the keyword panel, chosen keywords should be visually distinguishable

---

## 9. AI assistance model

### 9.1 Core AI role

AI assists only when the user explicitly asks.

Initial scope:
- Suggest content for a selected node
- Support the creator at the currently chosen granularity
- Avoid auto-generating whole episode structures by default

### 9.2 Help trigger model

For a selected node:
- User opens AI help through a node button
- AI shows a **keyword cloud**
- The user selects one or more keywords
- The user can then:
  - write directly from those keywords
  - modify selected keywords
  - refresh the cloud
  - request sentence suggestions if still stuck

### 9.3 Keyword cloud

- Initial target size: **25 keywords** (5x5)
- All shown at once
- Should mix:
  - concrete content anchors
  - emotion / intention / narrative-function cues
- Composition is **fully dynamic**, driven by LLM interpretation of context, hierarchy level, reference objects, and current story state

### 9.4 Sentence suggestion gate

Sentence suggestions open only when:
- the user explicitly requests them, and
- the node already contains at least one keyword
  - either user-written or AI-selected

### 9.5 Sentence suggestion style

- Default should be approximately **one sentence**
- Typical upper range: **2–3 sentences**
- Soft maximum: **do not exceed 4 sentences**
- This is to avoid crossing the line into over-authoring

### 9.6 Suggested sentence count
- Initial default: **3 suggestions**

### 9.7 Candidate retention
- Non-selected sentence candidates do not need to be stored in v1

---

## 10. Level-aware AI behavior

Interaction flow is shared across levels, but suggestion character differs by level.

### 10.1 Major event node
AI tends to emphasize:
- narrative direction
- conflict escalation
- turning points
- episode-ending hooks
- information function

### 10.2 Minor event node
AI tends to emphasize:
- causal connection
- emotional movement
- relationship pressure
- scene energy / pacing
- action progression

### 10.3 Minor detail node
AI tends to emphasize:
- hidden intention
- emotional cues
- reaction pattern
- gesture / action hints
- memory / implication hints

### 10.4 Dialogue philosophy
For minor-detail support, AI should favor:
- intention
- emotional cues
- implied meaning
rather than polished final lines or voice-specific stylistic imitation.

---

## 11. Reference objects

### 11.1 Concept

Reference objects are reusable project-wide assets for stable story entities such as:
- people
- places
- things

Initial invocation syntax:
- `#keyword`

The `@` prefix is reserved for potential future collaboration features.

### 11.2 Object categories

Initial built-in categories:
- Person
- Place
- Thing

Users may create additional categories later if needed.

### 11.3 Initial storage scope
In v1, reference objects store **stable information only**.

Examples:
- name
- role
- personality
- appearance
- baseline relationship
- space description

Dynamic relationship updates and event-history auto-maintenance are deferred.

### 11.4 Object creation flow
- User can create objects manually
- If the same keyword appears repeatedly (e.g. 3+ times), the system may **suggest** creating a reference object
- Suggestion only; never forced auto-creation

### 11.5 Editing
- Object details are edited in the **right panel**
- The top bar shows compact object chips / labels, not full detail cards

---

## 12. Temporary storage drawer

### 12.1 Scope
- **Episode-local only**
- Not shared across the whole project in v1

### 12.2 Purpose
Used for:
- temporarily removing nodes from the active canvas
- parking ideas that are not being used right now
- holding nodes before deciding whether to delete them or reuse them

### 12.3 UI
- Bottom drawer
- Toggle button near the bottom-right control area
- Distinct from the global reference object bar

---

## 13. Node interactions

### 13.1 Inline-first editing
Primary editing should happen inline on the canvas.

### 13.2 Right-panel use
The right panel is for:
- detailed node editing
- reference object editing
- metadata-like edits not ideal inline

### 13.3 Quick action buttons on selected node
Visible on node selection:
- Fold / unfold
- Open keyword cloud
- Delete
- More

Inside **More**:
- Mark as important
- Mark as fixed

### 13.4 Direct-manipulation interactions
Handled by direct action rather than quick buttons:
- Move node
- Change start/end state by placement on major-event timeline
- Rewire connections through endpoint handles
- Inline text editing

---

## 14. Folding behavior

### 14.1 Default folding logic
- Folding a node collapses **all descendants**
- Unfolding reveals descendants again

### 14.2 Scope
- Major event fold collapses all child minor events and child minor details
- Minor event fold collapses its minor details

### 14.3 Later extensibility
Multi-step unfold modes may be considered later, but full descendant fold/unfold is enough for v1.

---

## 15. Deletion behavior

### 15.1 Child deletion rule
Deleting a parent node deletes all of its descendants.

### 15.2 Confirmation
Deletion should require an explicit confirmation step.

Canonical English copy:
**"This node and all of its child nodes will be deleted together. Do you want to delete them?"**

Buttons:
- **Cancel**
- **Delete**

### 15.3 Rationale
The system should not guess how to preserve or re-parent descendants automatically.
If the user wants to keep children, they should move them first.

---

## 16. Visual language

### 16.1 Shape
- Node family should keep a unified overall card shape
- Rounded card style is acceptable
- Major/minor/detail differentiation relies primarily on lane position, not radically different card shapes

### 16.2 Fill / tone
- Empty node vs content node is communicated by fill intensity
- In light mode, content nodes should appear visually denser than empty nodes
- In dark mode, this relationship may invert if needed

### 16.3 AI-assisted mark
- A small blue dot in the upper-right corner marks nodes that received AI assistance

### 16.4 Start and end major-event nodes
- **Start node**: thicker **top** border
- **End node**: thicker **bottom** border
- Only applies to major-event nodes

### 16.5 Important node
- Red border
- Visual bookmark only

### 16.6 Fixed node
- Stronger fill/brightness difference
- Visual certainty marker only
- No editing lock or movement lock in v1

### 16.7 Hover state
- Very subtle background/brightness shift only
- Avoid expensive or distracting effects

### 16.8 Selected state
- Node uses visual scale increase only (approx. 10% initially, adjustable later)
- Must be implemented as transform-based scaling, not layout reflow
- Selected node should render above nearby nodes via z-layer priority

---

## 17. Interaction-state philosophy

### 17.1 Hover
Pointer resting on a node.
Purpose:
- communicate “this is interactive”
- no major controls required yet

### 17.2 Selected
Current active editing target.
Purpose:
- show quick controls
- visually foreground the node

### 17.3 Why not overload borders
Borders are reserved for durable meaning states like important or start/end.
Temporary states should rely more on overlay, fill, scale, or z-order.

---

## 18. Keyboard and document-like interactions

Initial support should include basic document-style shortcuts:
- Copy
- Paste
- Undo
- Redo
- Delete / Backspace
- Enter
- Escape

Platform-appropriate variants:
- `Ctrl/Cmd+C`
- `Ctrl/Cmd+V`
- `Ctrl/Cmd+Z`
- `Ctrl/Cmd+Shift+Z` and/or `Ctrl/Cmd+Y`

UI controls near bottom right should also expose undo / redo visually.

---

## 19. Context menu policy

- Context menu / right-click is **not part of v1**
- v1 should rely on visible selection-based UI and direct manipulation
- Right-click may be added later as an advanced shortcut layer

---

## 20. Canonical English UI copy (initial)

### 20.1 Deletion
- Modal text: **"This node and all of its child nodes will be deleted together. Do you want to delete them?"**
- Buttons: **Cancel / Delete**

### 20.2 Generic labels
- **More**
- **Important**
- **Fixed**
- **Delete**
- **Fold**
- **Unfold**
- **Keyword Suggestions**
- **Temporary Drawer**
- **Undo**
- **Redo**

These are canonical defaults and can later be localized.

---

## 21. Out of scope for v1

- Collaboration features
- Multi-user tagging / mention workflows
- Automatic dynamic relationship updating inside reference objects
- Automatic event-history summarization inside reference objects
- Real branching-story persistence
- Full episode auto-generation
- Right-click-first power-user UX
- Cross-episode global temporary storage
- Advanced filter/search modes for nodes
- Auto-preserving descendants on parent deletion

---

## 22. Open implementation questions still acceptable after Spec

These are not product-direction gaps; they are implementation-shaping details:
- exact right-panel component structure
- exact visual density of node handles
- exact spacing of lane widths
- exact selected-node scale percentage
- exact color tokens for status states
- exact keyword cloud presentation density inside popover
- exact object-chip presentation in top bar

---

## 23. Readiness for next phase

This spec is detailed enough to drive:
- agent-system planning
- scaffold planning
- implementation task decomposition
- UI state modeling
- interaction acceptance criteria
- initial test planning

What remains for the next phase is not product discovery, but execution design:
- agent responsibilities
- codebase boundaries
- scaffold decisions
- implementation order
- automated test contract
