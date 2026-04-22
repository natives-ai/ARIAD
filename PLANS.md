# PLANS.md

## Purpose
This is the mutable execution plan for agentic development.
It translates the locked intent in `DISCOVERY.md`, `SPEC.md`, `AGENT_SYSTEM.md`, and `SCAFFOLD.md` into milestone-based implementation work.
It must not override the immutable source-of-truth documents.

## Mutability rules
- Routine execution updates are allowed here without human approval:
  - milestone status updates
  - task progress updates
  - work-loop log append
  - blocker / approval-needed updates
- Structural changes to this plan require proposal and human approval before they are applied.
- When `approval needed` is `proposal_change`, record the event in both the work-loop log and the current milestone's `Notes / blockers` so that the occurrence and the current proposal state stay visible.

## Planning model
Use milestone-first planning with a task queue inside each milestone.
Each milestone should define:
- goal
- scope
- required dependencies
- preferred prerequisites
- out of scope
- task queue
- acceptance checks
- status
- notes / blockers
- open risks

## Status values
Allowed milestone statuses:
- `pending`
- `ready`
- `in_progress`
- `blocked`
- `escalated`
- `done`

## Status transition guidance
- `pending -> ready`: required dependencies and prerequisite decisions are satisfied
- `ready -> in_progress`: active implementation begins
- `in_progress -> blocked`: the milestone cannot continue without re-planning or prerequisite repair
- `blocked -> escalated`: human judgment or hard-stop approval is now required
- `in_progress -> done`: acceptance checks pass and no blocking issue remains

## Blocked vs escalated
- `blocked` means work is stalled but may still be resolved through re-planning, scope adjustment, or additional implementation work.
- `escalated` means work cannot safely continue without human judgment, hard-stop approval, or explicit decision-making.

## Global execution rules
- Prefer small, reviewable increments.
- No milestone is complete until its acceptance checks pass.
- Do not move forward on a knowingly broken baseline.
- If a task may trigger a hard stop, pause and escalate before implementation.
- If a task may trigger a version-control gate, route through `Version Control` before implementation.
- Default to 1?2 active milestones at a time when dependencies do not conflict; activating more than 2 requires explicit Orchestrator justification.
- Use the quality-gate categories defined by the scaffold:
  - always-run: lint, typecheck, unit smoke, build smoke
  - relevant-run: integration, e2e smoke

---

## Milestone 0 ? Baseline locked
**Goal**
Preserve the final pre-implementation document baseline.

**Scope**
- `DISCOVERY.md`
- `SPEC.md`
- `AGENT_SYSTEM.md`
- `SCAFFOLD.md`
- `AGENTS.md`
- `PLANS.md`

**Required dependencies**
- None

**Preferred prerequisites**
- None

**Out of scope**
- Product implementation work
- Scaffold expansion beyond approved baseline

**Task queue**
- [x] Lock product intent and constraints
- [x] Lock agent governance and handoff model
- [x] Lock scaffold direction and execution-plan rules
- [x] Finalize `AGENTS.md` at the locked operating-map level
- [x] Finalize `PLANS.md` at the locked execution-plan level

**Acceptance checks**
- Human confirms the document baseline is sufficient for implementation
- No unresolved hard-stop ambiguity remains in the core operating model
- `AGENTS.md` and `PLANS.md` are stable enough to guide Codex execution

**Status**
- done

**Notes / blockers**
- Baseline locked. Keep immutable documents unchanged during execution.

**Open risks**
- Final operating-map wording may still drift if downstream execution rules change
- Final execution-plan wording may still drift if scaffold completion rules change

---

## Milestone 1 ? Scaffold foundation
**Goal**
Create the initial repository skeleton and baseline development environment.

**Scope**
- Workspace scaffold
- Main app shell
- Shared package baseline
- Recommendation boundary baseline
- Environment/config discipline
- Test harness wiring

**Required dependencies**
- Milestone 0 sufficiently locked for implementation start

**Preferred prerequisites**
- Final wording of `SCAFFOLD.md` available before large structural commits

**Out of scope**
- Billing
- Collaboration
- Production deployment pipeline
- Advanced observability

**Task queue**
- [x] Implement approved workspace-level repository structure
- [x] Set up the main workspace shell and auth callback route baseline
- [x] Create the shared package baseline (`types`, `contracts`, `i18n`)
- [x] Create the recommendation service-like boundary
- [x] Establish `.env` discipline and secrets-touch prohibition in code structure
- [x] Set up lint, typecheck, unit smoke, and build smoke commands

**Acceptance checks**
- The repository boots successfully in the approved scaffold shape
- Shared and recommendation boundaries exist in code structure
- Baseline validation commands run without error
- No scaffold decision conflicts with `SPEC.md` or `SCAFFOLD.md`

**Status**
- done

**Notes / blockers**
- Route scaffold-wide structural changes through `Version Control`
- Activation note (2026-04-14): first implementation slice is limited to the approved workspace-level repository structure only. Do not silently choose framework/runtime/build-tool vendors or expand into route wiring, environment setup, or test harness wiring until that structure is in place.
- Version Control review on 2026-04-14 returned `WARN`, not `BLOCK`, for the scaffold-structure slice. Required rollback path: remove only the newly added scaffold placeholders/directories and any loop-log updates tied to this slice.
- Proposal resolved (2026-04-15): Milestone 1 proceeded after human approval of the initial stack decision: `npm` workspaces + TypeScript, React + Vite for `frontend`, Fastify for `backend`, module-local recommendation code on Node/TypeScript, Vitest for unit smoke, and Playwright for route-level e2e smoke.

**Open risks**
- Workspace boundaries may be under-specified until initial code lands
- Environment discipline can drift if provider choices are made too early

---

## Milestone 2 ? Core story domain and persistence
**Goal**
Implement the core domain model and persistence behavior for story work.

**Scope**
- Project model
- Episode model
- Object model
- Node model
- Temporary drawer model
- Stable IDs
- Local metadata and lightweight global registry
- Guest/local persistence and logged-in/cloud persistence baseline

**Required dependencies**
- Milestone 1 complete enough to support persistence work

**Preferred prerequisites**
- Shared contracts/types baseline available before persistence hardening
- Auth boundary stub available before import/linkage flows are finalized

**Out of scope**
- Multi-user sync conflict UI
- Billing-bound persistence rules
- Advanced merge engine

**Task queue**
- [x] Define implementation-level data contracts for project/episode/object/node/drawer
- [x] Implement stable ID generation across all persisted entities
- [x] Implement project-level local metadata and lightweight global registry
- [x] Implement guest local-only persistence baseline
- [x] Implement logged-in cloud canonical persistence with local working cache
- [x] Implement duplicate-import prevention and local-to-cloud linkage behavior
- [x] Implement dependency-aware flush queue behavior

**Acceptance checks**
- Core story entities persist and reload correctly
- Stable IDs survive round-trip and import flows
- Guest projects remain usable locally without login
- Logged-in projects use cloud persistence while retaining local working cache
- Temporary drawer persists correctly in both supported modes
- Required validation for persistence/domain changes passes

**Status**
- done

**Notes / blockers**
- Any schema, migration, or rollback-sensitive persistence change should go through `Version Control`
- Version Control review on 2026-04-15 returned `WARN`, not `BLOCK`, for the shared-contract, persistence-boundary, and validation-command changes in this milestone. Required constraints: keep auth stub-only, keep the file-backed backend store as the provisional canonical-cloud substitute, and avoid provider/secrets/deployment scope expansion.

**Open risks**
- Sync/linkage edge cases may surface once login and cloud persistence are exercised together
- Local registry and project metadata may diverge if update order is mishandled
- Flush ordering may become brittle if dependency overrides are not explicit enough

---

## Milestone 3 ? Canvas v1
**Goal**
Deliver the core story-structure editing experience without depending on AI assistance.

**Scope**
- Main canvas lanes
- Global `+` creation flow
- Drag / placement / snapping
- Auto parent inference
- Manual connection-handle rewiring
- Selection / hover / visual states
- Temporary drawer interaction baseline
- Delete confirmation flow

**Required dependencies**
- Milestone 2 complete enough to support persistent node editing

**Preferred prerequisites**
- Shared types/contracts available for UI integration

**Out of scope**
- Multi-user editing
- Advanced analytics
- Non-essential secondary screens

**Task queue**
- [x] Implement lane layout and vertical flow model
- [x] Implement node creation from the global `+` flow
- [x] Implement drag, placement, and snapping behavior
- [x] Implement visible connection handles and manual rewiring
- [x] Implement selection, hover, and baseline node visual states
- [x] Implement delete confirmation and destructive-action handling
- [x] Implement temporary drawer movement and return flows

**Acceptance checks**
- A user can create, position, and rearrange nodes on the canvas
- Parent-child movement and rewiring behave predictably
- Temporary drawer movement works without data loss
- Delete flow is explicit and safe
- Relevant integration/e2e checks for core canvas flows pass

**Status**
- done

**Notes / blockers**
- Keep the canvas readable and avoid unnecessary UI noise
- Canvas v1 keeps visible slot targets for precise placement and movement alongside drag so the structure workflow stays explicit without widening into keyboard/undo work.

**Open risks**
- Node interactions may become noisy if visual states are over-specified
- Drag/rewire behavior may need iteration to avoid accidental structural changes
- Temporary drawer movement could expose hidden persistence bugs from Milestone 2

---

## Milestone 4 ? AI recommendation v1
**Goal**
Ship the first creator-controlled AI assistance loop.

**Scope**
- Node-level AI invocation
- Keyword cloud popover
- Keyword selection state
- Sentence suggestion fallback
- Chosen-keyword preservation in collapsed form
- English-first recommendation loop

**Required dependencies**
- Milestone 3 complete enough to support node interaction flows

**Preferred prerequisites**
- Recommendation boundary implemented
- Persistence layer able to store node state transitions
- A usable provider path available, even if provider choice remains provisional

**Out of scope**
- Automatic structural editing
- Full long-form drafting by AI
- Silent AI modification of episode structure
- Non-English shipped recommendation UX

**Task queue**
- [x] Implement node-level keyword-cloud request flow
- [x] Implement keyword selection and collapsed-preservation state
- [x] Implement fallback sentence suggestion path gated by selected keywords
- [x] Ensure AI only acts on explicit user request
- [x] Verify recommendation input/output contracts against the shared boundary

**Acceptance checks**
- Keyword-first recommendation works end-to-end
- Sentence fallback requires at least one keyword
- AI does not silently edit structure or override creative control
- Relevant integration/e2e checks for recommendation flows pass
- Recommendation behavior remains aligned with `SPEC.md`

**Status**
- done

**Notes / blockers**
- Preserve creative ownership and explicit-invocation behavior
- Recovery note (2026-04-15): the Milestone 4 implementation had already landed across frontend/backend/recommendation code, so this loop reconciled `PLANS.md` to the recovered state and repaired one ambiguous e2e locator without changing shipped behavior.

**Open risks**
- Recommendation UX may still feel too generic without more context tuning
- Provider choice may affect reliability before final vendor selection
- Keyword and fallback behaviors may need iteration to avoid over-assisting

---

## Milestone 5 ? Reference objects and editing surfaces
**Goal**
Connect project-level objects and detailed editing surfaces to the canvas workflow.

**Scope**
- Top reference-object bar
- Manual object creation
- Search / reuse / insertion behavior
- Right-side detail panel for nodes and objects
- Viewport recenter behavior during detail editing

**Required dependencies**
- Milestone 3 complete enough for editor interaction work

**Preferred prerequisites**
- Object model and persistence usable
- Shared contracts for object handling available

**Out of scope**
- Collaboration mentions/comments
- Advanced object taxonomy management
- Separate object-management application surface

**Task queue**
- [x] Implement the top reference-object bar
- [x] Implement object creation, search, and insertion behavior
- [x] Implement the right-side detail panel for node/object editing
- [x] Implement viewport recenter behavior when detail editing begins
- [x] Verify that object usage remains distinct from temporary local drawer nodes

**Acceptance checks**
- Reference objects are accessible across the project
- Node and object detail editing does not break canvas comprehension
- Viewport recenter behavior is stable and predictable
- Relevant integration/e2e checks for object and detail-editing flows pass

**Status**
- done

**Notes / blockers**
- Keep project-level objects separate from episode-local temporary storage semantics
- Completion note (2026-04-15): Milestone 5 landed as a frontend-only execution slice on top of the existing object persistence model, with searchable top-bar object reuse, opt-in detail editing for nodes/objects, and regression coverage that keeps object workflows distinct from temporary drawer behavior.

**Open risks**
- Object editing surfaces may overload the workspace if panel behavior is too dense
- Object persistence and canvas references may drift if contracts are weak
- Viewport recentering may feel disorienting without careful defaults

---

## Milestone 6 ? Stabilization and quality gates
**Goal**
Harden the baseline for iterative product development.

**Scope**
- Test expansion
- Regression coverage
- Edge-case cleanup
- Error-state handling
- Save/sync sanity checks
- Keyboard and undo/redo verification

**Required dependencies**
- Milestones 3?5 complete enough for integrated validation

**Preferred prerequisites**
- Quality-gate strategy from `SCAFFOLD.md` implemented

**Out of scope**
- Billing
- Collaboration
- Full conflict-resolution UI
- Production deployment hardening

**Task queue**
- [x] Expand tests for critical canvas, persistence, and recommendation interactions
- [x] Verify undo/redo and keyboard interaction reliability
- [x] Review save/import/sync failure paths
- [x] Review relevant error states and user-safe fallback behavior
- [x] Produce implementation risk summary for unresolved issues

**Acceptance checks**
- Relevant checks pass reliably
- Known critical regressions are covered
- Save/import/sync flows have no unresolved baseline-breaking defect
- Root-cause patterns are documented for unresolved non-blocking issues

**Status**
- done

**Notes / blockers**
- Do not weaken test rules to move faster
- Completion note (2026-04-15): Milestone 6 added controller-backed in-session history, keyboard shortcuts, and visual undo/redo controls, then expanded regression coverage across canvas/object/detail/recommendation flows plus import/sync failure-path fallback behavior without widening into new product meaning.

**Open risks**
- Copy/paste currently uses an in-memory workspace clipboard rather than the system clipboard because no cross-session clipboard contract exists yet
- History is snapshot-based, so very large workspaces may eventually need more efficient diff-based history
- Baseline stability may still depend on provider-specific quirks not yet fixed

---

## Milestone 7 ? Baseline release gate
**Goal**
Confirm that the implementation baseline is ready for ongoing product iteration.

**Scope**
- Final baseline validation
- Hard-stop review
- Remaining blocker review
- Documentation/plan alignment check

**Required dependencies**
- Milestones 1?6 complete or intentionally deferred without violating baseline integrity

**Preferred prerequisites**
- Risk profile narrowed enough for stable iteration

**Out of scope**
- New feature work
- Scope expansion beyond the approved baseline

**Task queue**
- [x] Confirm no unresolved hard-stop condition remains
- [x] Confirm all required milestone acceptance checks are satisfied or intentionally deferred
- [x] Confirm validation results are reported and traceable
- [x] Confirm baseline plan/docs remain aligned enough for continued development

**Acceptance checks**
- No unresolved hard-stop condition remains
- Required validations for the baseline pass
- Remaining deferred items are explicit and non-blocking
- The project is in a stable enough state for the next implementation cycle
- If medium-risk issues remain, obtain human sign-off before marking this milestone done

**Medium-risk examples**
- Core flows work, but sync/import behavior still shows meaningful instability
- No hard stop exists, but regression confidence remains weak enough to threaten the next implementation cycle
- Edge-case data loss or recovery behavior is still plausible even though the baseline is broadly functional

**Medium-risk guidance**
Examples of medium-risk issues include:
- the core baseline works, but import/sync stability is still meaningfully uncertain
- no hard stop remains, but regression confidence is still weak in an important flow
- edge-case behavior may still risk data loss or structural inconsistency

**Status**
- done

**Notes / blockers**
- Treat this as a release-style baseline gate, not a feature milestone
- Release-gate recovery (2026-04-15): the reopened implementation slice restored the locked-spec baseline in the visible workspace shell by making the right panel opt-in instead of always open, reintroducing inline-first node editing, aligning the bottom-right floating controls, and restoring selected-node fold plus `More -> Important / Fixed` behavior.
- Release-gate recovery (2026-04-15): the flaky `unit smoke` path in `frontend/src/routes/WorkspaceShell.test.tsx` was stabilized by splitting the overloaded detail/object persistence assertions into smaller tests and tightening the UI selectors used during persistence checks.

**Open risks**
- Recommendation-provider behavior remains heuristic/provisional by design and may still need later tuning, but it does not block the current baseline gate
- Workspace copy/paste remains local and in-memory, and undo/redo remains snapshot-based, which is acceptable for the current baseline but should be revisited in future iteration planning

---

## Work-loop update log
Use this section as an append-only execution log.
If `Approval needed` is `proposal_change`, record the event in the loop log and also summarize the active proposal in the current milestone's `Notes / blockers` section.

### Loop template
- Date / loop ID:
- Active milestone:
- Agents engaged:
- Touched zones:
- What changed:
- Tests run:
- Result:
- Warnings / blockers:
- Approval needed: `none` / `hard_stop` / `proposal_change`
- Next step:

### 2026-04-14 / loop-001
- Active milestone: Milestone 1 ??Scaffold foundation
- Agents engaged: Orchestrator
- Touched zones: `PLANS.md`
- What changed: Moved Milestone 1 from `pending` to `ready` and reduced the first implementation slice to the workspace-level repository structure only.
- Tests run: None. Planning-only turn; no implementation changes were made.
- Result: Milestone 1 is activated for execution planning, and the next concrete implementation step is defined without widening scope.
- Warnings / blockers: Framework/runtime/build-tool choice remains deferred. Root scaffold structure work must route through `Version Control` before implementation.
- Approval needed: `none`
- Next step: Route the scaffold-structure slice through `Version Control`, then implement only the minimal repository skeleton for frontend, backend, recommendation, and shared boundaries.

### 2026-04-14 / loop-002
- Active milestone: Milestone 1 ??Scaffold foundation
- Agents engaged: Orchestrator, Version Control
- Touched zones: `PLANS.md`, `frontend/`, `backend/`, `recommendation/`, `shared/`
- What changed: Passed the required Version Control gate with a `WARN` judgment, created the minimal scaffold boundary directories with placeholders, marked the repository-structure task complete, and moved Milestone 1 to `in_progress`.
- Tests run: `git diff --check`; filesystem verification of `frontend/`, `backend/`, `recommendation/`, `shared/types/`, `shared/contracts/`, and `shared/i18n/`
- Result: The approved workspace-level repository structure now exists without choosing a framework, runtime, build tool, route implementation, environment wiring, or test harness.
- Warnings / blockers: Standard quality-gate categories are not yet relevant for this placeholder-only structural slice because no runnable code, toolchain, or validation commands exist yet. Framework/runtime/build-tool selection remains deferred.
- Approval needed: `none`
- Next step: Create the minimal shared package baseline inside the new scaffold boundaries without choosing vendor tooling or expanding into app-shell implementation.

### 2026-04-15 / loop-003
- Active milestone: Milestone 1 ??Scaffold foundation
- Agents engaged: Orchestrator, Version Control
- Touched zones: `PLANS.md`, `shared/`
- What changed: Added neutral README baselines for the shared package and its `types`, `contracts`, and `i18n` folders, then marked the shared-package-baseline task complete.
- Tests run: `git diff --check`; content verification of `shared/README.md`, `shared/types/README.md`, `shared/contracts/README.md`, and `shared/i18n/README.md`
- Result: The shared boundary now has explicit scope and deferral rules without choosing framework/runtime/build tooling or introducing concrete shared schemas.
- Warnings / blockers: Version Control review determined the gate was not triggered because this slice remained documentation-only inside the approved shared boundary. `lint`, `typecheck`, `unit smoke`, `integration`, `build smoke`, and `e2e smoke` remain not relevant because no runnable code or toolchain has been introduced yet.
- Approval needed: `none`
- Next step: Create the minimal recommendation service-like boundary baseline without choosing provider, framework, runtime, or transport details.

### 2026-04-15 / loop-004
- Active milestone: Milestone 1 ??Scaffold foundation
- Agents engaged: Orchestrator
- Touched zones: `PLANS.md`, `recommendation/`
- What changed: Added neutral README baselines for the recommendation boundary and its `context`, `contracts`, `provider`, and `orchestration` folders, then marked the recommendation service-like boundary task complete.
- Tests run: `git diff --check`; content verification of `recommendation/README.md`, `recommendation/context/README.md`, `recommendation/contracts/README.md`, `recommendation/provider/README.md`, and `recommendation/orchestration/README.md`
- Result: The recommendation module now has an explicit service-like boundary shape without choosing provider, framework, runtime, transport, or concrete recommendation schemas.
- Warnings / blockers: `lint`, `typecheck`, `unit smoke`, `integration`, `build smoke`, and `e2e smoke` remain not relevant because this slice stayed documentation-only and introduced no runnable code or toolchain. No specialist handoff was needed because the change did not cross the configured Version Control gates.
- Approval needed: `none`
- Next step: Establish the minimal `.env` discipline and secrets-touch prohibition baseline in code structure without introducing real secrets, auth wiring, provider credentials, or deployment behavior.

### 2026-04-15 / loop-005
- Active milestone: Milestone 1 ??Scaffold foundation
- Agents engaged: Orchestrator
- Touched zones: `PLANS.md`
- What changed: Replanned Milestone 1 at full-milestone granularity, retried for a framework-neutral completion path, and escalated the remaining work as a `proposal_change` because the milestone now requires an explicit stack decision.
- Tests run: `node --version`; `npm.cmd --version`; `git --version`; `git diff --check`
- Result: Milestone 1 cannot be completed safely without choosing the initial framework/runtime/build-tool stack for the app shell, auth callback route, environment wiring, and validation commands.
- Warnings / blockers: Deferred scaffold decisions explicitly include framework/runtime choice. Proceeding without approval would silently resolve a deferred decision and could force avoidable rework across frontend, backend, recommendation wiring, and validation setup.
- Approval needed: `proposal_change`
- Next step: Obtain human approval on the recommended initial stack, then complete the full Milestone 1 implementation in one pass.

### 2026-04-15 / loop-006
- Active milestone: Milestone 1 ??Scaffold foundation
- Agents engaged: Orchestrator, Version Control
- Touched zones: root workspace config, `frontend/`, `backend/`, `shared/`, `recommendation/`, `e2e/`, `PLANS.md`
- What changed: Implemented the approved Milestone 1 stack end-to-end with npm workspaces, React + Vite frontend shell, Fastify backend baseline, shared and recommendation TypeScript packages, environment example/config discipline, validation scripts, and route-level e2e smoke coverage.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run build`; `npm.cmd run e2e`; `git diff --check`
- Result: Milestone 1 acceptance checks passed. The repository now boots in the approved scaffold shape, shared and recommendation boundaries exist in code, and the baseline validation commands complete successfully.
- Warnings / blockers: Version Control review returned `WARN`, not `BLOCK`, because the milestone touched root scaffold and framework/build-tool boundaries. `integration` was not relevant because this milestone did not implement persistence flows, auth provider integration, or recommendation/backend orchestration. `e2e smoke` was relevant because the workspace shell and auth callback route baseline were introduced, so a Playwright smoke pass was added and run.
- Approval needed: `none`
- Next step: Begin Milestone 2 ??Core story domain and persistence from the now-ready baseline.

### 2026-04-15 / loop-007
- Active milestone: Milestone 2 ??Core story domain and persistence
- Agents engaged: Orchestrator, Version Control
- Touched zones: root TypeScript/build config, `shared/`, `backend/`, `frontend/`, `e2e/`, `PLANS.md`
- What changed: Completed the Milestone 2 domain and persistence baseline with shared story/persistence contracts, backend file-backed canonical persistence routes, frontend stable-ID/local-registry/local-cache/auth-stub orchestration, duplicate-import/reconnect behavior, dependency-aware flush ordering, and milestone-specific unit/integration/e2e coverage.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `git diff --check`
- Result: Milestone 2 acceptance checks passed. Core story entities now persist and reload, guest mode remains locally usable, logged-in mode uses canonical cloud-baseline persistence with a local working cache, and temporary drawer data survives in both supported modes.
- Warnings / blockers: Version Control review returned `WARN`, not `BLOCK`, because the milestone touched shared contracts/types, cross-boundary persistence logic, and build/test command behavior. Auth remained stub-only and the backend file store remained a provisional canonical-cloud substitute, so no hard stop was crossed. The backend integration command requires a thread-based Vitest pool in this environment because forked worker startup was not reliable under the current sandbox.
- Approval needed: `none`
- Next step: Begin Milestone 3 ??Canvas v1, starting with lane layout plus global `+` node creation on top of the now-persistent workspace state.

### 2026-04-15 / loop-008
- Active milestone: Milestone 3 ??Canvas v1
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, `PLANS.md`
- What changed: Completed the persistent canvas v1 baseline with three-lane canvas layout, global `+` node placement, subtree movement, slot-based placement fallbacks, visible connection handles with manual rewiring, selection/hover states, delete confirmation, temporary drawer subtree round-trips, and milestone-specific frontend/e2e coverage.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `git diff --check`
- Result: Milestone 3 acceptance checks passed. Users can create, position, rearrange, rewire, park, restore, and explicitly delete story nodes on the persisted canvas baseline.
- Warnings / blockers: `integration` remained green even though no backend implementation changed in this loop; it was still run because the canvas baseline depends on the persistence round-trip introduced in Milestone 2. Drag remains available, and slot-based placement/movement stays present as a precision fallback for explicit canvas editing.
- Approval needed: `none`
- Next step: Begin Milestone 4 ??AI recommendation v1 from the now-ready canvas baseline, starting with the node-level keyword-cloud request flow.

### 2026-04-15 / loop-009
- Active milestone: Milestone 4 ??AI recommendation v1
- Agents engaged: Orchestrator
- Touched zones: `e2e/`, `PLANS.md`
- What changed: Recovered the lost Milestone 4 execution state by confirming the keyword-cloud, keyword-selection, sentence-fallback, and shared-contract recommendation flow was already implemented in code, then repaired one ambiguous Playwright locator in the recommendation smoke test and marked the milestone done in `PLANS.md`.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; retry after blocker: `npm.cmd run lint`; `npm.cmd run e2e`
- Result: Milestone 4 acceptance checks passed. Keyword-first recommendation now validates end-to-end with explicit invocation, keyword-gated sentence fallback, persistence of chosen keywords, and green integration/e2e coverage.
- Warnings / blockers: Initial `e2e smoke` hit a BLOCK because the saved-keyword assertion used an overly broad text locator after reload. Replan/retry resolved it with a scoped locator in the saved-keyword stack. Provider behavior remains heuristic/provisional, which is acceptable within the current milestone scope.
- Approval needed: `none`
- Next step: Begin Milestone 5 ??Reference objects and editing surfaces with only the top reference-object bar shell, keeping object creation, search, insertion, and right-panel behavior deferred until after that first slice is stable.

### 2026-04-15 / loop-010
- Active milestone: Milestone 5 ??Reference objects and editing surfaces
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, `PLANS.md`
- What changed: Completed Milestone 5 with controller-backed object create/update/attach flows, a searchable top reference-object bar, opt-in node/object detail editing in the right panel, a node-detail recenter hook, and regression coverage that confirms reference objects stay separate from temporary drawer state.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; retry during work loop: `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run build`; `npm.cmd run e2e`; final confirmation: `npm.cmd run lint`
- Result: Milestone 5 acceptance checks passed. Reference objects are accessible across the project, reusable from the top bar, editable without breaking canvas comprehension, and validated through unit/integration/e2e coverage.
- Warnings / blockers: Two BLOCKs were resolved inside the retry budget. First, frontend typecheck failed because of duplicate local derivations introduced while wiring the recenter hook. Second, the existing canvas e2e needed a more precise node click target after the Milestone 5 UI changes. Neither issue required scope expansion or human escalation.
- Approval needed: `none`
- Next step: Begin Milestone 6 ??Stabilization and quality gates with the smallest slice: expand regression coverage around the newly added reference-object/detail-editing flows before moving into undo/redo or broader error-state work.

### 2026-04-15 / loop-011
- Active milestone: Milestone 6 ??Stabilization and quality gates
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, `PLANS.md`
- What changed: Completed the Milestone 6 stabilization slice with controller-backed undo/redo history, in-workspace copy/paste duplication, keyboard shortcuts for escape/delete/enter/history, visual undo/redo controls, deeper regression coverage around object/detail and recommendation flows, and failure-path tests confirming local-cache safety through import/sync errors.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`
- Result: Milestone 6 acceptance checks passed. Relevant gates are green, critical canvas/persistence/recommendation regressions are more tightly covered, keyboard/history behavior is validated, and import/sync failure paths keep the local baseline usable.
- Warnings / blockers: Two BLOCKs were resolved inside the retry budget. First, the new history/shortcut slice hit a frontend typecheck/lint failure from a missing import and test override typing. Second, the new keyboard e2e initially kept focus on an interactive control, so `Enter` missed the workspace shortcut path until the test explicitly reset focus. Copy/paste remains workspace-local and in-memory by design for now.
- Approval needed: `none`
- Next step: Begin Milestone 7 ??Baseline release gate by confirming no unresolved hard-stop condition or medium-risk baseline issue remains before the next implementation cycle.

### 2026-04-15 / loop-012
- Active milestone: Milestone 7 ??Baseline release gate
- Agents engaged: Orchestrator
- Touched zones: `PLANS.md`
- What changed: Audited the current implementation against the locked release-gate criteria, reran the full baseline validation family, and recorded the gate as escalated instead of done because the baseline currently shows both locked-spec drift in visible workspace behavior and a fresh `unit smoke` timeout in the frontend suite.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`
- Result: Milestone 7 cannot be marked complete yet. `lint`, `typecheck`, `integration`, `build smoke`, and `e2e smoke` passed, but `unit smoke` failed on this release-gate run, and the implementation baseline still diverges from locked `SPEC.md` expectations in ways that require human judgment before the baseline can be accepted as-is.
- Warnings / blockers: BLOCK -> replan -> retry was followed. The release-gate audit found unresolved spec-to-implementation drift around right-panel default visibility, bottom-right floating control composition, inline-first editing, and selected-node quick actions. A targeted retry after the `npm.cmd test` timeout did not produce a clean confirmation path in this environment, so regression reliability remains uncertain.
- Approval needed: `hard_stop`
- Next step: Human decision support: choose whether to reopen implementation work for the missing spec-aligned UX behaviors and unit-smoke stability, or explicitly approve deferring those requirements before Milestone 7 can be closed.

### 2026-04-15 / loop-013
- Active milestone: Milestone 7 ??Baseline release gate
- Agents engaged: Orchestrator
- Touched zones: `shared/`, `frontend/`, `e2e/`, `PLANS.md`
- What changed: Reopened only the smallest Milestone 7 recovery slice needed to close the release gate: aligned the workspace shell back to the locked spec with an opt-in right panel, inline-first node editing, bottom-right floating create/undo/redo/drawer controls, and selected-node fold plus `More -> Important / Fixed` actions; added persisted node visual-state support; and stabilized the overloaded frontend persistence test path.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; final confirmation after the last selector/stacking fixes: `npm.cmd run lint`; `npm.cmd run build`; `npm.cmd run e2e`
- Result: Milestone 7 acceptance checks passed. No unresolved hard stop remains, the implementation baseline is aligned with the locked release-gate expectations closely enough for continued iteration, and the full relevant validation set is green.
- Warnings / blockers: Earlier BLOCK conditions were resolved inside the retry budget. Remaining risks are explicit and non-blocking: recommendation behavior is still heuristic/provisional, and local copy/paste plus snapshot-based history remain intentionally modest for now.
- Approval needed: `none`
- Next step: Human planning step: define the next smallest post-baseline milestone before widening implementation scope again.

### 2026-04-15 / loop-014
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/public/`, `PLANS.md`
- What changed: Added a standalone review entry HTML that loads the live workspace app in an iframe, offers desktop/tablet/mobile viewport presets, and keeps a manual UI/UX checklist in one place for faster baseline review.
- Tests run: `npm.cmd run build`
- Result: The new review entry is compatible with the current frontend build and is emitted alongside the app for served preview use.
- Warnings / blockers: The review entry should be opened through Vite dev or a static preview server. Direct `file://` opening is not reliable because the main app bundle still uses root-relative asset paths.
- Approval needed: `none`
- Next step: Optional follow-up only if requested: add a richer scripted demo flow or capture-ready review notes on top of this HTML entry.

### 2026-04-15 / loop-015
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `PLANS.md`
- What changed: Replaced the previously added checklist-style review wrapper with a real second frontend app entry, `service.html`, that mounts the existing SCENAAIRO app directly. Added the minimal Vite multi-page input wiring so the service entry is emitted during build alongside `index.html`.
- Tests run: `npm.cmd run build`
- Result: The actual service HTML entry now exists for both dev and build-served usage as `/service.html`, and the frontend build emits `dist/service.html` successfully.
- Warnings / blockers: This page should still be opened through Vite dev or a static server. Direct `file://` opening is not reliable because the app bundle uses served asset paths.
- Approval needed: `none`
- Next step: Optional follow-up only if requested: add another dedicated real-app entry for a specific mode or environment, but no further scope is needed for the current ask.

### 2026-04-15 / loop-016
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: root workspace, `PLANS.md`
- What changed: Added a root-level launcher HTML, `OPEN-SCENAAIRO.html`, so the live service link is immediately visible from the `ARIAD` folder without digging into `frontend/`. Kept the real app entry at `/service.html` unchanged.
- Tests run: `npm.cmd run build`
- Result: The root launcher is in place, and the frontend service entry still builds cleanly as `dist/service.html`.
- Warnings / blockers: The root launcher points to the dev-served URLs, so `npm run dev:frontend` must be running before the live link will open successfully.
- Approval needed: `none`
- Next step: Optional follow-up only if requested: add a root-level launcher for backend health or a combined start script, but no more changes are required for the current request.

### 2026-04-15 / loop-017
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: root workspace, `PLANS.md`
- What changed: Added `OPEN-SCENAAIRO.cmd` as a one-click Windows launcher that starts the backend and frontend dev servers in separate terminals, waits briefly for boot, and opens the live `/service.html` entry automatically. Updated the root helper HTML so it now points users to the `.cmd` launcher first.
- Tests run: `npm.cmd run build`
- Result: The root one-click startup path now exists, and the existing frontend service entry still builds cleanly.
- Warnings / blockers: The launcher assumes `npm.cmd` is available in `PATH`. Running it repeatedly will open additional backend/frontend terminals rather than reusing existing ones.
- Approval needed: `none`
- Next step: Optional follow-up only if requested: add a smarter launcher that detects already-running ports before opening new terminals.

### 2026-04-15 / loop-018
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: root workspace, `frontend/scripts/`, `frontend/`, `PLANS.md`
- What changed: Reworked `OPEN-SCENAAIRO.cmd` into a readiness-checked launcher that verifies required commands, reuses an existing frontend build by default, starts backend/frontend servers through clearer PowerShell windows, and opens the browser only after the backend health URL plus `/service.html` respond. Added a small Node dist server for the frontend that serves `frontend/dist` directly and proxies `/api` to the backend, so the launcher no longer depends on the more fragile Vite dev/preview path for runtime startup.
- Tests run: `npm.cmd run build`; launcher self-test: `cmd.exe /c "set SCENAAIRO_NO_BROWSER=1&& call OPEN-SCENAAIRO.cmd"`; direct runtime verification: started `node backend/dist/server.js` plus `node frontend/scripts/serve-dist.mjs`, then confirmed `http://127.0.0.1:5173/service.html` and `http://127.0.0.1:5173/api/health` both returned `200`
- Result: The hardened launcher completed successfully in self-test, and the new frontend dist server plus backend runtime path served the app entry and proxied API health correctly.
- Warnings / blockers: In this sandbox, separately spawned GUI windows are not durable enough to re-query from a later shell command after the parent process exits, so the strongest runtime confirmation came from the inline launcher success path plus the direct process-level verification of the same backend/dist-server pair. On a normal Windows desktop, the launcher should open separate persistent windows as intended.
- Approval needed: `none`
- Next step: Optional follow-up only if requested: add PID/port-based reuse logic so repeated launcher runs attach to already-running SCENAAIRO windows instead of opening new ones.

### 2026-04-15 / loop-019
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: root workspace, `PLANS.md`
- What changed: Added a root-level `ARIAD.html` entry that lives directly in the `ARIAD` folder, checks whether the local service at `/service.html` is reachable, automatically forwards into the real SCENAAIRO app when it is, and otherwise stays on a minimal recovery screen that tells the user to run `OPEN-SCENAAIRO.cmd` and retry.
- Tests run: static sanity check only: verified the new root HTML contains the live service URL, auto-forward logic, and launcher fallback copy
- Result: The repo now has a direct root HTML entry for using the live ARIAD service without digging into `frontend/` or a helper-only page first.
- Warnings / blockers: Scaffold quality-gate categories (`lint`, `typecheck`, `unit smoke`, `integration`, `build smoke`, `e2e smoke`) were not relevant for this slice because it only added a standalone root support HTML outside the frontend build/runtime code paths.
- Approval needed: `none`
- Next step: Optional follow-up only if requested: wire the same direct-entry experience into a desktop shortcut or a packaged Windows-friendly launcher, but no further scope is required for the current ask.

### 2026-04-15 / loop-020
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `PLANS.md`
- What changed: Diagnosed the failed local-service launch report without widening into implementation. Confirmed from the current codebase that SCENAAIRO does not require Supabase or another external backend to boot locally, because the frontend is a served React app and the backend is a local Fastify process with file-backed local persistence defaults. Reproduced the real runtime successfully by starting `node backend/dist/server.js` and `node frontend/scripts/serve-dist.mjs`, then confirming both `http://127.0.0.1:3001/api/health` and `http://127.0.0.1:5173/service.html` returned `200`. Re-ran the existing `OPEN-SCENAAIRO.cmd` self-test and confirmed the launcher also reports both backend and frontend ready in this environment.
- Tests run: `node --version`; direct runtime verification by starting `node backend/dist/server.js` and `node frontend/scripts/serve-dist.mjs`, then checking `http://127.0.0.1:3001/api/health` and `http://127.0.0.1:5173/service.html`; launcher self-test: `cmd.exe /c "set SCENAAIRO_NO_BROWSER=1&& call OPEN-SCENAAIRO.cmd"`
- Result: The service is runnable locally without Supabase. The current failure mode is therefore not "missing hosted backend" but a launch-path/usability gap: `ARIAD.html` is only a root entry/forwarder, not a self-hosting app, and the actual service still depends on a live local frontend server on `5173` plus a live local backend on `3001`.
- Warnings / blockers: A browser showing only the yellow root helper page or "This site can't be reached" at `127.0.0.1:5173` means the local service process pair was not actually reachable at the moment of access. If the user-facing one-click flow remains unreliable on their machine, the next smallest fix is to replace the current detached-window launcher with a more observable single-process bootstrapper or stronger per-process logging so startup failures are visible immediately.
- Approval needed: `none`
- Next step: If requested, implement a more reliable local bootstrap path that either starts both services under one orchestrated Node launcher or emits explicit backend/frontend log files plus failure messages for the double-click flow.

### 2026-04-15 / loop-021
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator, launcher-diagnosis specialist, proof-review specialist
- Touched zones: root workspace, `scripts/`, `PLANS.md`
- What changed: Replaced the previous detached-window launcher path with a PowerShell bootstrap that the root `.cmd` now calls directly, added persistent launcher/backend/frontend log files plus pid tracking, removed the misleading auto-offline helper behavior from `ARIAD.html`, and then proved the `.cmd` path can drive the local service into a live-running state where both `http://127.0.0.1:3001/api/health` and `http://127.0.0.1:5173/service.html` respond successfully. The repair loop included one retry after a frontend bootstrap failure caused by a quoted `cmd set` bug that left a trailing space in `127.0.0.1 `; that quoting issue was fixed and the launcher proof then passed. A final specialist review judged the evidence sufficient to claim local verification is now possible.
- Tests run: `npm.cmd run build`; failing proof attempt: `cmd.exe /c "set SCENAAIRO_NO_BROWSER=1&& set SCENAAIRO_EXIT_ON_READY=1&& call OPEN-SCENAAIRO.cmd"` followed by launcher-log / frontend-log review; passing proof attempt: `cmd.exe /c "set SCENAAIRO_NO_BROWSER=1&& call OPEN-SCENAAIRO.cmd"` launched in a hidden process, then verified `backend_ready=True`, `service_ready=True`, fetched `http://127.0.0.1:3001/api/health`, and fetched `http://127.0.0.1:5173/service.html` while the launcher session was active
- Result: The repaired root launcher reaches a usable local-running state and exposes enough logging for a user to diagnose failures instead of seeing only a dead helper page. Within this environment, the strongest proof is the live launcher session because sandbox cleanup may reclaim detached descendants after the parent command exits.
- Warnings / blockers: No hard stop was touched. Remaining caveat: persistence of detached background processes after the parent shell exits is environment-dependent in this sandbox, so the proof standard used here is "service reachable in the launched session", which the specialist review accepted as sufficient for local verification.
- Approval needed: `none`
- Next step: Optional follow-up only if requested: add a dedicated stop script or Windows shortcut flow, but no further scope is required for the current ask.

### 2026-04-15 / loop-022
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: root workspace, `frontend/`, `scripts/`, `PLANS.md`
- What changed: Removed the remaining helper/launcher dependency from the root entry path by turning `ARIAD.html` into a real self-contained standalone app document built from the current frontend bundle. Added runtime detection so direct `file://` launches switch to standalone mode, use `HashRouter`, and replace the served `/api` clients with local-only persistence and heuristic recommendation shims. Added a small generation script to inline the built CSS and JS into the root `ARIAD.html`, then regenerated that file from the current build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; direct standalone proof: opened `file:///C:/Users/kimja/Desktop/ARIAD/ARIAD.html` in a headless browser and confirmed the workspace rendered with non-empty app text; interaction proof: repeated the same direct-file launch and verified `Create Node` changed the node count from `Nodes: 1` to `Nodes: 2`
- Result: The direct-open requirement is now satisfied. `ARIAD.html` no longer asks the user to run `CMD`, open another HTML file, or click `Open Live Service`; opening the root HTML file itself renders the SCENAAIRO workspace and supports real local canvas interaction.
- Warnings / blockers: No hard stop was touched. The standalone file is generated from the current frontend build, so future product changes should be followed by a rebuild/regeneration pass to keep `ARIAD.html` in sync.
- Approval needed: `none`
- Next step: Optional follow-up only if requested: wire the standalone HTML generation into a dedicated release/build command so future refreshes stay one-command simple.

### 2026-04-16 / loop-023
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Reworked the workspace UI around the requested brighter ivory-note theme and a new ARIAD-branded left shell. The old `Navigation` sidebar was replaced with a ChatGPT-inspired episode column that supports collapse/expand states, `New Episode`, `Search Episodes`, `Projects`, `More`, scrollable recents, per-episode pin/rename/delete actions, and a bottom profile control. To keep that redesign honest, active episode switching now scopes visible canvas nodes and drawer items to the selected episode instead of showing project-wide mixed state. Added episode controller coverage plus sidebar UI coverage, updated the existing app/e2e expectations to the new ARIAD shell, and regenerated the standalone root `ARIAD.html` from the latest frontend build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`; `npm.cmd run e2e`
- Result: The requested UI redesign slice is complete and the full relevant validation family is green. The app now opens with brighter ivory styling, ARIAD branding, a collapsible episode-focused left sidebar, and episode switching that actually changes the active workspace content.
- Warnings / blockers: The visible brand copy now says `ARIAD` by explicit user direction, but immutable discovery/spec documents were intentionally left untouched. The standalone HTML regeneration must continue to happen after future frontend builds so the root file stays in sync.
- Approval needed: `none`
- Next step: Continue with the next smallest visual slice only if requested, likely either the top object bar redesign or a canvas-card visual pass to match the new left-shell language more closely without widening into unrelated product behavior.

### 2026-04-16 / loop-024
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Rebuilt the top object bar into a much smaller object-library manager. Removed the visible `env / guest / nodes / drawer` chip row and the old descriptive/selected-object summary copy, replaced the top bar with a compact `Object Library` header row plus search and `Add New Object`, and swapped the object chip strip for compact rows that support attach/detach by clicking the object name, usage counts, pinning, delete, and sort modes for recent/oldest, most/least used, and A-Z/Z-A. Added controller support for deleting objects so the library and attached-node references stay consistent, updated copy/styling/tests for the new flow, and confirmed the standalone `ARIAD.html` bundle is in sync with the latest top-bar build output. This visual behavior intentionally diverges from the immutable spec's older "compact chips" wording, and that divergence was applied only because the human user explicitly requested the new manager layout.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`; `npm.cmd run e2e`
- Result: The requested top-bar redesign slice is complete and all relevant validation categories are green. The app now exposes a compact object-library bar with search, create, sort, pin, delete, and usage-aware ordering while keeping object-detail editing routed through the existing right-panel flow.
- Warnings / blockers: The right panel still includes a broader `Current objects` list because that was not part of this request. Future frontend changes still require rebuilding/regenerating the standalone root `ARIAD.html` so the direct-open file stays current.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest visual slice, likely a canvas-card polish pass or a right-panel cleanup pass so the rest of the workspace matches the new sidebar/top-bar language.

### 2026-04-16 / loop-025
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Completed the next UI pass across three requested zones without widening scope. The floating history controls were reordered and reduced to icon-first `undo / redo / drawer toggle / add node` buttons. The left shell was cleaned up by removing the visible `Workspace` label, removing the recents explanation line, collapsing recent episode entries to a single-line title row, and moving account/login actions into a bottom gray profile shell with an ellipsis menu instead of the previous top-level `More` action. The top object bar was tightened further by putting `Object Library`, search, `New Object`, and sort into one line, switching the object list to a six-across compact grid, keeping detail-open as the primary visible action, and moving pin/rename/delete into a per-object three-dot menu. Regenerated the standalone root `ARIAD.html` from the latest frontend build so direct-open usage stays aligned with the updated UI.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested sidebar/top-bar/control-bar refinement slice is complete and the full relevant validation family is green. The direct-open standalone file has been regenerated from the latest production assets.
- Warnings / blockers: The bottom profile shell now owns login/session actions, but the deeper account/recovery behavior itself is still the same deferred baseline as before. Future standalone refreshes still depend on build plus regeneration when frontend UI changes land.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest visual slice, likely the right panel cleanup or canvas-card visual system pass.

### 2026-04-16 / loop-026
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Reworked only the requested center-canvas and bottom-drawer slice. The center canvas was restyled toward the provided reference image by stripping away the heavy panel feel, converting the lane area into a sparse diagram-like composition with dashed vertical separators, a strong major-lane spine, arrowheaded connection lines, and smaller rounded white node cards with dark outlines. The inline status/editor controls were kept but moved into a lighter pre-canvas strip so they no longer sit on top of the lane hit targets. The temporary drawer was changed from an always-present layout row into an on-demand bottom sheet that appears only after explicit opening or after sending a node into it, and it now closes again after restoring an item back to the canvas so focus returns to the main story workspace. The direct-open root `ARIAD.html` was regenerated from the latest frontend bundle after the final build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested center redesign and bottom-sheet drawer behavior are complete and the full relevant validation family is green.
- Warnings / blockers: This is an intentionally user-directed visual divergence from the earlier baseline canvas styling, but it does not alter the underlying local persistence or recommendation scaffolds. Future UI work should continue to regenerate the standalone root file after frontend builds so `ARIAD.html` stays current.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest visual slice, likely the right-panel cleanup pass or a more detailed node-card content pass now that the overall center composition is aligned to the new reference direction.

### 2026-04-16 / loop-027
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Completed the requested cleanup of the story-canvas overlays, object menus, and left-sidebar scroll behavior without widening scope. Removed the visible cloud-status card and selected-node summary/editor strip from the canvas surface, keeping deep editing behind explicit `Edit Details` entry on the selected node card instead. Simplified the compact object rows so object details now live inside the per-object `...` menu, with the menu styled as a light popover rather than a row-expanding control. Removed the episode objective/explanation text from recents, kept episode actions inside each episode row, and reworked the sidebar into a divided layout with internal recents scrolling plus a bottom profile shell that stays pinned within the sidebar rather than participating in page-height growth. Updated unit/e2e coverage to the new DOM structure and regenerated the standalone root `ARIAD.html` from the final build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested canvas/sidebar/object-menu refinement slice is complete and the full relevant validation family is green.
- Warnings / blockers: The old overlay/select-card CSS remains partially present as dead styling and can be removed in a later cleanup pass if desired, but it no longer affects runtime behavior. Future UI work should continue to regenerate the standalone root file after frontend builds so `ARIAD.html` stays current.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest visual slice, likely the right-panel cleanup pass or a tighter node-card typography/content pass now that the sidebar and object interactions have been simplified.

### 2026-04-16 / loop-028
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Completed the requested refinement of the object detail panel, floating controls, fullscreen canvas entry, draft-node launcher placement, and popover dismissal behavior without widening scope. The right panel was simplified by removing the visible `Right Panel` framing and extra helper sections, adding a single top-right close control, and reducing object editing to only `Object Name`, `Category`, and `Information` in that order. The canvas now exposes an explicit fullscreen control, the draft-node launcher appears as a floating upper-layer card above the bottom-right controls instead of pushing the canvas layout, and the bottom-right controls now use stable icon rendering for undo/redo, drawer toggle, and add-node. Episode/object `...` menus now dismiss on outside click, support repeated-toggle close, and the object popover opens laterally instead of dropping beneath the object card. The object-library grid now sits inside an explicit scroll shell, and the standalone root `ARIAD.html` was regenerated from the final production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested right-panel/floating-control/popover refinement slice is complete and the full relevant validation family is green.
- Warnings / blockers: No hard stop was touched. The draft launcher and fullscreen control are user-directed UX additions that slightly extend the earlier baseline shell, so future UI iterations should continue to keep them aligned with the direct-open standalone build output.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest visual slice, likely the right-panel node-editing density cleanup or a more detailed canvas-card typography pass now that the supporting shell controls are in place.

### 2026-04-16 / loop-029
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `shared/`, `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Reworked the story-canvas node interaction model around the user's simplified horizontal-card reference without widening into unrelated areas. Added persistent free-placement coordinates (`canvasX`, `canvasY`) to the shared node contract and controller flow, replaced the old slot-first placement assumptions with lane-surface click/drop placement and free repositioning inside each lane, and made newly created nodes immediately selected with inline text input ready on placement or click. Node chrome was simplified so the card stays compact and horizontal, the fold state uses `<` / `>`, and node actions now live under the `...` menu, while non-major nodes automatically enter the attach/rewire flow right after placement so the user can connect them immediately. Updated unit and Playwright coverage to the new inline-first and menu-driven behavior, then regenerated the standalone root `ARIAD.html` from the final build output.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested node-design and free-placement slice is complete and the full relevant validation family is green.
- Warnings / blockers: This is a user-directed divergence from the earlier spec wording that described slot/snap-oriented placement, so future planning should treat the canvas as free-placement-within-lane unless the human redefines that behavior again. This loop also touched a version-control-sensitive shared-type boundary; rollback is straightforward if ever needed by reverting the `canvasX` / `canvasY` additions plus the placement wiring that consumes them.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest canvas refinement slice, likely either connection-handle visual cleanup or deeper node typography/content-density tuning now that free placement and inline editing are in place.

### 2026-04-16 / loop-030
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Reworked the left navigation into a folder-aware story list without widening into backend/shared persistence. Replaced the old `Projects` action with `New Folder`, reordered the sidebar actions to `New Episode -> New Folder -> Search`, changed the recents heading to `Recent Stories`, and introduced local sidebar metadata for folders, folder-scoped episode pinning, per-episode folder assignment, dissolve-from-folder, and folder-scoped drag-sort mode. The episode and object `...` popovers were repositioned and re-layered so they stay visually inside their cards and no longer cut against scroll containers, the object rows were compacted so the text and menu button sit closer together, and the bottom-right history controls were switched to centered visible glyphs so undo/redo/create/drawer icons render cleanly. The profile trigger now uses a simple human-style login silhouette instead of initials, and the standalone root `ARIAD.html` was regenerated from the final build output.
- Tests run: `npm.cmd run lint`; `npm.cmd test`; `npm.cmd run typecheck`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested sidebar/object-library/bottom-control refinement slice is complete and the full relevant validation family is green.
- Warnings / blockers: Folder membership, folder-scoped pinning, and folder order are currently stored as local UI metadata keyed by project rather than being promoted into the shared/cloud persistence contract. That was an intentional smallest-scope choice for this user-directed UX slice; if folders later need cloud-sync parity, the next step should be to formalize them in shared types and backend persistence rather than extending the current local-only metadata ad hoc.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest refinement slice, likely a deeper right-panel simplification pass or a browser-level drag-sort polish pass for folder episode ordering if you want that interaction to be visually richer.

### 2026-04-16 / loop-031
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: root workspace, `scripts/`, `PLANS.md`
- What changed: Repaired the direct-open standalone runtime after the root `ARIAD.html` started rendering as a blank page. The frontend bundle itself was still healthy, but the standalone generator script was reading UTF-8 build assets with Windows PowerShell's default encoding, which corrupted inline non-ASCII UI glyphs inside the bundled JavaScript and produced a browser `Unexpected identifier 'span'` syntax error at file-open time. Fixed the generator by forcing UTF-8 reads for the built `service.html`, CSS asset, and JS asset, then regenerated the root standalone HTML.
- Tests run: `npm.cmd run build`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`; direct standalone proof in headless Chromium by opening `file:///C:/Users/kimja/Desktop/ARIAD/ARIAD.html` and confirming no page errors plus visible ARIAD workspace content
- Result: The blank-screen regression is resolved. `ARIAD.html` now renders successfully again when opened directly via `file://`.
- Warnings / blockers: No hard stop was touched. Future standalone regeneration must continue to preserve explicit UTF-8 reads, otherwise visible non-ASCII glyphs in the bundled app can silently corrupt the inlined script again.
- Approval needed: `none`
- Next step: Resume only the next requested UI refinement slice, using the repaired standalone regeneration path after each frontend build.

### 2026-04-16 / loop-032
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, root workspace, `PLANS.md`
- What changed: Refined the story-canvas node and lane presentation around the user's latest feedback without widening into new feature areas. Simplified the draft-node launcher so it shows only a wider `New empty node` card plus shorter placement guidance, widened and flattened the node cards further, added visible connection ports on node edges so rewiring points are no longer visually lost, adjusted connection geometry so parent-side links and child-side arrowheads meet the node edges more cleanly, and made the `Fixed` action stateful as `Fix / Unfix`. Shrunk the canvas header and fullscreen button, kept the floating bottom-right controls visible in fullscreen, promoted the three lane titles into centered visible labels, added draggable lane splitters to rebalance the three columns interactively, and replaced the old implicit major-lane arrow growth with a draggable timeline-end handle so the timeline endpoint stays independent when major nodes move. Regenerated the standalone root `ARIAD.html` from the final build output.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested node/canvas refinement slice is complete and the full relevant validation family is green.
- Warnings / blockers: Lane splitter positions and timeline-end position are currently frontend-local view state only; they were intentionally kept out of shared persistence for this smallest-scope UX pass. If you later want those layout adjustments to persist per episode across devices, the next step should be a deliberate shared/backend contract change rather than extending the current local-only behavior ad hoc.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest canvas polish slice, likely typography/content-density cleanup inside node cards or a dedicated connection-handle interaction pass now that the lane geometry is adjustable.

### 2026-04-16 / loop-033
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, root workspace, `PLANS.md`
- What changed: Completed the requested sidebar-folder/object-library/node-display cleanup without widening into shared/backend persistence. Reworked folder cards so they now have their own `...` menu with local pin, rename, fold/unfold, sort-toggle, and delete actions, while episode menus now show `Add to Folder` only for root episodes and switch that slot to `Dissolve` once an episode already belongs to a folder. The folder destination list now opens as a separate popout to the right instead of appearing inline inside the episode menu, and empty folders no longer render a placeholder message beneath the card. In the object library, object-name clicks were changed to selection-only so usage counts do not change just by clicking; the per-object usage count now reflects only the active episode, and actual attach/detach moved behind the `...` menu. The object menu itself was lifted into an overlay layer so it no longer clips against the library scroll area or the canvas below. Node display was also tightened so saved multiline text keeps wrapping inside the node card instead of flattening into an overflowing single line. Regenerated the standalone root `ARIAD.html` from the latest build output.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested folder/object/node refinement slice is complete and the full relevant validation family is green.
- Warnings / blockers: Folder pin/collapse/order behavior is still intentionally local UI metadata rather than shared/cloud persistence. That keeps this slice small, but if folder state later needs account/cloud parity, the next step should be a deliberate shared-contract change rather than extending the current local-only metadata further.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest sidebar or node-polish slice, likely folder drag-order UX polish or deeper node typography cleanup now that folder/object menu behavior is stabilized.

### 2026-04-16 / loop-034
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, root workspace, `PLANS.md`
- What changed: Completed the requested story-canvas lane/timeline/floating-control refinement slice without widening into shared persistence. Moved the three lane names into a single top-aligned label row so all lanes read at the same height and no longer steal canvas placement space, replaced the full-height draggable lane splitters with dashed divider lines plus top-dot drag handles, centered the timeline end arrow on the major-lane rail, and added magnetic snapping so a major node dropped near the start or end anchor becomes the visible start/end event. The bottom-right control cluster now lives inside the fullscreen canvas container so undo/redo/drawer/create remain usable in fullscreen, and the drawer toggle arrow now points up while closed and down while open. Replaced the broken text glyph history icons with SVG icons and regenerated the standalone root `ARIAD.html` from the latest production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested canvas/floating-control refinement slice is complete and the full relevant validation family is green.
- Warnings / blockers: Lane divider positions, timeline-end position, and the new major-node start/end snapping behavior remain frontend-local view state by design for this smallest UX pass. If later you want those layout choices to persist per episode across devices, the next step should be a deliberate shared/backend contract change rather than extending the current local-only behavior ad hoc.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest canvas polish slice, likely fine-tuning the major-lane start/end visuals or simplifying the node chrome further now that the canvas geometry is stable.

### 2026-04-16 / loop-035
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Completed the requested recent-stories and object-library interaction cleanup without widening into shared/backend persistence. In the object library, the `...` button was moved back to the right edge of each object card, its menu now opens immediately adjacent to the trigger, and clicking the object row itself now opens object details directly so `Open Object Details` could be removed from the menu. In the recent-stories sidebar, the folder and episode `...` menus were repositioned to open right next to their buttons, lifted above the sign-in/profile layer so they no longer clip, and the inline `Pin / Unpin` control was moved into the right-side action row for both episodes and folders instead of rendering as a badge near the title. Added a folder-side `Add Episodes` menu flow with a separate right-side popout list that toggles folder membership per episode, kept `Dissolve` as the episode-side inverse when already inside a folder, removed the special recent-episode highlight so episodes and folders share the same base visual treatment, and regenerated the standalone root `ARIAD.html` from the latest production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested sidebar/object-library interaction refinement slice is complete and the full relevant validation family is green.
- Warnings / blockers: Folder membership, folder pinning, and folder ordering remain intentionally local UI metadata for this smallest-scope UX slice. If those folder semantics later need shared/cloud persistence parity, the next step should be a deliberate shared/backend contract change rather than extending the current local-only metadata further.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest refinement slice, likely a deeper folder management polish pass or additional object-library density tuning now that menu layering and click behavior are stabilized.

### 2026-04-16 / loop-036
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Completed the requested story-canvas/node refinement slice without widening into shared/backend persistence. Tightened the visual attachment of the major-lane timeline end handle and the lane-divider top dots so both now read as physically connected to their lines rather than floating separately, and adjusted connection-line geometry so parent-side wires start at the node edge while child-side arrowheads end flush at the destination edge. Relaxed canvas placement by removing the old lane-contained x-clamp and routing drag/drop acceptance through the full canvas stage, so nodes and newly created drafts can now be positioned much more freely across the horizontal surface while still preserving their underlying lane identity. Reworked canvas height calculation so the bottom of the stage now tracks the timeline end with a stable bottom padding instead of leaving an oversized fixed dead zone, and dragging the timeline end grows or shrinks the canvas while keeping that spacing relationship. Also extended the selected-node keyboard flow so `Ctrl+C`, `Ctrl+V`, and `Ctrl+Z` operate on the selected node even when the inline node textarea has focus, as long as doing so does not override an active text selection or unsaved text-edit state. Regenerated the standalone root `ARIAD.html` from the latest production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested canvas/shortcut refinement slice is complete and the full relevant validation family is green.
- Warnings / blockers: The freer horizontal placement is a user-directed UX divergence from the earlier stricter lane-contained reading in the immutable spec, but it intentionally keeps the three underlying levels and major-lane timeline model intact. If later you want lane width, timeline end position, or free-placement behavior to persist as canonical per-episode layout state across devices, that should be promoted deliberately into shared/backend persistence rather than extended further as frontend-local behavior.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest canvas polish slice, likely finer node-card density/content cleanup or a dedicated connection-handle interaction pass now that placement and shortcuts are looser.

### 2026-04-16 / loop-037
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Completed the requested sidebar/object-library/story-canvas refinement slice without widening into shared/backend persistence. In the left sidebar, folder cards now visually match episode cards, both card types gained small leading paper/folder glyphs, the vertical spacing between folders and their contained episodes was normalized to the same rhythm as episode-to-episode spacing, and the episode/folder popup menus plus folder pickers were lifted into a much higher overlay layer so the story canvas and profile area can no longer cover them. In the object library, the search hint was simplified, clicking the object surface now opens details directly, the per-object `...` menu was reduced to library-management actions only, and its popup now anchors immediately adjacent to the trigger at a topmost overlay layer. In the story canvas, the major/minor divider was made fixed, a new draggable right-edge divider was added for the detail lane, the overall stage width now expands horizontally with that edge so canvas scrolling can grow naturally, and the timeline start anchor was lowered so it no longer crowds the lane-title row. Regenerated the standalone root `ARIAD.html` from the latest production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested sidebar/object-library/canvas layout refinement slice is complete and the full relevant validation family is green.
- Warnings / blockers: The new lane-width model and popup layering remain frontend-local UX behavior by design for this smallest-scope pass. If later you want lane geometry or sidebar folder metadata to persist as canonical shared state across devices, that should be promoted deliberately into shared/backend persistence instead of continuing to grow the current local-only layer.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest polish slice, likely deeper folder management UX cleanup or finer canvas divider/label tuning now that the new fixed-major and expandable minor/detail layout is in place.

### 2026-04-16 / loop-038
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, root workspace, `PLANS.md`
- What changed: Completed a visual-only refinement pass on the left sidebar and object library without touching canvas logic, persistence contracts, or node behavior. Fixed the episode icon implementation so the episode glyph is now generated reliably through the same CSS-crafted approach as the folder icon, normalized the spacing rhythm so folder-to-folder and folder-to-episode vertical gaps match the existing episode-to-episode spacing, and kept folder cards on the same white card treatment as episode cards. Raised the sidebar/object-library panel stacking layers together with their overlay menu layers so the `...` popovers and folder pickers render above the story canvas instead of disappearing behind it, and tightened menu anchoring so those popovers open flush beside their trigger buttons. In the object library, unified the attached-object row background to the same white tone as the rest of the library cards and kept the simplified search hint wording. Regenerated the standalone root `ARIAD.html` from the latest production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested sidebar/object-library visual refinement slice is complete and the full relevant validation family is green.
- Warnings / blockers: This loop intentionally stayed surface-only. Popup rendering now uses higher panel and overlay stacking so it stays visible above the canvas, but the deeper menu system is still DOM-local rather than portal-based. If later you want one shared global popover system across the entire workspace, that should be done as a dedicated infrastructure slice instead of mixed into visual polish work.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest single-region visual slice, ideally keeping left box, object library, and canvas separated so already-correct interactions stay frozen while we finish the UI today.

### 2026-04-16 / loop-039
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, root workspace, `PLANS.md`
- What changed: Completed the follow-up repair pass for the still-broken left-sidebar and object-library popup behavior without widening into any other region. Replaced the previous high-z-index-only approach with body-level portal rendering for the episode menu, folder menu, folder pickers, and object-library menu, so those overflow/popover menus are no longer trapped inside sidebar/object panel stacking contexts and cannot disappear behind the story canvas. Tightened the root recents grouping so the gap between folder cards and root episode cards now matches the established episode-to-episode spacing, and kept the CSS-crafted episode icon path active with the same generated-icon approach as the folder icon. Regenerated the standalone root `ARIAD.html` from the latest production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The remaining left-sidebar/object-library failures are resolved and the full relevant validation family is green.
- Warnings / blockers: This loop intentionally stayed visual/infrastructure-local and did not reopen canvas behavior. The menu system now uses portal-based overlays for these sidebar/object-library menus; if later you want every workspace popover to share one common menu infrastructure, that should be handled as a dedicated cleanup slice rather than mixed into feature work.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest single-region slice, ideally freezing sidebar/object-library again now that their popup behavior is finally stabilized.

### 2026-04-16 / loop-040
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, root workspace, `PLANS.md`
- What changed: Completed the requested story-canvas sizing/handle refinement without widening into sidebar, object-library, persistence, or connection-model work. Reduced the default canvas dead space by tightening the baseline timeline end position and bottom padding, while keeping canvas height derived from the timeline-end handle so dragging the timeline still grows or shrinks the stage with a stable bottom margin. In fullscreen, the stage now expands horizontally against the available viewport width so the canvas is less likely to require horizontal scrolling by default, and the major-lane timeline end handle remains visually attached to the thick rail instead of reading like a detached floating arrow. Removed the unwanted hover motion from the timeline end handle and the movable divider-dot controls, and adjusted the divider handle structure so the top dots now sit visibly fused to the divider lines instead of showing line segments above them. Also updated the blank-node placeholder copy from `Type your story beat here...` to `Type the beat`, then aligned the affected frontend unit tests to that approved wording and regenerated the standalone root `ARIAD.html` from the latest production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test` (rerun after aligning the stale frontend placeholder expectations); `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested story-canvas/node-copy refinement slice is complete and the full relevant validation family is green.
- Warnings / blockers: This loop intentionally stayed within frontend-local canvas presentation. Fullscreen stage width, divider handle presentation, and timeline-end geometry are still local view behavior rather than shared persisted layout state; if later you want those layout choices to persist per episode across devices, that should be promoted deliberately into shared/backend persistence instead of extended further as UI-only state.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest single-region canvas slice, ideally keeping story-canvas visual tuning separate from any future connection-model or placement-behavior changes so already-correct interactions stay frozen.

### 2026-04-16 / loop-041
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Completed the requested story-canvas magnetic/layout refinement without widening into sidebar, object-library, persistence, or right-panel work. Recentered the major-lane timeline so the rail now sits at the true horizontal center of the major event lane, and made all major-lane node placements magnetize horizontally to that rail so the timeline acts as the structural backbone for major beats. Extended the start/end magnetic behavior so major nodes near the start or end anchors now snap as anchored timeline beats and receive a doubled outline width while snapped, instead of only a top-or-bottom edge accent. The movable divider logic was also upgraded so the minor/detail divider and detail-lane right edge now maintain minimum breathing room from visible nodes by expanding with minor/detail placements, while the first major/minor divider remains fixed per the approved canvas model. Kept the blank-node prompt wording at `Type the beat`, updated the core Playwright canvas proof to assert major-node centering against the timeline center, and regenerated the standalone root `ARIAD.html` from the latest production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested story-canvas magnetic/layout refinement slice is complete and the full relevant validation family is green.
- Warnings / blockers: Divider auto-follow and major-lane magnetic alignment remain intentionally frontend-local layout behavior. They are derived live from node placement and lane geometry rather than being promoted into shared persistence, so if you later want lane widths or timeline alignment to persist canonically per episode across devices, that should be handled as a deliberate shared/backend slice instead of extending the current UI-local layer ad hoc.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest single-region canvas slice, ideally keeping future connection-line or tree-model behavior changes separate from visual/lane-layout tuning so the canvas can stay stable while the UI finishes.

### 2026-04-17 / loop-042
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Completed the requested story-canvas/node/temporary-drawer refinement slice without widening into backend/shared persistence. Shortened the default visible canvas frame while simultaneously extending the initial major-lane timeline so the rail occupies more of the canvas height with less dead space around it, keeping the existing rule that dragging the timeline end still grows or shrinks the canvas accordingly. Added frontend-local node sizing so selected nodes can now be resized horizontally, vertically, or diagonally with visible edge/corner handles; the current default node size remains the enforced minimum, there is no frontend max size, and connection lines, timeline magnetism, lane breathing-room calculations, and stage height all now react to the resized dimensions. Also applied the user-approved product divergence that hides the temporary drawer UI and drawer-related node action from the page for now: the bottom-right drawer toggle is no longer rendered, `Send to Drawer` no longer appears in the node `...` menu, and drawer-specific UI expectations were removed from the frontend/e2e baselines, while underlying persistence code was left untouched to avoid a wider contract change. Regenerated the standalone root `ARIAD.html` from the latest production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested story-canvas resize/drawer-hide refinement slice is complete and the full relevant validation family is green.
- Warnings / blockers: Hiding the temporary drawer is a user-directed divergence from the immutable spec's current visible drawer/toggle wording, so it was implemented only as a UI-surface suppression pass and not as a source-of-truth rewrite. Node size, lane breathing-room expansion, and the hidden drawer state all remain frontend-local behavior; if later you want node dimensions or drawer removal to become canonical shared product behavior across devices, that should go through a deliberate approved spec/persistence slice rather than growing the current local-only layer further.
- Approval needed: `none` (explicit user direction received in this loop)
- Next step: Continue only if requested with the next smallest single-region canvas slice, likely either finer node content-density polish inside resizable cards or a dedicated connection-line cleanup pass now that node dimensions can vary.

### 2026-04-17 / loop-043
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Completed a canvas-only repair pass for the latest story-canvas regression without widening into sidebar, object-library, persistence, or right-panel work. Renamed the center heading copy from `Story Canvas` to `Canvas`, corrected the major-lane timeline rendering so the rail, start anchor, and end handle now use lane-local coordinates inside the major lane instead of reusing the stage-global center directly, and restored lane-contained horizontal placement for all nodes while keeping vertical placement free across the canvas. To remove the hidden horizontal cutoff that had started to make minor/detail nodes feel trapped below invisible rows, the fallback lane start baseline was normalized across all three lanes. The result is that minor/detail nodes now stay visually inside their own lanes, the major timeline is visibly centered in the major lane again, and connection-line endpoints once again align with the on-screen node edges instead of drifting away from what the user sees. Updated the browser-level proof to assert actual rendered timeline centering by bounding box rather than raw inline style, added explicit lane-containment checks for minor/detail nodes, and regenerated the standalone root `ARIAD.html` from the latest production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested story-canvas repair slice is complete and the full relevant validation family is green.
- Warnings / blockers: This loop intentionally re-tightened lane-contained horizontal semantics after the earlier looser placement pass because the freer cross-lane x behavior was causing visible canvas/readability regressions against the intended three-lane structural model. Lane geometry, snapped timeline layout, and node dimensions remain frontend-local behavior rather than shared persisted episode layout state.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest canvas-only slice, ideally either connection-line visual polish or node-content density cleanup, while keeping left-sidebar/object-library areas frozen.

### 2026-04-17 / loop-044
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator, Frontend (via Orchestrator-routed explorer feedback)
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Completed a second canvas-only recovery pass after visually comparing the live standalone canvas against the user's attached reference image. The key structural change was moving node rendering out of the lane-local column DOM and onto a shared stage-global node layer, so node boxes, connection-line paths, and the major timeline now all read from the same coordinate system instead of mixing stage-global line math with lane-local node offsets. Re-opened freer horizontal placement for non-major nodes while preserving level identity and the major-lane timeline magnetism, kept lane sections as structural click zones rather than boxed visual containers, added blank-canvas deselection, hid most node header chrome until selection/hover so the canvas reads more like a sparse diagram, and suppressed placeholder text inside unselected empty nodes so blank beats look visually closer to the reference boxes. Updated the relevant frontend and Playwright tests to follow the new stage-global node layer, regenerated `ARIAD.html`, and captured a fresh standalone visual proof scene showing the centered major timeline, open canvas composition, and line/node alignment.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`; standalone headless visual proof capture against `file:///C:/Users/kimja/Desktop/ARIAD/ARIAD.html`
- Result: The full relevant validation family is green, and the latest direct-open standalone canvas now matches the reference image materially more closely in composition: open stage, centered major backbone, non-boxed lane reading, and connection endpoints that visually meet the rendered nodes.
- Warnings / blockers: This loop intentionally shifted the canvas back toward a freer stage-level layout model because the lane-boxed DOM structure was making the reference-style reading impossible. Lane geometry, blank-canvas deselection, node chrome visibility, and node size remain frontend-local behavior rather than shared persisted episode layout state.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest canvas-only slice, ideally refining connection-line curvature/arrowhead size or node text density while keeping sidebar/object-library/right-panel frozen.

### 2026-04-17 / loop-045
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator, Frontend (with Orchestrator-routed review feedback)
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Completed the requested node-and-canvas-only refinement pass without reopening sidebar, object-library, persistence, or recommendation scope. Reworked the node card so the fold and `...` actions now float in the top-right corner instead of consuming a full header row, which removes the large blank top band and makes the text box sit higher like the provided node reference. Removed the visible horizontal/vertical/diagonal resize dots while keeping the underlying resize behavior through invisible edge and corner hit areas, then added drag-based rewiring from the node connection handle with a live preview line while preserving the older attach-here fallback path for stability. Tightened lane placement back to true lane bounds so non-major/detail nodes cannot invade the left divider, added major-lane auto-width follow so the first divider, major-lane label, and timeline shift outward when a major node grows wider, and kept the detail-side divider auto-follow behavior aligned with node width. Regenerated `ARIAD.html` from the latest production build and captured a fresh standalone proof image of the updated node/canvas layout.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test` (rerun outside the sandbox after Vitest worker spawn EPERM); `npm.cmd run integration` (rerun outside the sandbox after an initial timeout-only sandbox run); `npm.cmd run build` (rerun outside the sandbox after Vite spawn EPERM); `npm.cmd run e2e` (rerun outside the sandbox after Playwright spawn EPERM, plus stale browser-flow expectation updates); `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`; standalone headless visual proof capture against `file:///C:/Users/kimja/Desktop/ARIAD/ARIAD.html`
- Result: The requested node/story-canvas slice is complete and the full relevant validation family is green. The latest standalone render now shows the slimmer node chrome, no visible resize dots, and lane/timeline geometry that follows major-node width more cleanly.
- Warnings / blockers: The new drag-to-rewire preview and the lane auto-follow geometry remain frontend-local interaction/layout behavior, not shared persisted episode state. Keyboard and click-to-attach rewiring remain available together for now to avoid regressing the established canvas flow while the new drag path settles.
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest node-or-canvas slice, ideally a pure visual pass on line curvature/arrow scale or a dedicated refinement pass on drag-based rewire affordance now that the structural geometry is back under control.

### 2026-04-17 / loop-046
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, root workspace, `PLANS.md`
- What changed: Completed the requested canvas-only magnetic refinement without reopening any other workspace region. Start and end magnetic meaning now use edge-specific node emphasis again instead of the previous full-outline thickness: a snapped start major node thickens only its top border and a snapped end major node thickens only its bottom border, matching the timeline start/end semantics more closely. Also coupled end-node movement to the timeline end handle so dragging the current end major node vertically now lengthens or shortens the timeline just like dragging the end arrow itself. After a final menu-layer safety adjustment to keep the hidden resize hit areas from intercepting the node `...` menu, reran the production build and regenerated the standalone root file sequentially so `ARIAD.html` reflects the exact latest assets.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test` (outside sandbox for Vitest worker spawn); `npm.cmd run build` (outside sandbox for Vite spawn/path requirements); `npm.cmd run e2e` (outside sandbox for Playwright browser spawn); `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested canvas refinement is complete and all relevant validation is green.
- Warnings / blockers: `integration` was not rerun for this loop because the change stayed entirely in frontend canvas interaction and styling, without touching backend, persistence, or recommendation orchestration. End-node-driven timeline resizing remains frontend-local behavior rather than persisted episode layout state.

### 2026-04-17 / loop-047
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, root workspace, `PLANS.md`
- What changed: Completed the requested keyword-suggestion and connection-model refinement slice without reopening the left sidebar, object library, or right-panel layout. Reworked the node-local keyword cloud into a reference-style word grid popup with simple word-only chips in a fixed five-column layout, where clicking a word toggles it between light blue and a darker bold selected state. Removed the old below-node saved-keyword stack and instead render persisted keywords directly inside the node body as darker inline text so saved keyword context stays inside the beat card. On the canvas side, removed the intrusive `Attach Here` box and lifted connection editing to the actual line endpoints: each rendered connection now exposes draggable endpoint handles on both sides, and either end can initiate the same rewire flow while target nodes indicate eligibility through outline color only. Also widened rewire eligibility from the old parent-level-only rule to any non-self, non-descendant visible node, then aligned `controller.rewireNode()` to allow the same freer cross-lane connection model under explicit user direction, so detail/minor nodes can now reconnect directly to major nodes. Regenerated the standalone root `ARIAD.html` from the latest production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested keyword-cloud and canvas-connection refinement slice is complete and the full relevant validation family is green.
- Warnings / blockers: Allowing cross-lane rewiring is a user-directed divergence from the stricter parent-level connection model in the immutable spec and previous controller behavior. The new line-end handles and keyword-in-node rendering remain frontend-local interaction/presentation behavior; if the broader connection model is later meant to become canonical product meaning, it should be reconciled deliberately with the source-of-truth documents rather than treated as an implicit spec rewrite.
- Approval needed: `none` (explicit user direction received in this loop)
- Approval needed: `none`
- Next step: Continue only if requested with the next smallest canvas-only slice, likely a pure visual pass on timeline/anchor styling or connection-curve polish.

### 2026-04-17 / loop-048
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, root workspace, `PLANS.md`
- What changed: Completed the requested story-canvas movement-growth and keyword-cloud simplification slice without reopening the left sidebar, object library, or backend routes. Relaxed non-major horizontal clamping so minor/detail nodes can move freely to the right while still respecting their own left divider boundary, and carried that freer placement into the lane auto-follow math so the minor/detail divider and the detail-edge boundary now move with node placement instead of trapping nodes under stale right-side limits. Expanded the effective canvas-height rule so lower node movement or downward resizing in minor/detail lanes now extends the visible timeline length as well, keeping canvas height and timeline end in sync whether growth comes from the explicit timeline handle, the end-major node, or lower secondary/detail nodes. Simplified the keyword cloud into an immediate-apply interaction: selecting or unselecting a keyword now persists directly into the node on click, the old hint text plus `Save Keywords` and `Sentence Suggestions` UI/behavior were removed, and the header now keeps only `Refresh Cloud` and `Cancel`. Also hid the connection-endpoint handle layer while the keyword cloud is open and raised the active node stacking so connection dots no longer bleed through the cloud panel. Regenerated the standalone root `ARIAD.html` from the latest production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd run test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested canvas-growth and keyword-cloud immediate-apply slice is complete and the full relevant validation family is green.
- Warnings / blockers: Removing the old explicit save/sentence-suggestion step is a user-directed behavior change from the prior recommendation flow. The freer minor/detail placement and node-driven effective timeline growth remain frontend-local layout behavior rather than shared persisted episode geometry, so if those rules later need canonical cross-device persistence they should be promoted through a deliberate shared/backend slice instead of extended further ad hoc.
- Approval needed: `none` (explicit user direction received in this loop)

### 2026-04-17 / loop-049
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Completed the requested node-and-canvas refinement pass without reopening sidebar, object-library, backend, or shared-contract scope. Reworked selected-node editing so keyword selections now live in the same visible text area as the editable beat text instead of rendering in a separate lower block: selected keywords are shown inline as darker tokens, the node action buttons now stack vertically in the top-right overlay to free more writing width, and backspacing from the start of the inline editor removes the last keyword from the node and immediately unselects it in the open keyword cloud. Kept the underlying persistence model intact by still storing `text` and `keywords` separately, but synchronized inline edits and cloud toggles through one shared content-update path. Also removed the start/end timeline-outline fallback to first/last major node so the top/bottom border emphasis now applies only when a major node is actually snapped to the start or end anchor. Finally, repaired fullscreen detail editing by lifting the right-side detail editor into a floating overlay while the canvas is in fullscreen mode, then regenerated the standalone root `ARIAD.html` from the latest production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested node/fullscreen/timeline-anchor refinement slice is complete and the full relevant validation family is green.
- Warnings / blockers: The inline node editor is still implemented on top of the existing separate `text` + `keywords` persistence fields, so the "keywords as characters" behavior is currently a UI-level composition rather than a brand-new canonical rich-text model. If you later want arbitrary token insertion order or richer inline editing semantics across devices, that should be a deliberate persistence/editor-model slice rather than incremental patching on the current lightweight approach.
- Approval needed: `none`

### 2026-04-17 / loop-050
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Completed the requested canvas/object insertion slice without reopening backend routes, shared types, or non-canvas layout regions. Added canvas-level zoom controls plus blank-space drag panning by introducing a scaled stage shell around the existing coordinate system instead of rewriting node/line geometry, then updated pointer conversion so draft placement, node dragging, timeline-end dragging, divider dragging, rewiring, and node resizing all continue to operate in the original unscaled stage coordinates while the viewport is zoomed. Fixed the node `...` popup layering issue by lifting it into the same body-level overlay strategy already used elsewhere, so connection-handle dots no longer bleed over the menu. Added `@mention` object support inside node text using the existing `text` + `objectIds` model: typing `@name@` now creates a new object if needed, typing `@c...` surfaces a prefix search popup for existing objects, selecting a suggestion inserts the wrapped mention text, and persisted closed mentions now synchronize the node's attached `objectIds` so the object library usage counts update from mention-driven usage instead of old button-based insertion. Unselected node rendering now styles object mentions as darker bold inline tokens, while keeping the current lightweight textarea editor model rather than introducing a richer shared-text contract. Regenerated the standalone root `ARIAD.html` from the latest production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested canvas zoom/pan, node-menu layering, and `@mention` object flow slice is complete and the full relevant validation family is green.
- Warnings / blockers: Object mentions are currently implemented as a UI-level parsing/sync layer over the existing plain `text` field and `objectIds`, not as a canonical rich-text/document model. That keeps this slice small and rollback-friendly, but if later you want styled inline mentions while actively editing, arbitrary object-token positioning beyond simple `@...@`, or cross-device mention metadata that survives text transformations more robustly, that should be promoted into a deliberate editor/persistence-model slice rather than continued ad hoc patching.
- Approval needed: `none`

### 2026-04-17 / loop-051
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Completed the requested node-, keyword-cloud-, and canvas-only refinement without reopening sidebar, object-library, shared-type, or backend meaning. Removed the node-detail edit path entirely by deleting the `Edit Details` action, the node-only right-panel branch, and the old Enter-to-open shortcut, while keeping object detail editing intact, including in fullscreen. Reworked selected-node editing so the inline textarea no longer relies on scrolling: it now auto-grows with the current beat text and expands the node height when the content needs more vertical room, with no node-internal scrollbar. Locked fixed nodes as true positional locks by preventing canvas drag start in the UI and ignoring placement updates in the persistence controller, so a fixed node can no longer move accidentally while retaining its other visual-state markers. Closed the keyword cloud on outside click and realigned major-lane anchor semantics so start/end meaning is now based on the node outline physically reaching the timeline start or end limit: major nodes are clamped between those two bounds, start state uses the top outline touching the start anchor, and end state uses the bottom outline touching the end anchor. Regenerated the standalone root `ARIAD.html` from the latest production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested node/keyword-cloud/canvas refinement slice is complete and the full relevant validation family is green.
- Warnings / blockers: Node text auto-growth is currently implemented as a UI-level node-size expansion rule on top of the existing lightweight textarea editor, not as a new rich-text or content-measurement model for every unselected node in the workspace. Fixed-position enforcement now exists in both the UI drag path and the frontend persistence controller, but it remains local-workspace behavior rather than a newly elevated cross-device layout contract.
- Approval needed: `none`

### 2026-04-20 / loop-052
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `e2e/`, root workspace, `PLANS.md`
- What changed: Completed a bug-fix-only pass for the user's immediate node/object/menu/canvas regressions without reopening backend routes, shared contracts, or unrelated UI regions. Reworked selected-node inline editing so closed `@object@` mentions are now rendered immediately inside the node while the node is still selected, instead of waiting for blur; the textarea now acts as a transparent caret/input layer over a live formatted preview so object mentions appear as bold darker inline tokens during editing as well as after deselection. Kept the existing lightweight `text` + `objectIds` model, but tightened immediate mention syncing so inline mention creation/reuse updates attached object ids and object-library usage counts as soon as the mention becomes closed, including inline-created new objects. Fixed drifting `...` menus by wiring sidebar, object-library, and node menu buttons into tracked anchor refs and recomputing portal overlay positions on scroll/resize so the menus stay attached to their triggering buttons instead of remaining frozen in old viewport coordinates. Added render-time and create/move-time node collision resolution so newly placed or moved nodes no longer stack on top of existing nodes in the same canvas area, and added a focused Playwright proof for the minor-lane overlap case. Regenerated the standalone root `ARIAD.html` from the latest production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test`; `npm.cmd run integration`; `npm.cmd run build`; `npm.cmd run e2e`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`
- Result: The requested bug-fix slice is complete and the full relevant validation family is green.
- Warnings / blockers: Immediate object mention styling while editing is still implemented as a formatted preview layered under the existing textarea, not as a new canonical rich-text editor model. Node overlap prevention currently resolves by shifting colliding nodes downward within the existing frontend-local placement system; if later you want more advanced automatic packing rules or persisted collision-aware layout semantics, that should be a deliberate canvas-layout slice rather than incremental patching.
- Approval needed: `none`

### 2026-04-20 / loop-053
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `frontend/src/persistence/`, `frontend/src/recommendation/`, root workspace, `PLANS.md`
- What changed: Completed the requested canvas/node/local-host refinement slice without reopening immutable source docs, shared contracts, backend routes, or unrelated sidebar/object-library layout. Added touchpad/mouse-wheel zoom to the canvas viewport on top of the existing button zoom and blank-space panning, so pinch-style wheel gestures now scale only the canvas while preserving the pointer location. Reworked timeline-end growth rules so the end major node can again move downward like the end arrow, non-major/detail nodes can extend the canvas below the previous timeline end, downward resizing also extends the timeline instead of letting nodes invade the end anchor, and the rendered end-node emphasis now follows the actual visual end anchor rather than stale pre-growth state. Tightened selected-node inline editing so keyword chips and `@object@` mentions now live in the same formatted text flow while the node is selected instead of rendering as separate lower badges; keyword toggles now write directly into the inline text model, keyword/object tokens render immediately in the live preview, token deletion works from the caret location instead of only stripping the last keyword, and drawer/recommendation headline generation now strips the inline formatting markers before leaving the editor surface. Added a simple root `npm run host:local` launcher for the real locally hosted app, then proved the hosted backend health route and `/service.html` both respond with `200`. Regenerated the standalone root `ARIAD.html` from the latest production build.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd test` (rerun outside the sandbox after initial Vitest worker spawn EPERM); `npm.cmd run build` (rerun outside the sandbox after initial Vite spawn EPERM); `npm.cmd run e2e` (rerun outside the sandbox after initial Playwright spawn EPERM and after a node-shortcut regression fix); `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`; `npm.cmd run host:local` (ready-state proof outside the sandbox); direct HTTP readiness checks for `http://127.0.0.1:3001/api/health` and `http://127.0.0.1:5173/service.html`
- Result: The requested canvas/node/local-host slice is complete, all relevant rerun validation is green, and the actual hosted local service was verified live.
- Warnings / blockers: `integration` was not rerun for this loop because the changes stayed in frontend canvas/editor behavior plus a local launcher entrypoint, without changing backend contracts, persistence schemas, or recommendation orchestration behavior. Inline keyword/object behavior is still built on the existing lightweight `text` + `keywords` + `objectIds` model with formatted preview semantics, not a fully canonical document/rich-text model.
- Approval needed: `none`
- Next step: If requested, the next smallest sensible slice is a dedicated timeline-rule refinement pass that formalizes the start/end-node semantics against the now-working UI before adding any more canvas behaviors.

### 2026-04-20 / loop-054
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, `frontend/src/persistence/`, `frontend/src/recommendation/`, root workspace, `PLANS.md`
- What changed: Completed the requested node/canvas/hosted-service repair slice without reopening immutable source docs, backend routes, or shared contracts. Added a second object-recognition path for inline node editing so existing object names typed as plain words can now surface an explicit `Use "<name>" as object` choice without requiring `@` syntax, while preserving the ability to leave the same word as ordinary text. Moved inline object tokens fully onto the invisible object-marker model so typed object mentions, object usage syncing, and display rendering all run through the same formatting path; this keeps inline object styling visible immediately in the selected node and avoids the old delayed-only-on-blur behavior. Tightened selected-node auto-sizing so the node height is continuously re-measured from the live editor content, cannot shrink below the current text box needs during resize, and can shrink back down when auto-grown content is later removed. Kept node collision resolution lane-local so growth in one lane no longer causes cross-lane ordering side effects, and preserved the existing start/end timeline-anchor model while refreshing the rendered end-handle styling so the hosted service and standalone output both show the corrected anchor visuals. Also fixed the hosted HTML title source so both `frontend/index.html` and `frontend/service.html` build to `ARIAD`, then reran the local host proof and confirmed the served `/service.html` response now contains the `ARIAD` title instead of the stale `SCENAAIRO` title.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd run integration`; `npm.cmd test`; `npm.cmd run build`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`; `npm.cmd run e2e`; `npm.cmd run host:local`; direct HTTP readiness check for `http://127.0.0.1:3001/api/health`; direct HTML title check for `http://127.0.0.1:5173/service.html`
- Result: The requested node/canvas/hosted-service repair slice is complete, all relevant validation is green, and the hosted local `/service.html` path now responds successfully with the `ARIAD` title.
- Warnings / blockers: Inline object rendering and selection are still implemented as a lightweight formatted-preview/editor-layer on top of the existing plain `text` plus `objectIds` model, not a fully canonical rich-text document model. That keeps this slice small and stable, but richer mid-token caret semantics or arbitrary inline token editing would still need a deliberate editor-model slice later.
- Approval needed: `none`
- Next step: If requested, the next smallest sensible slice is a focused inline-editor refinement pass that decides whether object and keyword tokens should remain lightweight preview tokens or be promoted into a richer persisted document model.

### 2026-04-20 / loop-055
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/`, root workspace, `PLANS.md`
- What changed: Completed the requested canvas and keyword-cloud interaction refinement without reopening backend routes, shared contracts, or unrelated sidebar/object-library behavior. Added an explicit outside-click blur path for the selected node inline editor so clicking elsewhere now clears the caret and stops further typing into that node until the user intentionally focuses it again. Removed the extra live height re-sync that had been running on every resize pointermove and moved that sync to the end of node-resize gestures instead, which fixes the sluggish shrink interaction while preserving the rule that a node cannot be resized below its current text-content height. Added viewport-centering helpers and now use them when opening the keyword cloud and when the user double-clicks a node, so off-screen or edge-of-canvas work areas are brought back toward the visible center. Reworked keyword-cloud display ordering so selected keywords stay pinned first in selection order across refreshes, while the remaining cloud entries refresh behind them without changing the immediate-apply keyword flow. Also adjusted the rendered timeline end-handle positioning so the end dot no longer rides up over the end node outline, regenerated the standalone root `ARIAD.html`, and added focused frontend tests for outside-click blur and selected-keyword-first refresh ordering.
- Tests run: `npm.cmd run lint`; `npm.cmd run typecheck`; `npm.cmd run integration`; `npm.cmd test`; `npm.cmd run build`; `powershell -ExecutionPolicy Bypass -File scripts/generate-standalone-html.ps1`; `npm.cmd run e2e`
- Result: The requested canvas and keyword-cloud refinement slice is complete and the full relevant validation family is green.
- Warnings / blockers: Keyword-cloud refresh now guarantees a useful visible refresh by pinning currently selected words first and reordering the remaining suggestions behind them, but it still depends on the existing lightweight heuristic suggestion source rather than a larger paged recommendation inventory. Canvas recentering is intentionally viewport-local convenience behavior and is not persisted per episode.
- Approval needed: `none`
- Next step: If requested, the next smallest sensible slice is a dedicated viewport/usability pass that decides whether node creation, keyword-cloud opening, and search-driven focus should all share one canonical ��bring into view�� behavior.

### 2026-04-21 / loop-056
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: root workspace, `frontend/`, `backend/`, `shared/`, `recommendation/`, `scripts/`, `PLANS.md`
- What changed: Continued the user-directed Yarn-only migration. Removed the remaining package-manager split that made Yarn workspace scripts fail to find shared tool binaries by moving frontend testing-library ownership into the frontend workspace, refreshing the Yarn install state with `node-modules` linking, and converting each workspace script to call the root-owned toolchain through `yarn run -T ...` instead of bare `tsc` / `vite` / `vitest` / `eslint` / `tsx`. Also hardened the custom root dev wrappers so Windows no longer dies immediately on direct `yarn.cmd` spawning and instead routes through a `cmd.exe /c yarn.cmd ...` invocation with stable startup/error handling before compatibility fallback.
- Tests run: `yarn install --mode=skip-build`; `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/backend typecheck`; `yarn workspace @scenaairo/shared typecheck`; `yarn workspace @scenaairo/recommendation typecheck`; `yarn typecheck`; attempted `yarn build`
- Result: The Yarn workspace binary-resolution failure is fixed. `yarn workspace ... typecheck` and root `yarn typecheck` now succeed under Yarn without requiring per-workspace local tool copies.
- Warnings / blockers: `yarn build` still fails in this sandboxed environment because Vite's config loading path hits a lower-level `spawn EPERM` inside the environment, which is separate from the package-manager wiring and also affects direct dev-server startup unless run outside the restricted sandbox. This loop stabilized the Yarn script topology; it did not eliminate the environment-level Vite/esbuild spawn restriction.
- Approval needed: `none`

### 2026-04-21 / loop-057
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: root workspace, `PLANS.md`
- What changed: Per the user's request, ran live Yarn dev-server verification outside the restricted sandbox against the current converted launchers instead of changing application code again. Proved the backend dev path responds on `http://127.0.0.1:3001/api/health` and the frontend dev path responds on `http://127.0.0.1:4173/service.html`, then shut both processes down after the checks.
- Tests run: live `yarn.cmd dev:backend` readiness check with HTTP fetch of `http://127.0.0.1:3001/api/health`; live `yarn.cmd dev:frontend --host 127.0.0.1 --port 4173` readiness check with HTTP fetch of `http://127.0.0.1:4173/service.html`
- Result: Both Yarn dev entrypoints now launch successfully outside the sandbox and answer on localhost. Backend returned `200` with `{"environment":"local","service":"backend","status":"ok"}`. Frontend returned `200` and the served HTML contains the `ARIAD` title marker.
- Warnings / blockers: The dev proof required execution outside the restricted sandbox because this environment still produces low-level `spawn EPERM` failures for Vite/esbuild paths when run inside the sandbox. The Yarn migration work fixed script/tooling topology; it does not remove that sandbox-specific runtime limitation.
- Approval needed: `none`

### 2026-04-21 / loop-058
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: root workspace, `PLANS.md`
- What changed: Cleaned the temporary Yarn/dev verification artifacts from the workspace and updated root `.gitignore` so local Codex dev logs, workspace/package-manager cache folders, and Yarn's generated `install-state.gz` no longer appear as untracked noise during future work.
- Tests run: `git -c safe.directory=C:/work/ARIAD status --short`
- Result: The temporary log/cache artifacts generated during the Yarn migration and dev-server verification were removed, and only the intended `.gitignore` update plus the user's separate pre-existing `AGENTS.md` edit remain in the worktree.
- Warnings / blockers: `AGENTS.md` still has an unrelated user-side modification and was intentionally left untouched.
- Approval needed: `none`

### 2026-04-21 / loop-059
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/`, `PLANS.md`
- What changed: Refactored the oversized `WorkspaceShell.tsx` by extracting its component-external declarations into a dedicated module `workspaceShell.helpers.tsx`. Moved workspace-level constants, lane/object/node-related structural types, and shared pure helper functions (layout math, inline token parsing, sidebar parsing, overlay helpers) out of the route component file so `WorkspaceShell.tsx` now focuses on state/interaction/render flow. Updated imports to use value/type-separated helper imports and added a missing helper dependency import (`collectSubtreeNodes`) to keep behavior unchanged.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.tsx src/routes/workspaceShell.helpers.tsx`
- Result: Typecheck passed, and the refactor introduced no new lint category issues. ESLint still reports the pre-existing `react-hooks/set-state-in-effect` violations already present in `WorkspaceShell.tsx`.
- Warnings / blockers: This loop intentionally performed a readability-only modularization and did not change existing `useEffect` state-sync patterns that trigger the current hook lint errors.
- Approval needed: `none`

### 2026-04-21 / loop-060
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: root workspace, `PLANS.md`
- What changed: Added a new root-level documentation file `PROJECT_OVERVIEW_KO.md` that summarizes the current repository structure, workspace/package boundaries, major user-facing features, shared data models, frontend/backend/recommendation/shared component responsibilities, test layout, run commands, and current implementation caveats in Korean. The document was written against the actual codebase rather than only the product docs, so it calls out present-state details such as the current `ARIAD` branding, stubbed auth boundary, heuristic recommendation provider, and the temporarily disabled drawer UI.
- Tests run: `rg -n "^## " PROJECT_OVERVIEW_KO.md`; `Get-Item PROJECT_OVERVIEW_KO.md`; `git -c safe.directory=C:/work/ARIAD status --short`
- Result: The requested Korean overview document is now present at the repository root and is structured for onboarding/review use.
- Warnings / blockers: The worktree already contained unrelated in-progress changes in `.gitignore`, `AGENTS.md`, `PLANS.md`, `frontend/src/routes/WorkspaceShell.tsx`, and `frontend/src/routes/workspaceShell.helpers.tsx`; they were left untouched.
- Approval needed: `none`

### 2026-04-21 / loop-060
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/`, `PLANS.md`
- What changed: Repaired Korean-comment mojibake introduced during encoding conversion by restoring all affected comment lines in `WorkspaceShell.tsx` and the new `workspace-shell/*` modules, then re-saved those files with explicit UTF-8 BOM to avoid editor auto-detection issues on Windows.
- Tests run: `rg -n "?|??" frontend/src/routes/WorkspaceShell.tsx frontend/src/routes/workspace-shell`; `rg -n "?? ??????|?? ?????????" frontend/src/routes/WorkspaceShell.tsx frontend/src/routes/workspace-shell`; `yarn workspace @scenaairo/frontend typecheck`
- Result: Korean comments are readable again across the split route modules, no replacement-character corruption remains, and frontend typecheck is green.
- Warnings / blockers: None.
- Approval needed: `none`

### 2026-04-21 / loop-061
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `AGENT_SYSTEM.md`, `AGENTS.md`, root workspace docs, `frontend/src/routes/`, `PLANS.md`
- What changed: Investigated the broken Korean comment/doc display path and confirmed the immediate issue was Windows PowerShell default decoding for UTF-8 files without BOM on Korean-bearing files. Added a text-encoding discipline rule to `AGENT_SYSTEM.md` requiring Korean-bearing files to use UTF-8 with BOM plus explicit UTF-8-aware verification on Windows. Re-encoded the current Korean-bearing files (`AGENTS.md`, `PROJECT_OVERVIEW_KO.md`, `frontend/src/routes/WorkspaceShell.tsx`, and the `frontend/src/routes/workspace-shell/*` files with Korean header comments) to UTF-8 with BOM so default PowerShell reads now display the Korean text correctly.
- Tests run: default and UTF-8-aware `Get-Content` verification on `AGENTS.md`, `PROJECT_OVERVIEW_KO.md`, and `frontend/src/routes/workspace-shell/workspaceShell.common.tsx`; BOM byte-header verification via `[System.IO.File]::ReadAllBytes(...)`; `yarn workspace @scenaairo/frontend typecheck`; `git -c safe.directory=C:/work/ARIAD status --short`
- Result: Korean comments/docs that were previously displaying as mojibake through the default PowerShell read path now render correctly, and the frontend workspace still typechecks after the encoding-only source-file rewrites.
- Warnings / blockers: The encoding fix necessarily touched files that already had unrelated in-progress work, especially `AGENTS.md` and `frontend/src/routes/WorkspaceShell.tsx`, but the text content was preserved and only the encoding container plus the requested `AGENT_SYSTEM.md` rule changed.
- Approval needed: `none`

### 2026-04-21 / loop-062
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `shared/`, `backend/src/persistence/`, `frontend/src/persistence/`, `frontend/src/routes/`, root workspace lock/install state, `PLANS.md`
- What changed: Implemented the requested domain-structure correction so `object` now binds to `episode` (1:N) instead of project-only. Added `episodeId` to the shared `StoryObject` type, propagated the contract impact through frontend/backed persistence flows, and hardened dependency checks: backend store sync now validates object-to-episode consistency, node-to-object same-episode consistency, and removes episode-scoped objects when an episode is deleted. Frontend persistence controller now creates objects under the active episode, blocks cross-episode object attachment to nodes, and deletes episode-scoped objects together when deleting an episode. Added backward-compatible snapshot normalization on frontend/backend load paths so older snapshots missing object-episode bindings are auto-repaired to a valid episode scope and invalid cross-episode node-object links are sanitized. Updated standalone cloud emulation to mirror the same delete-side referential cleanup semantics. Workspace UI object scope was tightened to active-episode objects in object list/mention suggestions/editor selection so interaction now follows the new relation model.
- Tests run: `yarn install --mode=skip-build` (outside sandbox after initial EPERM in sandbox); `yarn typecheck`; `yarn workspace @scenaairo/shared typecheck`; `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/backend typecheck`; `yarn workspace @scenaairo/frontend run -T vitest run src/persistence/controller.test.ts src/persistence/flushQueue.test.ts` (outside sandbox due Vite spawn EPERM in sandbox); `yarn workspace @scenaairo/backend integration`
- Result: The object-to-episode 1:N relation is now enforced in shared type definitions and persistence behavior across frontend/backend/standalone flows, and the relevant persistence-focused test suites are green.
- Warnings / blockers: Full frontend test suite still shows one existing unrelated failure in `src/routes/WorkspaceShell.test.tsx` keyboard copy/paste shortcut case (`Nodes: 2` expected, `Nodes: 1` actual) when running the entire suite; the persistence-specific suites impacted by this task passed.
- Approval needed: `none`

### 2026-04-21 / loop-061
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/`, `PLANS.md`
- What changed: Fixed canvas-focus shortcut scoping in `WorkspaceShell.tsx` so node-editing shortcuts and canvas zoom shortcuts no longer behave as global app-wide actions. Added canvas shortcut context detection (`canvasViewport` containment or selected node inline editor), gated `Ctrl/Cmd + Z/Y/C/V` and zoom key combos to that context, added keyboard zoom handling (`Ctrl/Cmd + +`, `Ctrl/Cmd + -`, `Ctrl/Cmd + 0`), and made the canvas viewport focusable (`tabIndex=0`) with explicit focus acquisition on blank-canvas mouse down to keep the shortcut context stable.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.tsx`
- Result: The requested focus-scoped canvas shortcut behavior was implemented in the workspace shell route. ESLint output remains at the pre-existing `react-hooks/set-state-in-effect` findings in this file.
- Warnings / blockers: Frontend typecheck currently fails due unrelated pre-existing `StoryObject.episodeId` type mismatches in `frontend/src/persistence/controller.ts`, `frontend/src/persistence/flushQueue.test.ts`, and `frontend/src/persistence/sampleWorkspace.ts`; this loop did not touch those files.
- Approval needed: `none`

### 2026-04-21 / loop-062
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: root workspace docs, `PLANS.md`
- What changed: Expanded the `PROJECT_OVERVIEW_KO.md` section `2. ????? ????` from a top-level folder list into a more detailed developer-facing tree. The updated section now shows the main workspace package boundaries plus the most important nested directories and entry files under `frontend`, `backend`, `shared`, `recommendation`, `e2e`, and `scripts`, while explicitly noting that generated/tooling folders such as `node_modules`, `dist`, `.git`, and `.yarn` are intentionally omitted.
- Tests run: UTF-8 `Get-Content` section check for `PROJECT_OVERVIEW_KO.md`; `git -c safe.directory=C:/work/ARIAD status --short`
- Result: The repository-structure section is now significantly more detailed and should be easier to use as a directory map during onboarding and review.
- Warnings / blockers: The worktree already contains multiple unrelated in-progress changes outside this documentation update; they were not modified as part of this slice.
- Approval needed: `none`

### 2026-04-21 / loop-062
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/`, `PLANS.md`
- What changed: Refined shortcut scope in `WorkspaceShell.tsx` so inline editor focus now keeps browser-native text undo/redo (`Ctrl/Cmd+Z/Y`) instead of routing to workspace history. Removed inline-editor global undo/redo interception from `canUseNodeShortcutFromInlineEditor` and added an explicit early return for modifier `z/y` while the node inline textarea is focused.
- Tests run: `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.tsx`
- Result: Shortcut routing now separates inline text undo/redo from canvas-level workspace undo/redo as requested.
- Warnings / blockers: ESLint still reports pre-existing `react-hooks/set-state-in-effect` findings in `WorkspaceShell.tsx`.
- Approval needed: `none`

### 2026-04-21 / loop-063
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `backend/`, root workspace, `PLANS.md`
- What changed: Added a local-MySQL-ready persistence path for backend testing without removing the existing file-backed default. Introduced `PERSISTENCE_DRIVER=file|mysql` plus `MYSQL_*` env parsing in backend config, wired persistence route registration to choose between `FileBackedPersistenceStore` and a new `MySqlBackedPersistenceStore`, and attached on-close cleanup for DB pools. Implemented MySQL-backed persistence against a `cloud_projects` table with import/list/get/sync parity to the existing file-backed behavior. Added local MySQL bootstrap assets (`docker-compose.mysql.yml`, `backend/mysql/init/001_create_cloud_projects.sql`), root helper scripts (`db:mysql:up/down/logs`), and setup notes in `backend/LOCAL_MYSQL.md`. Also aligned modified Korean-comment source files to UTF-8 BOM per encoding discipline.
- Tests run: `yarn install --mode=skip-build` (outside sandbox after EPERM); `yarn workspace @scenaairo/backend typecheck`; `yarn workspace @scenaairo/backend lint`; `yarn workspace @scenaairo/backend test` (outside sandbox after spawn EPERM); `yarn workspace @scenaairo/backend integration` (outside sandbox after spawn EPERM); `yarn workspace @scenaairo/backend build`
- Result: Backend lint/typecheck/test/integration are green with the new MySQL path in place, and local MySQL can now be started with dedicated compose/scripts for test use.
- Warnings / blockers: Direct `yarn workspace @scenaairo/backend build` still fails if `@scenaairo/shared` build artifacts are stale because `tsconfig.build.json` resolves package imports differently from local typecheck; this is a pre-existing workspace build-order issue and not introduced by the MySQL slice.
- Approval needed: `none`

### 2026-04-21 / loop-063
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/`, `PLANS.md`
- What changed: Implemented the first stabilization step for delete/undo node recreation behavior by removing immediate node-size map pruning in `WorkspaceShell.tsx`. The prior effect sanitized `nodeSizes` against currently visible episode nodes after each snapshot change; deleting a node removed its size entry, so undo recreated the node with default dimensions and unstable overlap/layout results. The sanitize effect was removed and a guard comment was added to keep deleted-node size entries until history settles, preserving same-id size restoration during undo/redo.
- Tests run: `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.tsx`
- Result: The targeted fix is applied; existing lint baseline remains with pre-existing `react-hooks/set-state-in-effect` findings.
- Warnings / blockers: This loop does not yet migrate timeline/divider/node-size UI state into controller snapshot history, so full structural history parity is still a follow-up item.
- Approval needed: `none`

### 2026-04-21 / loop-071
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `AGENT_SYSTEM.md`, `PLANS.md`
- What changed: Added an explicit concurrent-chat/worktree coordination rule to `AGENT_SYSTEM.md` under the soft-ownership section. The new rule states that concurrent Codex chats do not provide automatic same-file serialization, that agents must re-read the latest file before editing if concurrent touch is possible, and that same-file work should be sequenced through the Orchestrator as effectively single-writer work. It also recommends disjoint file ownership and separate branches/worktrees for larger parallel efforts.
- Tests run: UTF-8 readback check of the updated `AGENT_SYSTEM.md`; `git -c safe.directory=C:/work/ARIAD status --short AGENT_SYSTEM.md`
- Result: The repository operating rules now explicitly document how to handle concurrent chats touching the same workspace.
- Warnings / blockers: None.
- Approval needed: `none`

### 2026-04-21 / loop-065
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `backend/src/persistence/`, `frontend/src/persistence/`, `frontend/src/routes/`, `frontend/src/copy.ts`, `PLANS.md`
- What changed: Applied the folder-sharing follow-up on top of the object-to-episode model by switching to a reference-sharing strategy. Backend snapshot/dependency validation now allows node-to-object links across episodes as long as project ownership matches, instead of forcing same-episode only. Frontend persistence controller now also allows same-project cross-episode object attachment and adds `localizeObjectReferencesForEpisode()` to clone external-episode references into the target episode when detaching from folder-level sharing. WorkspaceShell object scope and mention reuse were expanded from active-episode-only to folder-episode scope, and folder membership removal/deletion flows now localize shared references before unlinking to prevent broken links after folder structure changes.
- Tests run: `yarn workspace @scenaairo/shared typecheck`; `yarn workspace @scenaairo/backend typecheck`; `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/backend integration`; `yarn workspace @scenaairo/frontend run -T vitest run src/persistence/controller.test.ts src/persistence/flushQueue.test.ts` (rerun outside sandbox after Vite spawn EPERM in sandbox)
- Result: Folder member episodes can now reuse each other's objects by reference without forcing schema re-parenting, and folder detach/delete paths preserve stability by localizing cross-episode references first. Relevant domain/persistence validation commands passed.
- Warnings / blockers: Full frontend suite was not rerun in this loop; only the impacted persistence tests were executed.
- Approval needed: `none`

### 2026-04-21 / loop-066
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Continued the undo/redo stabilization slice by aligning route tests with the new focus-scoped shortcut policy and adding a dedicated regression for delete->undo->redo node reconstruction. Updated the keyboard shortcut test to trigger workspace shortcuts from the focused canvas viewport (instead of global window target), updated inline-editor `Ctrl/Cmd+Z` expectation to keep browser-native text undo behavior (no workspace node-count rollback), and added a new test that resizes a node, deletes it, then validates undo/redo cycles restore both the node and its resized width (`316px`) consistently.
- Tests run: `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx --reporter=dot` (outside sandbox due Vite spawn EPERM in sandbox); `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.test.tsx`; `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.tsx src/routes/WorkspaceShell.test.tsx`
- Result: `WorkspaceShell` route tests now pass 20/20 including the new delete/undo/redo dimension-restoration regression. Typecheck is green. `WorkspaceShell.tsx` still reports the pre-existing 7 `react-hooks/set-state-in-effect` lint errors unrelated to this slice.
- Warnings / blockers: None.
- Approval needed: `none`

### 2026-04-21 / loop-067
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/copy.ts`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Updated object-detail UI so creators can immediately identify which episode owns a selected/shared object in folder-sharing scenarios. Added new copy keys (`objectEpisode`, `objectEpisodeMissing`), derived an episode lookup from the current snapshot, and surfaced a read-only `Owned Episode` field in the object detail editor. Also extended the fullscreen object-detail regression test to assert the owner episode value is rendered (`Episode 12`).
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/copy.ts src/routes/WorkspaceShell.test.tsx`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.tsx`; `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx --reporter=dot` (outside sandbox due Vite spawn EPERM in sandbox)
- Result: Object detail now clearly exposes the owning episode for the clicked object, and route tests remain green (20/20).
- Warnings / blockers: `WorkspaceShell.tsx` still reports the pre-existing 7 `react-hooks/set-state-in-effect` lint errors unrelated to this UI slice.
- Approval needed: `none`

### 2026-04-21 / loop-068
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Adjusted object-owner episode display policy per UX request. In object detail mode, `Owned Episode` now renders as plain read-only text (non-input control) and only appears when the selected object's owning episode is currently in a folder scope. For root/non-folder episodes, the owner row is hidden entirely. Updated fullscreen object-detail regression expectation accordingly to assert `Owned Episode` is absent when no folder membership exists.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.test.tsx`; `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx --reporter=dot` (outside sandbox due Vite spawn EPERM in sandbox); `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.tsx`
- Result: UI now matches the requested visibility rule for owner-episode display, and route tests are green (21/21).
- Warnings / blockers: `WorkspaceShell.tsx` still has the same pre-existing 7 `react-hooks/set-state-in-effect` lint errors unrelated to this slice.
- Approval needed: `none`

### 2026-04-21 / loop-069
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/workspace-shell/workspaceShell.common.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Fixed fullscreen overlay-root routing so viewport overlays use `document.fullscreenElement` when available instead of always using `document.body`. This keeps node-level overlay actions (including `More` menu actions) visible and interactive when the canvas enters fullscreen mode. Added a regression test that verifies the node `More` menu overlay is rendered inside the fullscreen canvas container.
- Tests run: `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx --reporter=dot` (rerun outside sandbox after in-sandbox `spawn EPERM`); `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/workspace-shell/workspaceShell.common.tsx src/routes/WorkspaceShell.test.tsx`
- Result: `WorkspaceShell` route tests pass 21/21 with the new fullscreen node-overlay regression included, and the touched files are typecheck/lint clean.
- Warnings / blockers: The first in-sandbox vitest execution failed with `spawn EPERM`, so test verification required an outside-sandbox rerun. No remaining blockers for this fix.
- Approval needed: `none`
### 2026-04-21 / loop-070
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `PROJECT_OVERVIEW_KO.md`, `PLANS.md`
- What changed: Refreshed the Korean project overview document to match the current frontend/backend implementation. Updated the repo tree to show the split `frontend/src/routes/workspace-shell/` helper modules and the backend local MySQL assets (`backend/mysql/init/`, `backend/LOCAL_MYSQL.md`, `docker-compose.mysql.yml`). Revised frontend sections to describe episode-owned objects with folder-scope reference reuse, owner-episode display rules, and persistence/controller responsibilities. Revised backend sections to describe selectable file vs MySQL persistence, new env keys, MySQL store, and root MySQL helper scripts.
- Tests run: UTF-8 readback of `PROJECT_OVERVIEW_KO.md`; keyword grep checks for updated frontend/backend overview terms
- Result: The overview document now reflects the latest frontend/backend structure and behavior instead of the older project-wide object model and pre-split workspace shell layout.
- Warnings / blockers: None.
- Approval needed: `none`

### 2026-04-21 / loop-071
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Hardened node-resize interaction startup by switching node resize handles from `onMouseDown` to `onPointerDown` and updating `beginNodeResize()` to consume `ReactPointerEvent`. Added a left-click guard (`event.button === 0`) plus optional pointer capture on drag start so resize drag activation is more consistent across pointer input paths.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.tsx src/routes/WorkspaceShell.test.tsx` (existing `WorkspaceShell.tsx` pre-existing `react-hooks/set-state-in-effect` findings remain); `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx -t "resize" --reporter=dot` (outside sandbox due Vite `spawn EPERM` in sandbox); `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx --reporter=dot` (outside sandbox due Vite `spawn EPERM` in sandbox)
- Result: Resize-specific regressions and the full `WorkspaceShell` test file are green (`21/21`), with node-resize interactions now driven by pointer events.
- Warnings / blockers: `WorkspaceShell.tsx` still contains the same pre-existing 7 `react-hooks/set-state-in-effect` lint errors unrelated to this resize fix.
- Approval needed: `none`

### 2026-04-21 / loop-069
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts`, `PLANS.md`
- What changed: Fixed intermittent inline token deletion behavior where backspace/delete could remove only a single character instead of the full token. Updated `removeAdjacentInlineToken` so token removal triggers not only at exact token boundaries, but also when the caret is inside a keyword/object token range. Added focused regression tests for backward/forward deletion inside keyword tokens and forward deletion inside object tokens.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/workspace-shell/workspaceShell.inlineEditor.tsx src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts`; `yarn workspace @scenaairo/frontend run -T vitest run src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts --reporter=dot` (outside sandbox due Vite spawn EPERM in sandbox)
- Result: Inline token deletion now consistently removes the entire token when caret is inside that token, and new regression tests pass (3/3).
- Warnings / blockers: None.
- Approval needed: `none`

### 2026-04-21 / loop-072
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/styles.css`, `PLANS.md`
- What changed: Addressed two issues together. (1) Fullscreen interaction reliability: raised selected-node stacking priority and added `touch-action: none` on resize handles to reduce pointer interception during fullscreen resize/drags. (2) Major-lane start/end stability: introduced episode-scoped in-memory major-anchor tracking (`startId`/`endId`) and applied anchor-preserving placement behavior so designated start/end major nodes keep anchor identity during move/resize instead of being released by overlap/layout recomputation.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx --reporter=dot` (outside sandbox due Vite `spawn EPERM` in sandbox); `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.test.tsx src/styles.css`
- Result: `WorkspaceShell` route test suite is green with new regressions included (`23/23`), including fullscreen resize and start/end-marker persistence after major-node resize.
- Warnings / blockers: Full-file `WorkspaceShell.tsx` lint still has the same pre-existing `react-hooks/set-state-in-effect` findings and was not expanded in this loop.
- Approval needed: `none`

### 2026-04-21 / loop-070
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts`, `PLANS.md`
- What changed: Fixed range-delete behavior for inline mention/keyword tokens so drag-select + Backspace/Delete can no longer leave partial token fragments. Added `removeInlineSelectionWithTokenBoundaries()` to expand a selected range to full token boundaries whenever the selection intersects an inline token, then remove atomically. Wired this into `WorkspaceShell` textarea key handling for non-collapsed selections on Backspace/Delete. This prevents malformed partial mentions and the follow-on side effect where truncated mention text could be interpreted as a new object candidate.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/workspace-shell/workspaceShell.inlineEditor.tsx src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts`; `yarn workspace @scenaairo/frontend run -T vitest run src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts --reporter=dot` (outside sandbox due Vite spawn EPERM in sandbox)
- Result: Range deletion over mention/keyword tokens now consistently deletes entire tokens, and focused regression tests pass (5/5).
- Warnings / blockers: None.
- Approval needed: `none`
### 2026-04-21 / loop-071
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: frontend/src/persistence/, frontend/src/routes/WorkspaceShell.tsx, PLANS.md
- What changed: Added loss-mitigation persistence sync logic for cloud mode. LocalPersistenceStore now keeps pending CloudSyncOperation queue in localStorage. PersistenceFlushQueue now restores pending operations on startup, persists queue updates, retries failed sync with exponential backoff, and skips auto-retry escalation for not_authenticated errors while retaining pending operations. WorkspacePersistenceController now wires queue persistence callbacks, guards flushNow to authenticated cloud-linked sessions only, and triggers immediate replay flush after authenticated session connection. WorkspaceShell now triggers best-effort flush on pagehide, beforeunload, visibility hidden, and online events. CloudPersistenceClient sync requests now use fetch keepalive for better unload-time delivery.
- Tests run: yarn workspace @scenaairo/frontend run -T vitest run src/persistence/flushQueue.test.ts src/persistence/controller.test.ts (outside sandbox after spawn EPERM); yarn workspace @scenaairo/frontend run -T eslint src/persistence/localStore.ts src/persistence/flushQueue.ts src/persistence/cloudClient.ts src/persistence/controller.ts; yarn workspace @scenaairo/frontend typecheck
- Result: Frontend persistence queue now survives tab close/process restart in local storage and can replay pending operations after re-authentication. Targeted lint, typecheck, and persistence tests are green.
- Warnings / blockers: WorkspaceShell.tsx still has pre-existing react-hooks/set-state-in-effect lint findings when linting that file directly; this loop did not widen scope to refactor those existing effects.
- Approval needed: none

### 2026-04-21 / loop-071
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts`, `PLANS.md`
- What changed: Implemented two canvas-behavior updates. (1) When the major lane has no existing major nodes, creating a new major node now seeds that node with a height aligned to the current major timeline-arrow span (`effectiveTimelineEndY - timelineStartY`, min-guarded), so the first major node is initialized against timeline length instead of the fixed default card height. (2) Added deletion-time canvas compaction: deleting a node subtree now recomputes the remaining visible-node bottoms and lowers `timelineEndY` when possible so empty tail space shrinks naturally after node removal. Also preserved the recent inline token safety improvements by adding/keeping focused token-deletion tests.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.test.tsx src/routes/workspace-shell/workspaceShell.inlineEditor.tsx src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts`; `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx -t "sizes the first major node to timeline span and shrinks timeline after deletion" --reporter=dot` (outside sandbox due Vite spawn EPERM in sandbox); `yarn workspace @scenaairo/frontend run -T vitest run src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts --reporter=dot` (outside sandbox due Vite spawn EPERM in sandbox); `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.tsx`
- Result: New major-node initialization and delete-time canvas shrink behavior are both implemented and covered by targeted regression tests. Inline token deletion regressions remain green.
- Warnings / blockers: `WorkspaceShell.tsx` still reports the same pre-existing 7 `react-hooks/set-state-in-effect` lint errors; full-route test sweep was not used as the completion gate for this slice because unrelated existing assertions in other scenarios remain noisy.
- Approval needed: `none`

### 2026-04-21 / loop-073
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`, `PLANS.md`
- What changed: Applied three canvas interaction/layout fixes. (1) Vertical resize drag now updates node size continuously during pointer move and defers timeline bottom recomputation to drag-end, reducing resize-path jitter while keeping final timeline height in sync with node bottoms. (2) Horizontal lane auto-sizing now uses per-lane required widths (`major/minor/detail`) so divider gaps expand from the widest node in each lane instead of relying on placement-side overflow estimates. (3) Lane X placement was normalized to lane-center alignment for non-major nodes in shared canvas helpers, and X clamp behavior now respects lane bounds rather than global canvas-right clamps, preventing cross-lane visual invasion during width growth and keeping connection ports aligned to centered nodes.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.test.tsx src/routes/workspace-shell/workspaceShell.canvas.ts`; `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx --reporter=dot` (outside sandbox due Vite spawn EPERM in sandbox)
- Result: `WorkspaceShell` route tests are green (`26/26`) with new regressions covering vertical resize shrink delta consistency and minor-lane center/connection/lane-width behavior after horizontal resize.
- Warnings / blockers: Linting `WorkspaceShell.tsx` directly still reports the same pre-existing `react-hooks/set-state-in-effect` findings unrelated to this slice.
- Approval needed: `none`

### 2026-04-21 / loop-074
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Applied a follow-up fix for reported vertical-resize shrink lag. During resize drag, vertical minimum clamp now uses baseline card minimum (`nodeCardHeight`) instead of content-derived minimum. Also updated drag-end input-height sync so manual vertical/diagonal resize paths preserve manual height (`preserveManualHeight`) instead of immediately re-expanding from editor scroll-height calculations. Added regression coverage that mocks a large inline-editor scroll height and verifies manual vertical shrink remains applied after pointer-up.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.test.tsx`; `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx --reporter=dot` (outside sandbox due Vite spawn EPERM in sandbox)
- Result: `WorkspaceShell` route tests are green (`27/27`) including the new manual-vertical-shrink preservation regression.
- Warnings / blockers: Direct lint on `WorkspaceShell.tsx` still has the same pre-existing `react-hooks/set-state-in-effect` findings and was not widened in this loop.
- Approval needed: `none`

### 2026-04-21 / loop-075
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Applied an arrow-length follow-up by changing connection anchor X coordinates from card-side edges to card-center X on both generated connection paths and rewire preview paths. This makes arrow span respond to node width/position changes more visibly and keeps ports aligned with the visual center line of resized nodes. Updated regression expectations to validate center-aligned connection ports and post-resize arrow movement.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.test.tsx src/routes/workspace-shell/workspaceShell.canvas.ts`; `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx --reporter=dot` (outside sandbox due Vite spawn EPERM in sandbox)
- Result: `WorkspaceShell` route tests remain green (`27/27`) with updated arrow-anchor expectations.
- Warnings / blockers: No new blockers; direct full-file lint on `WorkspaceShell.tsx` still has pre-existing unrelated `react-hooks/set-state-in-effect` findings.
- Approval needed: `none`

### 2026-04-21 / loop-076
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Applied UX guard for timeline arrow-end drag. When the major lane has only one anchor node (`startMajorNodeId === endMajorNodeId`), timeline-end handle interaction is now disabled (`disabled` on button + drag-start early return). Added regression test that verifies `Move timeline end` is disabled in single-major state and becomes enabled after creating a second major node.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.tsx src/routes/WorkspaceShell.test.tsx` (shows pre-existing `WorkspaceShell.tsx` `react-hooks/set-state-in-effect` findings); `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.test.tsx`; `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx --reporter=dot` (outside sandbox due Vite spawn EPERM in sandbox)
- Result: `WorkspaceShell` route tests are green (`28/28`) with the new timeline-handle disable regression.
- Warnings / blockers: No new blockers; direct lint on `WorkspaceShell.tsx` still reports the same unrelated pre-existing effect warnings.
- Approval needed: `none`

### 2026-04-21 / loop-077
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Refined canvas zoom interaction so `Ctrl/Cmd + wheel` is handled only when the wheel event target is inside `.canvas-viewport` and the canvas viewport itself is focused. The wheel handler continues to use a non-passive native listener so browser-level page zoom can be prevented in this focused-canvas path. Added and stabilized a regression test that focuses the canvas viewport, dispatches a ctrl-wheel event, verifies zoom readout changes (`100% -> 118%`), and confirms `defaultPrevented` is true.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.test.tsx`; `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx --reporter=dot` (outside sandbox due Vite spawn EPERM in sandbox)
- Result: `WorkspaceShell` route tests are green (`30/30`) including the focused ctrl-wheel canvas-zoom regression.
- Warnings / blockers: No new blockers. Full-file direct lint on `WorkspaceShell.tsx` was not used as a gate due pre-existing unrelated `react-hooks/set-state-in-effect` findings.
- Approval needed: `none`

### 2026-04-21 / loop-077
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/styles.css`, `PLANS.md`
- What changed: Applied follow-up drag/resize stability fixes based on user repro. In major-node free-move flow, removed forced start/end anchor coordinate overwrite so major start/end nodes can move with normal snap constraints instead of being pinned back after drop. In CSS, reduced resize-handle hit areas and enabled pointer interaction only on selected-node hover/focus to lower accidental vertical resize triggers during regular drag attempts.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx --reporter=dot` (outside sandbox due Vite spawn EPERM in sandbox)
- Result: `WorkspaceShell` route regressions remain green (`28/28`) after drag/resize interaction adjustments.
- Warnings / blockers: No new blockers; direct full-file lint on `WorkspaceShell.tsx` still has the same pre-existing `react-hooks/set-state-in-effect` findings and was not widened in this loop.
- Approval needed: `none`

### 2026-04-21 / loop-078
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/styles.css`, `PLANS.md`
- What changed: Applied second follow-up for resize UX. Added explicit drag-start guard while node resize is active (`isNodeResizingRef`) and blocked drag initialization from resize handles, so resize no longer co-triggers node move. Expanded resize-handle interactive range back from the overly narrow hit area while keeping accidental-trigger mitigation (handles are still pointer-active only on selected hover/focus). Added a regression test to verify vertical resize changes height without changing node `left/top`. Also stabilized the existing ctrl+wheel zoom test path by waiting for viewport readiness and restoring viewport-native wheel listener registration before loading completes.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.tsx src/routes/WorkspaceShell.test.tsx` (same pre-existing `WorkspaceShell.tsx` effect lint findings only); `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx --reporter=dot` (outside sandbox due Vite spawn EPERM in sandbox)
- Result: `WorkspaceShell` route suite is green (`30/30`), including the new resize-without-move regression.
- Warnings / blockers: No new blockers; `WorkspaceShell.tsx` still has the same pre-existing 7 `react-hooks/set-state-in-effect` findings unrelated to this fix.
- Approval needed: `none`

### 2026-04-21 / loop-079
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Relaxed the canvas ctrl/cmd+wheel zoom guard so wheel events originating from any element inside `.canvas-viewport` also drive canvas zoom, not just when the viewport itself owns focus. This keeps canvas zoom working while the pointer is over selected nodes or inline node inputs. Added a regression test that focuses a node textbox and verifies ctrl+wheel still updates the canvas zoom readout and prevents the default browser zoom path.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.test.tsx`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.tsx` (same pre-existing `react-hooks/set-state-in-effect` errors plus one dependency warning); `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx --reporter=dot` (outside sandbox due Vite `spawn EPERM` in sandbox)
- Result: `WorkspaceShell` route suite is green (`31/31`), and ctrl+wheel now zooms the canvas even when focus is inside a node on the canvas.
- Warnings / blockers: No new blockers. Direct lint on `WorkspaceShell.tsx` still reports the same unrelated pre-existing effect-rule issues and was not changed in this loop.
- Approval needed: `none`

### 2026-04-21 / loop-080
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Fixed the inline text typing auto-height feedback issue. In `syncSelectedNodeInputHeight()`, node auto-height no longer uses `.node-inline-editor.scrollHeight` (which can track already-expanded card height and create cumulative growth while typing). Height is now derived from measured text input height plus node-frame padding only. Added a regression test that mocks `inlineEditor.scrollHeight` to follow current node card height and verifies repeated typing keeps node height stable after the initial content-fit adjustment.
- Tests run: `yarn workspace @scenaairo/frontend typecheck` (fails with pre-existing TS errors in `WorkspaceShell.tsx` around lines 902 and 945, unrelated to this change); `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.test.tsx`; `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx --reporter=dot` (outside sandbox due Vite `spawn EPERM` in sandbox); `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.tsx src/routes/WorkspaceShell.test.tsx` (shows pre-existing `WorkspaceShell.tsx` `react-hooks/set-state-in-effect` findings)
- Result: `WorkspaceShell` route tests are green (`32/32`) including the new typing-height-stability regression, and node height no longer keeps increasing as text is entered.
- Warnings / blockers: No new blockers. Frontend typecheck/lint baseline still has unrelated existing issues in `WorkspaceShell.tsx`.
- Approval needed: `none`

### 2026-04-21 / loop-081
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/styles.css`, `PLANS.md`
- What changed: Replaced existing-node movement from native HTML drag/drop with pointer-based drag handling. Added a small drag activation threshold so pressing/holding a node no longer starts movement by itself, and movement now commits from a live preview position on pointer release. Kept lane constraints intact, added a dragging visual state, and added a regression test that verifies a minor node stays in place under tiny pointer movement but moves downward once the drag crosses the threshold.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.tsx src/routes/WorkspaceShell.test.tsx` (shows the same pre-existing `WorkspaceShell.tsx` `react-hooks/set-state-in-effect` errors plus one existing dependency-array warning); `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx --reporter=dot` (outside sandbox due Vite `spawn EPERM` in sandbox); `yarn workspace @scenaairo/frontend build` (outside sandbox due Vite `spawn EPERM` in sandbox)
- Result: `WorkspaceShell` route suite is green (`33/33`), frontend production build passes, and node movement no longer begins on hold-only input.
- Warnings / blockers: No new blockers. Direct lint on `WorkspaceShell.tsx` still reports the same unrelated pre-existing effect-rule errors/warning and was not widened in this loop.
- Approval needed: `none`

### 2026-04-21 / loop-082
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Applied a focused move/resize stability hardening pass across three points. (1) Timeline anchor alignment now uses the actual resized major-node dimensions when snapping/locking major start/end nodes, preventing center/bottom drift after end-node size changes. (2) Fixed-node protection now also blocks resize behavior: resize start returns early for busy/fixed nodes and resize handles are not rendered on fixed selected nodes. (3) Horizontal resize now enforces a lane-safe dynamic max width based on current divider constraints and neighbor-lane minimum widths, preventing extreme drag from pushing minor/detail nodes beyond lane bounds at the canvas edge. Added regressions for end-major anchor alignment after resize, fixed-node resize-handle suppression, and extreme minor horizontal resize bounds.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/workspace-shell/workspaceShell.canvas.ts src/routes/WorkspaceShell.test.tsx`; `yarn workspace @scenaairo/frontend run -T eslint src/routes/WorkspaceShell.tsx` (shows existing `react-hooks/set-state-in-effect` findings in this file); `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx --reporter=dot` (outside sandbox due Vite `spawn EPERM` in sandbox)
- Result: `WorkspaceShell` route tests are green (`36/36`) with the new move/resize UI regressions included, and frontend typecheck is green.
- Warnings / blockers: Direct lint on `WorkspaceShell.tsx` still reports the same pre-existing effect-rule issues unrelated to this slice.
- Approval needed: `none`

### 2026-04-21 / loop-083
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/styles.css`, `PLANS.md`
- What changed: Added a node-reorder motion smoothing pass to reduce the "teleport" perception during order swaps. `.node-card` now animates `left/top` with a short ease-out curve, and `.node-card.is-dragging` disables position transition so the actively dragged card still tracks pointer movement immediately.
- Tests run: `corepack yarn --cwd frontend test -- src/routes/workspace-shell/workspaceShell.canvas.test.ts src/routes/WorkspaceShell.test.tsx` (outside sandbox due Vite `spawn EPERM` in sandbox)
- Result: Targeted canvas/WorkspaceShell tests are green (`62/62`) after the animation change.
- Warnings / blockers: No new blockers identified in this loop.
- Approval needed: `none`

### 2026-04-21 / loop-084
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/styles.css`, `PLANS.md`
- What changed: Added explicit sidebar active-state styling for the currently selected episode and its containing folder instead of relying on item order. The sidebar now applies active classes to episode shells/links and active-folder classes to the containing folder shell/button, with stronger background, border, shadow, icon, and nested-list cues. Added a regression test that moves the active episode into a folder and verifies both the folder and the selected episode remain highlighted as selection changes within that folder.
- Tests run: `yarn workspace @scenaairo/frontend typecheck`; `yarn workspace @scenaairo/frontend run -T vitest run src/routes/WorkspaceShell.test.tsx -t "highlights the selected episode and its containing folder in the sidebar" --reporter=dot` (outside sandbox due Vite `spawn EPERM` in sandbox)
- Result: Sidebar selection emphasis is implemented and the targeted regression test passes (`1 passed`).
- Warnings / blockers: No new blockers. Targeted Vitest still requires out-of-sandbox execution in this environment because Vite hits the existing sandbox `spawn EPERM` restriction.
- Approval needed: `none`

### 2026-04-21 / loop-085
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Fixed node inline-editor auto-height growth on keyboard-only interactions. Removed height sync from `textarea.onKeyUp` (still keeping mention-query refresh there), and hardened `syncSelectedNodeInputHeight` measurement so it resets textarea height before measuring and ignores preview heights that diverge from real text-content height. Added a regression test that simulates preview `scrollHeight` tracking card height and verifies repeated key-only interactions (`ArrowUp/ArrowDown/Escape/Control`) do not increase node height.
- Tests run: `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx` (outside sandbox due Vite `spawn EPERM` in sandbox); `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.test.tsx`; `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.tsx src/routes/WorkspaceShell.test.tsx` (shows pre-existing `WorkspaceShell.tsx` `react-hooks/set-state-in-effect` findings)
- Result: `WorkspaceShell` tests are green (`63/63`) with the new keyboard-interaction height regression covered, and frontend typecheck is green.
- Warnings / blockers: No new blockers; `WorkspaceShell.tsx` continues to have the same pre-existing effect-rule lint errors/warning unrelated to this loop.
- Approval needed: `none`

### 2026-04-22 / loop-087
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/styles.css`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Removed the dedicated node drag button and switched to card-body-only node reordering UX. Deleted `node-drag-handle` rendering and related option path in `beginNodeDrag`, so node movement starts directly from non-interactive node-card regions while preserving the existing drag-threshold behavior. Kept position transition-based motion smoothing for reorder, added same-coordinate drag-preview deduping to reduce redundant rerender flicker during drag, and updated regression coverage to assert that no `Move ...` handle is rendered while card dragging still moves the node.
- Tests run: `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx` (outside sandbox due Vite `spawn EPERM` in sandbox); `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.test.tsx`; `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.tsx src/routes/WorkspaceShell.test.tsx` (shows pre-existing `WorkspaceShell.tsx` `react-hooks/set-state-in-effect` findings)
- Result: `WorkspaceShell` tests are green (`65/65`) with the updated drag-handle removal regression included, and frontend typecheck is green.
- Warnings / blockers: No new blockers; direct lint on `WorkspaceShell.tsx` still reports the same pre-existing effect-rule issues unrelated to this slice.
- Approval needed: `none`

### 2026-04-22 / loop-086
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/styles.css`, `PLANS.md`
- What changed: Investigated user-reported node reposition issue and confirmed selected-node body drag can be constrained by inline editing targets. Added a dedicated node drag handle (`.node-drag-handle`) so users can always move nodes without conflicting with textarea editing interactions. Updated drag-start helper to allow explicit interactive-target starts only for this handle path, and added a regression test that drags a selected minor node via the new handle and verifies vertical position changes.
- Tests run: `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx -t "moves the selected node from the dedicated drag handle"` (outside sandbox due Vite `spawn EPERM` in sandbox); `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.tsx src/routes/WorkspaceShell.test.tsx` (shows pre-existing `WorkspaceShell.tsx` `react-hooks/set-state-in-effect` findings); `corepack yarn --cwd frontend build` (outside sandbox due Vite `spawn EPERM` in sandbox)
- Result: Node move interaction is now available through an explicit top-left drag handle on each non-fixed node, and frontend tests/build remain green with the new regression included (`65/65` in the executed WorkspaceShell suite).
- Warnings / blockers: No new blockers. Direct lint on `WorkspaceShell.tsx` still reports the same pre-existing `react-hooks/set-state-in-effect` issues unrelated to this slice.
- Approval needed: `none`

### 2026-04-22 / loop-088
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Fixed node drag reorder behavior and stale major end-marker resolution together. In drag commit flow, node movement now persists both canvas placement and structural order by calling `controller.moveNode(...)` with a Y-projected insert index (excluding the moving node from anchor lookup). For major anchors, start/end marker selection now derives from current ordered major nodes each render instead of prioritizing persisted ref anchors, eliminating stale `is-end-node` state after new major-node additions. Added/updated regression coverage so (1) the last ordered major node is always marked `is-end-node`, and (2) dragging a major node to the bottom updates both order and end-marker assignment.
- Tests run: `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx` (outside sandbox due Vite `spawn EPERM` in sandbox); `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx -t "reorders major nodes on drag and updates the end-node marker to the last ordered node"` (outside sandbox due Vite `spawn EPERM` in sandbox); `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.test.tsx`; `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.tsx` (shows pre-existing `react-hooks/set-state-in-effect` findings)
- Result: `WorkspaceShell` tests are green (`66/66`), including the new major reorder/end-marker regression, and frontend typecheck is green.
- Warnings / blockers: No new blockers; direct lint on `WorkspaceShell.tsx` still reports the same pre-existing effect-rule issues unrelated to this slice.
- Approval needed: `none`

### 2026-04-22 / loop-089
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `PLANS.md`
- What changed: Reviewed the recent node reorder work and current persistence architecture to prepare a multi-chat execution plan. Confirmed that drag reorder now reaches `controller.moveNode(...)`, which renormalizes episode-local `orderIndex`, but backend persistence still stores full project snapshots and accepts node order as part of generic node upserts. Also confirmed that the optional MySQL path persists `cloud_projects.snapshot_json` rather than a normalized node table, so any "DB-level reorder" effort is a persistence-model change rather than a small schema tweak. Prepared a phased plan that separates contract/backend canonical-order work from any later DB normalization spike.
- Tests run: Read-only code/log inspection only
- Result: Ready to hand off a multi-chat plan with explicit sequencing and disjoint write scopes for reorder-related backend/frontend/database work.
- Warnings / blockers: None.
- Approval needed: `none`

### 2026-04-22 / loop-090
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Patched node reorder index calculation to use same-level node center-Y ordering instead of mixed-level top-Y ordering, and excluded the moving node from anchor lookup to avoid reciprocal reorder jitter during drag/drop. For major nodes, kept overlap-safe placement persistence but switched reorder-index projection to the intended drag placement (timeline-snapped, overlap resolution 전) so dragging a lower major node to the top can promote it to the first node. Added regression coverage for upward major reorder (`lower -> first`) and verified the existing downward major reorder/end-marker test still passes.
- Tests run: `C:\windows\System32\WindowsPowerShell\v1.0\powershell.exe -Command corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx` (outside sandbox due Vite `spawn EPERM` in sandbox); `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.tsx src/routes/WorkspaceShell.test.tsx` (pre-existing `WorkspaceShell.tsx` `react-hooks/set-state-in-effect` findings only)
- Result: `WorkspaceShell` route suite is green (`67/67`) including 신규 상향 재정렬 회귀 케이스, and frontend typecheck is green.
- Warnings / blockers: No new blockers. Direct lint on `WorkspaceShell.tsx` continues to report the same pre-existing effect-rule issues unrelated to this patch.
- Approval needed: `none`

### 2026-04-22 / loop-091
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `backend/src/persistence/store.ts`, `backend/src/persistence/mysql-store.ts`, `backend/src/persistence/routes.integration.test.ts`, `PLANS.md`
- What changed: Started the loop-089 phase plan with the contract/backend canonical-order freeze slice first. Updated both file-backed and MySQL-backed persistence normalization so node ordering is canonicalized per episode (`orderIndex` renormalized to contiguous `1..N` after stable ordering by `orderIndex -> createdAt -> id`) instead of only globally sorting raw indices. Added backend integration coverage that sends sparse/duplicate node order values across two episodes and verifies sync/get responses always return episode-scoped canonical ordering.
- Tests run: `corepack yarn --cwd backend typecheck`; `corepack yarn --cwd backend integration`; `corepack yarn --cwd backend run -T eslint src/persistence/store.ts src/persistence/mysql-store.ts src/persistence/routes.integration.test.ts`; `corepack yarn --cwd backend build` (fails with pre-existing `StoryObject.episodeId` declaration mismatch from shared `.d.ts`)
- Result: Contract freeze phase-1 is in place for backend persistence paths; canonical node order is now deterministic and episode-scoped in both sync response and persisted reload paths.
- Warnings / blockers: Contract freeze slice 자체의 타입체크/통합테스트/린트는 통과했지만, `build smoke`는 기존 shared declaration mismatch(`StoryObject`에 `episodeId` 누락) 때문에 실패했다. 이 루프는 해당 타입 선언 불일치 수정을 범위 밖으로 두었고 DB schema normalization(`cloud_projects.snapshot_json`)도 의도적으로 시작하지 않았다.
- Approval needed: `none`

### 2026-04-22 / loop-093
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `backend/src/persistence/routes.ts`, `backend/src/persistence/store.ts`, `backend/src/persistence/mysql-store.ts`, `backend/src/persistence/node-order.ts`, `backend/src/persistence/routes.integration.test.ts`, `PLANS.md`
- What changed: Executed the requested Backend Canonical Reorder authority slice following `NODE_REORDER_EXECUTION_PLAN.md` Track B / Chat 2 scope. Added a new persistence helper (`node-order.ts`) that centralizes deterministic node ordering, per-episode contiguous `orderIndex` canonicalization, parent-level/episode/project graph validation, cycle detection, and stale node revision checks. Applied that helper to both file-backed and MySQL-backed stores so sync/import flows now enforce server-side reorder authority. Strengthened dependency checks for parent episode boundaries and drawer source-node episode consistency. Updated sync error handling in routes to return semantic status codes (`409` for stale revision, `422` for validation, `404` for missing project). Expanded integration tests to cover cross-episode parent rejection, subtree parent-integrity rejection, stale revision conflict, and canonicalized sparse/duplicate ordering.
- Tests run: `corepack yarn --cwd backend typecheck`; `corepack yarn --cwd backend integration`; `corepack yarn --cwd backend run -T eslint src/persistence/routes.ts src/persistence/store.ts src/persistence/mysql-store.ts src/persistence/node-order.ts src/persistence/routes.integration.test.ts`; `corepack yarn --cwd backend build` (fails with pre-existing shared declaration mismatch: `StoryObject.episodeId` missing in shared `.d.ts`)
- Result: Backend now treats reorder semantics as authoritative server concern and validates/canonicalizes node ordering and parent integrity before persisting snapshot state.
- Warnings / blockers: `build smoke` is still blocked by the same pre-existing shared declaration drift (`shared/src/types/domain.d.ts` vs runtime/shared source types) and is not introduced by this loop.
- Approval needed: `none`

### 2026-04-22 / loop-094
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `NODE_REORDER_EXECUTION_PLAN.md`, `PLANS.md`
- What changed: Kept `PLANS.md` in its existing work-loop-log format and moved the detailed node reorder persistence/DB execution plan into a new standalone document, `NODE_REORDER_EXECUTION_PLAN.md`. The new document captures current reorder architecture, the recommended two-stage direction (backend canonicalization first, DB normalization spike later), track-by-track work breakdown, per-chat ownership/scope, sequencing rules, test gates, and stop conditions.
- Tests run: UTF-8 readback of `NODE_REORDER_EXECUTION_PLAN.md`; BOM byte check (`EF BB BF`)
- Result: Detailed reorder planning is now separated from the running execution log, so `PLANS.md` can stay concise while the new document serves as the handoff/reference plan for parallel chats.
- Warnings / blockers: None.
- Approval needed: `none`

### 2026-04-22 / loop-095
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/persistence/controller.ts`, `frontend/src/persistence/controller.test.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `PLANS.md`
- What changed: Executed the Chat 3 frontend reorder-adoption slice so drag flow now sends reorder intent (`target insert index`) from `WorkspaceShell` instead of trying to materialize a full final order payload at the route level. In `WorkspacePersistenceController.moveNode`, added an authenticated+linked path that treats reorder as intent: only the moved subtree nodes are upserted with order hints, local state is updated immediately for UX continuity, and an immediate flush is triggered so canonical node ordering comes back from backend sync response. Kept the existing full local normalization path as fallback for guest/local-only mode where no cloud canonical source exists. Added controller regression coverage proving authenticated reorder sends subtree-only node upserts (not whole-episode node upserts).
- Tests run: `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd frontend test -- src/persistence/controller.test.ts src/routes/WorkspaceShell.test.tsx` (outside sandbox due Vite `spawn EPERM` in sandbox); `corepack yarn --cwd frontend run -T eslint src/persistence/controller.ts src/persistence/controller.test.ts`; `corepack yarn --cwd frontend run -T eslint src/persistence/controller.ts src/persistence/controller.test.ts src/routes/WorkspaceShell.tsx` (shows pre-existing `WorkspaceShell.tsx` `react-hooks/set-state-in-effect` errors/warning); `corepack yarn --cwd frontend build` (outside sandbox due Vite `spawn EPERM` in sandbox)
- Result: Reorder ownership is shifted toward intent-driven frontend behavior with backend canonical-order adoption on authenticated cloud sync, while guest/local mode remains stable. Frontend typecheck, targeted lint, unit smoke, and build smoke passed for the changed slice.
- Warnings / blockers: No new blocker from this slice. `WorkspaceShell.tsx` still has the same pre-existing lint findings unrelated to this change.
- Approval needed: `none`

### 2026-04-22 / loop-096
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/persistence/controller.reorder.test.ts`, `backend/src/persistence/routes.reorder.integration.test.ts`, `PLANS.md`
- What changed: Added a dedicated reorder regression suite using only new test files to avoid collisions in existing large suites. The new frontend suite (`controller.reorder.test.ts`) validates major/minor/detail reorder behavior, subtree block move behavior, undo/redo restoration after reorder, and pending queue restoration with reorder replay after restart. The new backend suite (`routes.reorder.integration.test.ts`) validates sparse/duplicate reorder payload canonicalization and stale reorder revision rejection (`stale_node_revision`).
- Tests run: `corepack yarn --cwd frontend test -- src/persistence/controller.reorder.test.ts` (outside sandbox due Vite `spawn EPERM` in sandbox); `corepack yarn --cwd backend run -T vitest run --pool threads src/persistence/routes.reorder.integration.test.ts`; `corepack yarn --cwd frontend run -T eslint src/persistence/controller.reorder.test.ts`; `corepack yarn --cwd backend run -T eslint src/persistence/routes.reorder.integration.test.ts`; `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd backend typecheck`
- Result: Reorder-focused regression coverage is now isolated into separate files and all added tests pass.
- Warnings / blockers: No new blockers identified in this loop.
- Approval needed: `none`

### 2026-04-22 / loop-097
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `NODE_LAYOUT_STABILITY_PLAN.md`, `PLANS.md`
- What changed: Investigated the reported node UI instability beyond the simple overlap hypothesis and split the findings into a new standalone plan document, `NODE_LAYOUT_STABILITY_PLAN.md`. The review identified multiple likely causes in the current frontend flow: no lane reflow after resize/auto-height growth, mismatch between final resolved placement and reorder-index projection, height-unaware fallback node creation placement, major start/end anchor force-placement side effects, and local-only node size state amplifying layout drift. The new document captures these causes, testing gaps, and a staged execution plan that prioritizes frontend layout stability before persistence/DB follow-up.
- Tests run: Read-only code inspection; UTF-8 readback of `NODE_LAYOUT_STABILITY_PLAN.md`; BOM byte check (`EF BB BF`)
- Result: A dedicated UI-layout stability plan now exists separately from the reorder/persistence plan, with clearer prioritization for the currently reported symptom.
- Warnings / blockers: None.
- Approval needed: `none`

### 2026-04-22 / loop-098
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`, `frontend/src/routes/workspace-shell/workspaceShell.layout.test.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Executed the first layout-stability patch from `NODE_LAYOUT_STABILITY_PLAN.md` Track 1/2/3 (frontend-focused). Added a reusable lane packing helper (`applyLaneVerticalReflow`) that pushes same-lane nodes downward by minimum gap after size changes, then wired it into `WorkspaceShell` for `minor`/`detail` placement resolution to reduce post-resize/post-auto-height overlap drift. Updated non-major drag reorder projection to use final resolved placement center Y (instead of raw pointer Y) when computing `targetInsertIndex`. Added layout regression coverage for minor-lane vertical resize to verify the lower node keeps the minimum gap after the upper node grows.
- Tests run: `corepack yarn --cwd frontend test -- src/routes/workspace-shell/workspaceShell.layout.test.ts` (outside sandbox due Vite `spawn EPERM` in sandbox); `C:\windows\System32\WindowsPowerShell\v1.0\powershell.exe -Command corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx` (outside sandbox due Vite `spawn EPERM` in sandbox); `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd frontend run -T eslint src/routes/workspace-shell/workspaceShell.canvas.ts src/routes/workspace-shell/workspaceShell.layout.test.ts src/routes/WorkspaceShell.test.tsx`; `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.tsx src/routes/WorkspaceShell.test.tsx src/routes/workspace-shell/workspaceShell.canvas.ts src/routes/workspace-shell/workspaceShell.layout.test.ts` (shows pre-existing `WorkspaceShell.tsx` `react-hooks/set-state-in-effect` findings); `corepack yarn --cwd frontend build` (outside sandbox due Vite `spawn EPERM` in sandbox)
- Result: Frontend layout-stability slice landed with passing route/unit tests (`76/76`), typecheck, targeted lint, and build smoke.
- Warnings / blockers: No new blockers. Direct lint on `WorkspaceShell.tsx` still reports the same pre-existing `react-hooks/set-state-in-effect` issues unrelated to this patch.
- Approval needed: `none`

### 2026-04-22 / loop-099
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`, `frontend/src/routes/workspace-shell/workspaceShell.layout.test.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Applied follow-up fixes requested after loop-098. Reduced lane reflow minimum push gap from `18px` to `8px` so vertical resize/auto-height growth no longer over-separates lower nodes. For major end-marker stability, changed marker selection to use current visual major-node extremes (`topY`/`bottomY`) rather than only ordered IDs, so the visually lowest major node keeps the end marker even when overlap resolution/anchor effects reorder visible bottoms transiently.
- Tests run: `corepack yarn --cwd frontend test -- src/routes/workspace-shell/workspaceShell.layout.test.ts` (outside sandbox due Vite `spawn EPERM` in sandbox); `C:\windows\System32\WindowsPowerShell\v1.0\powershell.exe -Command corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx` (outside sandbox due Vite `spawn EPERM` in sandbox); `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.test.tsx src/routes/workspace-shell/workspaceShell.canvas.ts src/routes/workspace-shell/workspaceShell.layout.test.ts`; `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.tsx` (shows same pre-existing `react-hooks/set-state-in-effect` findings)
- Result: Requested UX follow-up landed: narrower reflow spacing and end-marker assignment now track visible bottom major node; regression suite remains green (`76/76`), and frontend typecheck is green.
- Warnings / blockers: No new blockers. `WorkspaceShell.tsx` still has the same pre-existing effect-rule lint findings unrelated to this loop.
- Approval needed: `none`

### 2026-04-22 / loop-100
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/persistence/controller.ts`, `frontend/src/persistence/controller.test.ts`, `PLANS.md`
- What changed: Executed the remaining `NODE_LAYOUT_STABILITY_PLAN.md` items (Track 4/5/6) in one frontend-oriented loop. Track 4: relaxed major anchor forcing by locking only start-node hard anchor and removing hard end-node anchoring, then added a regression that validates the visually lowest major node keeps the end marker after major resize. Track 5: upgraded `createNode` fallback placement to infer lane height from existing same-level spacing (`inferNodeHeightFromLaneSpacing`) so default placement no longer relies only on fixed `nodeVerticalSpacing`. Track 6: added persistence follow-up in `createNode` so authenticated cloud-linked creates with explicit UI placement trigger immediate flush (`await flushNow`) to adopt canonical cloud state quickly; added controller regression coverage for inferred fallback Y and immediate cloud sync on placed create.
- Tests run: `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx src/persistence/controller.test.ts src/persistence/controller.reorder.test.ts src/routes/workspace-shell/workspaceShell.layout.test.ts` (outside sandbox due Vite `spawn EPERM` in sandbox); `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd frontend run -T eslint src/persistence/controller.ts src/persistence/controller.test.ts src/routes/WorkspaceShell.test.tsx src/routes/workspace-shell/workspaceShell.canvas.ts src/routes/workspace-shell/workspaceShell.layout.test.ts`; `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.tsx` (shows same pre-existing `react-hooks/set-state-in-effect` findings); `corepack yarn --cwd frontend build` (outside sandbox due Vite `spawn EPERM` in sandbox)
- Result: Track 4/5/6 slice landed with updated major-anchor behavior, height-aware fallback placement, and create-time canonical sync adoption; route/controller/layout regressions are green (`79/79`), typecheck is green, and build smoke is green.
- Warnings / blockers: No new blockers. `WorkspaceShell.tsx` direct lint still reports the same pre-existing `react-hooks/set-state-in-effect` findings unrelated to this loop.
- Approval needed: `none`

### 2026-04-22 / loop-101
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`, `frontend/src/routes/workspace-shell/workspaceShell.layout.test.ts`, `PLANS.md`
- What changed: Addressed the remaining “order flips while resizing” symptom by changing lane vertical reflow to preserve the provided lane node order (`nodeIds`) instead of re-sorting by current Y position. This keeps resize-driven reflow from reinterpreting visual Y as authoritative ordering and prevents perceived reorder during size adjustments. Added a focused regression test that starts with out-of-order Y coordinates and verifies reflow keeps structural lane order while enforcing minimum gap.
- Tests run: `corepack yarn --cwd frontend test -- src/routes/workspace-shell/workspaceShell.layout.test.ts src/routes/WorkspaceShell.test.tsx` (outside sandbox due Vite `spawn EPERM` in sandbox); `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd frontend run -T eslint src/routes/workspace-shell/workspaceShell.canvas.ts src/routes/workspace-shell/workspaceShell.layout.test.ts`
- Result: Resize-time lane reflow now preserves lane order semantics and the expanded frontend regression suite is green (`80/80`) with typecheck/lint passing for changed files.
- Warnings / blockers: No new blockers identified in this loop.
- Approval needed: `none`

### 2026-04-22 / loop-103
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Executed `CANVAS_MAJOR_LANE_PLAN.md` stabilization slice for major-lane interactions. Added timeline-end follower semantics so timeline-end drag now tracks a concrete end-major node identity and updates that node’s preview/commit placement alongside rail end updates. During timeline-end drag, end-marker identity is pinned to the active follower for consistent handle/marker/node semantics. Updated major drag commit to use one placement basis for both `updateNodePlacement(...)` and `moveNode(...)` reorder index projection. Added regressions for (1) timeline-end drag moving end major node together, (2) non-end major drag not hijacking end semantics, and (3) preview/commit alignment for major drag.
- Tests run: `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx`; `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.tsx src/routes/WorkspaceShell.test.tsx` (shows same pre-existing `WorkspaceShell.tsx` `react-hooks/set-state-in-effect` findings); `corepack yarn --cwd frontend build` (outside sandbox due Vite `spawn EPERM` in sandbox)
- Result: Major-lane handle/marker/follower semantics are now aligned and route regressions are green (`83/83`) with typecheck/build passing.
- Warnings / blockers: No new blocker from this slice. Direct lint on `WorkspaceShell.tsx` still reports the same pre-existing `react-hooks/set-state-in-effect` issues unrelated to this loop.
- Approval needed: `none`

### 2026-04-22 / loop-102
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `CANVAS_MAJOR_LANE_PLAN.md`, `PLANS.md`
- What changed: Investigated the newly reported `Major Event Lane` interaction issues and separated them from the earlier generic layout/reorder work. Confirmed that current frontend tests and typecheck are green, but the existing suite does not cover timeline-end handle drag semantics. Read the current `WorkspaceShell` implementation and identified the most likely fault line: the timeline-end handle only mutates `timelineEndY`, while the visually lowest/end major-node identity, major drag commit, and reorder projection still use partially different semantics. Captured the recommended response in a new standalone plan document, `CANVAS_MAJOR_LANE_PLAN.md`, with staged tracks for regression coverage, end-node identity unification, handle drag/node-follow behavior, and final-placement reorder alignment.
- Tests run: `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx`
- Result: Current regression suite stays green (`80/80`), but there is now a focused execution plan for the uncovered major-lane/timeline-end behavior gap.
- Warnings / blockers: No immediate blocker, but concurrent chats have recently touched the same `WorkspaceShell` files, so same-file work should be treated as effectively single-writer before implementation.
- Approval needed: `none`

### 2026-04-22 / loop-104
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Applied the requested major-lane follow-up patch (Track 5) to clarify authority between free move and reorder. Added a major-lane minimal vertical reflow pass that preserves structural order and minimum gap while keeping start-major locked, so major free-move/reorder no longer leaves visually inverted/overlapping lane order. Added regression coverage that performs a major reorder and asserts visual top-to-bottom order stays aligned with structural node order and gap rules.
- Tests run: `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx`; `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.test.tsx`; `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.tsx` (shows same pre-existing `react-hooks/set-state-in-effect` findings); `corepack yarn --cwd frontend build` (outside sandbox due Vite `spawn EPERM` in sandbox)
- Result: Major lane now uses a clearer “order-first + minimum-gap” stabilization rule after reorder/free-move flows, and route regressions are green (`84/84`) with typecheck/build passing.
- Warnings / blockers: No new blocker from this slice. Direct lint on `WorkspaceShell.tsx` still reports the same pre-existing `react-hooks/set-state-in-effect` issues unrelated to this loop.
- Approval needed: `none`

### 2026-04-22 / loop-103
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `WORKSPACE_SHELL_REFACTOR_PLAN.md`, `PLANS.md`
- What changed: Reviewed `frontend/src/routes/WorkspaceShell.tsx` specifically as a maintainability/refactor concern and created a dedicated execution plan document, `WORKSPACE_SHELL_REFACTOR_PLAN.md`. Captured the current complexity baseline (line count, state/effect/ref/function density), explained why the problem is responsibility concentration rather than mere file length, and proposed a staged decomposition: subtree extraction first, then episode-canvas state isolation, then canvas-interaction hook extraction, followed by route-shell slimming and test splitting. Also recorded the concurrency constraint that active major-lane fixes and large refactors should be treated as effectively single-writer on `WorkspaceShell.tsx`.
- Tests run: Read-only code inspection only
- Result: A standalone refactor plan now exists for `WorkspaceShell.tsx`, separate from the ongoing bug-fix plans, with sequencing and stop conditions defined.
- Warnings / blockers: No immediate blocker. Implementation should avoid colliding with active same-file bug work in `WorkspaceShell.tsx`.
- Approval needed: `none`

### 2026-04-22 / loop-104
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `PLANS.md`
- What changed: Investigated the newly reported major-node swap issue (taller node replacing a shorter end node) and attempted to lock reproduction through the frontend route suite. Stopped before implementation because the current worktree contains an overlapping `WorkspaceShell` refactor in progress: `frontend/src/routes/WorkspaceShell.tsx` now imports `./workspace-shell/WorkspaceSidebarRecents`, but that file is not present in the workspace, so the route suite fails during module resolution before the targeted regression can run. Removed the temporary reproduction edit and left the code unchanged.
- Tests run: `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx` (fails during Vite import resolution: missing `frontend/src/routes/workspace-shell/WorkspaceSidebarRecents.tsx`)
- Result: No functional fix applied in this loop because the current same-file refactor conflict blocks reliable repro/validation.
- Warnings / blockers: Direct same-file conflict in `WorkspaceShell.tsx` due concurrent refactor work. Safe next step is to either finish/merge that refactor first or move this bugfix onto a clean worktree state.
- Approval needed: `none`

### 2026-04-22 / loop-105
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.sidebar.tsx`, `frontend/src/routes/workspace-shell/WorkspaceSidebarRecents.tsx`, `PLANS.md`
- What changed: Started `WORKSPACE_SHELL_REFACTOR_PLAN.md` execution with a low-risk Track 2 slice focused on sidebar responsibility extraction. Moved sidebar episode visibility/sorting derivation (`folderIdByEpisodeId`, root episode list, visible folder list) out of `WorkspaceShell` into `workspaceShell.sidebar.tsx` via reusable helpers (`buildSidebarEpisodeCollections`, `sortEpisodesForScope`, `getScopedPinnedEpisodes`). Added a dedicated sidebar-recents presentational component (`WorkspaceSidebarRecents`) and replaced the inlined recent-stories JSX subtree in `WorkspaceShell` with the new component. Kept state ownership and sidebar action handlers in `WorkspaceShell` to avoid behavior changes in this step.
- Tests run: `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx`; `corepack yarn --cwd frontend run -T eslint src/routes/workspace-shell/workspaceShell.sidebar.tsx src/routes/workspace-shell/WorkspaceSidebarRecents.tsx`; `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.tsx` (shows same pre-existing `react-hooks/set-state-in-effect` findings); `corepack yarn --cwd frontend build` (outside sandbox due Vite `spawn EPERM` in sandbox)
- Result: Sidebar derivation/render responsibilities are partially separated while route behavior remains stable (`84/84` tests green), and typecheck/build are green.
- Warnings / blockers: No new blockers. Direct lint on `WorkspaceShell.tsx` still reports the same pre-existing `react-hooks/set-state-in-effect` issues unrelated to this slice.
- Approval needed: `none`

### 2026-04-22 / loop-106
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/WorkspaceObjectPanel.tsx`, `PLANS.md`
- What changed: Continued `WORKSPACE_SHELL_REFACTOR_PLAN.md` Track 2 by extracting the right-side object/detail editor subtree into a dedicated component (`WorkspaceObjectPanel`). Moved object detail/create form JSX and related category rendering dependencies out of `WorkspaceShell`, and replaced the previous inline `detailPanel` block with a prop-driven component invocation. Kept state ownership (`detailMode`, `objectEditorDraft`, selection, save handlers) in `WorkspaceShell` for behavior-preserving incremental refactor.
- Tests run: `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx`; `corepack yarn --cwd frontend run -T eslint src/routes/workspace-shell/WorkspaceObjectPanel.tsx src/routes/WorkspaceShell.tsx` (shows same pre-existing `WorkspaceShell.tsx` `react-hooks/set-state-in-effect` findings); `corepack yarn --cwd frontend build` (outside sandbox due Vite `spawn EPERM` in sandbox)
- Result: Object/detail panel rendering responsibility is now separated from `WorkspaceShell` while route behavior remains stable (`84/84` tests green), and typecheck/build are green.
- Warnings / blockers: No new blockers. Direct lint on `WorkspaceShell.tsx` still reports the same pre-existing `react-hooks/set-state-in-effect` issues unrelated to this slice.
- Approval needed: `none`

### 2026-04-22 / loop-107
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `MAJOR_LANE_SWAP_PLAN.md`, `PLANS.md`
- What changed: Captured a rough follow-up plan for the newly reported "tall major node swapping with shorter end node" symptom in a dedicated note, `MAJOR_LANE_SWAP_PLAN.md`. The note records the likely fault line (major reorder threshold vs premature timeline-end extension), the intended fix direction, and a minimal future work sequence so the issue can be resumed after the in-progress `WorkspaceShell` refactor stabilizes.
- Tests run: none (doc-only update)
- Result: A lightweight handoff note now exists for the swap/timeline-extension bug without touching active implementation files.
- Warnings / blockers: Same-file implementation risk remains in `WorkspaceShell.tsx`; defer code changes until the ongoing refactor slice is settled.
- Approval needed: `none`

### 2026-04-22 / loop-108
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Consolidated the current detailed planning notes into a single root document, `DETAILPLAN.md`, so future execution detail can live under one file rather than being split across many standalone plan docs. The new file currently carries the `WorkspaceShell` refactor plan and the major-lane swap note, plus a short operating convention for how detailed plans should be appended going forward.
- Tests run: none (doc-only update)
- Result: There is now a single detailed-plan document for ongoing work, while `PLANS.md` remains the lightweight work-loop log.
- Warnings / blockers: Existing standalone detailed plan files were left in place for now to avoid breaking any active references from concurrent chats. They can be retired later once the team is fully using `DETAILPLAN.md`.
- Approval needed: `none`

### 2026-04-22 / loop-109
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Added stable section IDs to `DETAILPLAN.md` so detailed plans can be referenced similarly to `PLANS.md` loop entries. The current sections are now indexed as `detail-001` and `detail-002`, and the operating convention at the top of the file now specifies that future detailed plans should continue with the next `detail-xxx` identifier.
- Tests run: none (doc-only update)
- Result: `DETAILPLAN.md` now has explicit, incrementing plan identifiers instead of only topic-based section ordering.
- Warnings / blockers: None.
- Approval needed: `none`

### 2026-04-22 / loop-110
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/CanvasNodeCard.tsx`, `frontend/src/routes/workspace-shell/WorkspaceSidebarRecents.tsx`, `PLANS.md`
- What changed: Continued `WORKSPACE_SHELL_REFACTOR_PLAN.md` Track 2 by extracting the large canvas node-card rendering subtree from `WorkspaceShell` into a dedicated `CanvasNodeCard` component. Moved node card header/body, inline editor keyboard/token handling, resize handles, and keyword cloud panel rendering into the new component while keeping state ownership and core action handlers in `WorkspaceShell`. While stabilizing this slice, corrected broken package import aliases (`@scenario/*` -> `@scenaairo/*`) in touched route files so typecheck resolves shared/recommendation types correctly.
- Tests run: `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd frontend run -T eslint src/routes/workspace-shell/CanvasNodeCard.tsx src/routes/workspace-shell/WorkspaceSidebarRecents.tsx src/routes/WorkspaceShell.tsx` (shows same pre-existing `WorkspaceShell.tsx` `react-hooks/set-state-in-effect` findings); `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx`; `corepack yarn --cwd frontend build` (outside sandbox due Vite `spawn EPERM` in sandbox)
- Result: Node-card JSX and its inline editor/keyword panel render logic are now separated into `CanvasNodeCard.tsx`, route regression tests remain green (`84/84`), and typecheck/build are green.
- Warnings / blockers: No new blockers from this slice. Direct lint on `WorkspaceShell.tsx` still reports the same pre-existing `react-hooks/set-state-in-effect` findings unrelated to this loop.
- Approval needed: `none`

### 2026-04-22 / loop-111
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/useEpisodeCanvasState.ts`, `PLANS.md`
- What changed: Started `WORKSPACE_SHELL_REFACTOR_PLAN.md` Track 3 by extracting episode-canvas history restore/undo/redo logic into a dedicated hook (`useEpisodeCanvasState`). Moved lane-divider/timeline/node-size canvas UI state ownership plus snapshot-history restore wrappers (`runUndo`/`runRedo`) out of `WorkspaceShell`, while keeping node-size localStorage load/save effects in `WorkspaceShell` to avoid introducing a new lint category in the new hook file.
- Tests run: `corepack yarn --cwd frontend typecheck`; `corepack yarn --cwd frontend run -T eslint src/routes/workspace-shell/useEpisodeCanvasState.ts src/routes/workspace-shell/CanvasNodeCard.tsx src/routes/workspace-shell/WorkspaceSidebarRecents.tsx src/routes/workspace-shell/WorkspaceObjectPanel.tsx src/routes/workspace-shell/workspaceShell.sidebar.tsx`; `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.tsx` (shows same pre-existing `WorkspaceShell.tsx` `react-hooks/set-state-in-effect` findings); `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx src/routes/workspace-shell/workspaceShell.layout.test.ts` (outside sandbox due Vite `spawn EPERM` in sandbox); `corepack yarn --cwd frontend build` (outside sandbox due Vite `spawn EPERM` in sandbox)
- Result: Canvas state/history orchestration is now split into `useEpisodeCanvasState.ts`, with route/layout regressions still green (`84/84`), and typecheck/build smoke green.
- Warnings / blockers: No new blocker from this slice. `WorkspaceShell.tsx` direct lint still reports the same pre-existing effect-rule findings; one existing `react-hooks/exhaustive-deps` warning remains in that file.
- Approval needed: `none`
