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

### 2026-04-22 / loop-112
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Implemented `detail-002` frontend fix for tall major-node-to-end-node swap behavior by making major insert-indexing size-aware and applying one consistent insert target path for drag preview/commit. Timeline-end growth is now limited during major drag to cases where the dragged major is already the end node or projects as the end position after ordering.
- Tests run: not run (not requested).
- Result: A regression path now exists for "tall middle major below end major" reorder, with timeline end and end-marker alignment checks included in `WorkspaceShell.test.tsx`.
- Warnings / blockers: Same-file change risk remains on `WorkspaceShell.tsx`; behavior should be validated by regression tests before release.
- Approval needed: `none`

### 2026-04-22 / loop-113
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Investigated the newly reported follow-up regressions after the unvalidated `detail-002` major-drag change. Confirmed by running the route suite that two existing major-lane tests now fail: `keeps timeline end stable when dragging a non-end major node` and `allows dragging a lower major node above the first major node`. Read the current preview/commit code path and added a new detailed plan section, `detail-003`, covering the likely fault line: major drag preview is still coupled to timeline-end anchors for non-end nodes, and commit-time `timelineEndY` recalculation mixes pre-reorder and post-reorder reasoning, which can make the last node appear to follow and keep over-extending the arrow during swaps.
- Tests run: `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx` (fails: 2 major-lane regressions)
- Result: The new symptoms are now captured as a concrete follow-up plan with failing test references, rather than only as anecdotal UI behavior.
- Warnings / blockers: The current `detail-002` implementation was not validated when landed and is now known to regress existing route behavior. Any follow-up fix should treat `WorkspaceShell.tsx` as effectively single-writer.
- Approval needed: `none`

### 2026-04-22 / loop-114
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `PLANS.md`
- What changed: Continued `detail-003` by narrowing major drag end-candidate coupling. Non-end major drag now only uses bottom-based insert/timeline-end logic when the dragged card is actually near/at the timeline end, while normal upward/reorder moves keep center-based index behavior to avoid unnecessary end extension and anchor drift.
- Tests run: not run (not requested)
- Result: `WorkspaceShell.tsx` preview/commit major-drag insert calculations now share the same end-candidate gating path, so non-end major moves upward should no longer be forced by timeline-end logic.
- Warnings / blockers: Regression tests were not rerun in this step, so the two `detail-003`-relevant failures should be revalidated in the next run.
- Approval needed: `none`

### 2026-04-22 / loop-115
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Reviewed the current node-connection geometry after the user requested right-side/left-side anchors. Confirmed by code inspection that both committed connection paths (`buildConnectionLines`) and rewire preview lines still use node center points for start/end coordinates, and that the rendered `connection-port` buttons are positioned from those same center-based anchors. Added a new detailed plan section, `detail-004`, to capture the required change: move connection and preview anchors to source right-center / target left-center, and keep port positions aligned with that rule.
- Tests run: Read-only code inspection only
- Result: The connection-anchor mismatch is now explicitly documented as a separate follow-up plan instead of being folded into the drag/timeline work.
- Warnings / blockers: Geometry changes will touch both `workspaceShell.canvas.ts` and `WorkspaceShell.tsx`, so it should still be coordinated with ongoing same-file interaction work.
- Approval needed: `none`

### 2026-04-22 / loop-116
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Investigated the newly reported “rewire looks applied, but moving the node restores the old connection” symptom. Confirmed by code inspection that `WorkspacePersistenceController.rewireNode(...)` only updates `parentId`, while subsequent `moveNode(...)` calls always re-infer the root node parent via `inferParentId(...)` and can therefore overwrite the explicit rewire result on the next drag/reorder. Added a new detailed plan section, `detail-005`, to capture this as a separate persistence/interaction bug with dedicated controller+route regression coverage and a follow-up strategy to separate parent rewiring authority from reorder authority.
- Tests run: Read-only code inspection only
- Result: The rewire-reset symptom is now explained by a concrete code path and recorded as a standalone follow-up plan.
- Warnings / blockers: Fixing this will likely touch both `frontend/src/persistence/controller.ts` and `frontend/src/routes/WorkspaceShell.tsx`, so it should be coordinated with ongoing drag/reorder work to avoid overlapping same-file conflicts.
- Approval needed: `none`

### 2026-04-22 / loop-117
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Investigated the reported “looks right until refresh, then feels rearranged” behavior by reading both frontend restore flow and backend canonicalization. Confirmed that authenticated refresh first restores local snapshot, then replaces state with remote canonical snapshot via `connectAuthenticatedSession(...)`, and only after that replays pending sync. Also confirmed that backend reload paths canonicalize node order per episode, while the frontend renders from a recomputed layout that combines persisted snapshot fields with UI-only state such as `nodeSizes` and canvas history/timeline state. Added a new detailed plan section, `detail-006`, that explicitly separates frontend-owned fixes from backend/shared-contract decisions and frames the central question: whether exact canvas presentation should be canonical across refresh or only structure should be canonical.
- Tests run: Read-only code inspection only
- Result: The refresh-time re-layout symptom is now documented with a clear frontend/backend responsibility split and an implementation sequence.
- Warnings / blockers: A definitive fix depends on a product-level decision about whether exact canvas UI state must survive refresh as canonical data, or whether deterministic re-layout from structure is acceptable.
- Approval needed: `none`

### 2026-04-22 / loop-117
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/persistence/controller.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`, `frontend/src/persistence/controller.test.ts`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Applied `detail-004` and `detail-005` front-end follow-up updates:
  - changed committed connection anchor geometry to parent right-center → child left-center in `buildConnectionLines`
  - updated rewire preview anchors to match side-based connection geometry when a hover target exists
  - added `{ preserveParent }` option to `moveNode` and set route drag commit calls to preserve explicit rewire parents
  - added a controller regression for preserved parent after rewire+move and aligned existing minor port assertion to left-anchor geometry.
- Tests run: not run (not requested)
- Result: The two requested details are now implemented in code and reflected in targeted assertions.
- Warnings / blockers: Existing default `moveNode` behavior is preserved; only callers that pass `preserveParent: true` bypass inferred parent reassignment.
- Approval needed: `none`

### 2026-04-22 / loop-118
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/useEpisodeCanvasState.ts`, `frontend/src/routes/workspace-shell/workspaceShell.storage.ts`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Completed the frontend-only slice for `detail-006` by consolidating episode-canvas UI persistence into `useEpisodeCanvasState` (lane dividers, timeline end, and node sizes), wiring the hook with `storagePrefix`, and removing duplicated node-size localStorage effects from `WorkspaceShell`. Added a route-level reload regression that verifies node resize, timeline end, and divider UI state persists after remount.
- Tests run: not run (not requested).
- Result: `detail-006` frontend ownership now includes state persistence restoration/order and regression coverage for reload-based layout continuity.
- Warnings / blockers: Existing broader refresh semantics in authenticated remote canonical restore remain unchanged; this step intentionally avoids backend/shared-contract changes.
- Approval needed: `none`
### 2026-04-22 / loop-119
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: backend/src/persistence/, PLANS.md
- What changed: Implemented backend-side detail-006 follow-up focused on canonical restore boundaries. Added an explicit unit regression test (node-order.test.ts) that verifies episode-level canonicalization only rewrites orderIndex while preserving node layout/visual fields such as canvasX, canvasY, isCollapsed, isFixed, isImportant, keywords, objectIds, parentId, and timestamps. Added a persistence routes integration regression that imports anchored node layout values, applies sparse duplicate orderIndex sync updates that trigger canonical reindexing, and verifies order reindexing happens without resetting canvas/visual fields. Also annotated both file-backed and mysql-backed normalizeSnapshot paths with the same contract comment that canonicalization must not mutate layout/visual fields.
- Tests run: yarn workspace @scenaairo/backend typecheck; yarn workspace @scenaairo/backend test (outside sandbox after spawn EPERM); yarn workspace @scenaairo/backend integration (outside sandbox after spawn EPERM)
- Result: Backend canonicalization behavior is now covered by direct regressions proving layout/visual field preservation during order canonicalization, and backend typecheck/unit/integration gates are green.
- Warnings / blockers: none
- Approval needed: none

### 2026-04-22 / loop-120
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `backend/src/persistence/mysql-store.ts`, `backend/mysql/init/001_create_cloud_projects.sql`, `backend/LOCAL_MYSQL.md`, root workspace lock/install state, `PLANS.md`
- What changed: Reworked MySQL persistence from single `cloud_projects(snapshot_json)` storage into normalized domain tables while preserving backward compatibility. Added/managed schema for `cloud_projects`, `cloud_episodes`, `cloud_objects`, `cloud_nodes`, `cloud_node_keywords`, `cloud_node_object_links`, and `cloud_temporary_drawer`; updated `MySqlBackedPersistenceStore` to read/write these tables as the primary runtime path; retained `linkage_json`/`snapshot_json` writes as legacy fallback so existing data can still be restored. Also aligned MySQL sync semantics with file-backed behavior for object/episode dependency checks and episode-delete object cleanup, and documented the normalized table usage in `LOCAL_MYSQL.md`.
- Tests run: `yarn workspace @scenaairo/backend typecheck`; `yarn workspace @scenaairo/backend lint`; `yarn workspace @scenaairo/backend integration`; `yarn workspace @scenaairo/backend test` (outside sandbox after spawn EPERM); `yarn workspace @scenaairo/shared build`; `yarn install --mode=skip-build` (outside sandbox after cache EPERM); `yarn workspace @scenaairo/backend build`
- Result: Backend now persists project/episode/object/node/drawer data into real MySQL relational tables instead of only JSON snapshot blobs, with backend validation/build gates passing after workspace relink refresh.
- Warnings / blockers: `yarn install` emitted an existing peer warning (`@scenaairo/backend` not providing `@types/node` for `mysql2`) but did not block install/build.
- Approval needed: `none`

### 2026-04-22 / loop-121
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Investigated the newly reported intermittent mismatch where the Major Event Lane main arrow end no longer lines up with the visually last major node bottom. Re-read the current `WorkspaceShell.tsx` major-lane render and commit paths, and confirmed a likely frontend-owned drift source: the end-handle renders from `effectiveTimelineEndY = max(timelineEndY, lowestNodeBottom)`, while `timelineEndY` is separately persisted as episode canvas UI state and major drag commit only recomputes it in some end-node cases. Added `detail-007` to `DETAILPLAN.md` to capture the likely cause, explicit frontend/backend ownership, and a follow-up sequence.
- Tests run: `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx` (fails before execution due current `WorkspaceShell.test.tsx` parse error near line 1270); read-only code inspection on `frontend/src/routes/WorkspaceShell.tsx` and `frontend/src/routes/workspace-shell/useEpisodeCanvasState.ts`
- Result: The intermittent arrow-end drift is now documented as a separate detailed plan item with concrete code-path evidence and a frontend-first fix direction.
- Warnings / blockers: Route regression validation is currently blocked by a syntax error already present in `WorkspaceShell.test.tsx`, so behavior confirmation must rely on code inspection until that test file is repaired.
- Approval needed: `none`

### 2026-04-23 / loop-125
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Investigated the newly reported symptom where, after changing node order, moving one node makes another reordered node move with it. Re-read the current layout pipeline and confirmed a likely frontend-owned cause: after every placement pass, `WorkspaceShell.tsx` reapplies `applyLaneVerticalReflow(...)` to the full visible node list for each lane using structural node order, and the helper intentionally preserves the provided lane order while pushing later nodes down to satisfy minimum gaps. Added `detail-008` to `DETAILPLAN.md` to capture this as a lane-reflow coupling issue with explicit frontend/backend ownership and a follow-up sequence.
- Tests run: `corepack yarn --cwd frontend test -- src/routes/workspace-shell/workspaceShell.layout.test.ts` (sandbox `spawn EPERM`, rerun outside sandbox, then blocked by existing `WorkspaceShell.test.tsx` parse error near line 1270 because the current Vitest config still loads the broken route suite); read-only code inspection on `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`, and `frontend/src/routes/workspace-shell/workspaceShell.layout.test.ts`
- Result: The “other node moves together after reorder” symptom is now traced to a concrete render-time reflow path rather than backend persistence, and documented as a separate detailed plan item.
- Warnings / blockers: Automated frontend regression confirmation remains blocked by the existing `WorkspaceShell.test.tsx` syntax error, so the current conclusion is based on code-path inspection plus existing helper-test intent.
- Approval needed: `none`

### 2026-04-23 / loop-126
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Investigated the user's request to standardize local frontend/backend-related code paths to port `3001`. Confirmed the current drift is limited to three code defaults: backend `PORT` fallback in `backend/src/config/env.ts`, frontend dev proxy fallback in `frontend/vite.config.ts`, and frontend dist proxy fallback in `frontend/scripts/serve-dist.mjs`, all currently set to `3202`, while older runtime verification and Playwright readiness already assume `3001`. Added `detail-009` to `DETAILPLAN.md` to frame this as a backend-target port standardization task, explicitly noting that frontend and backend cannot both directly listen on `3001` at the same time.
- Tests run: read-only code inspection via ripgrep and config reads
- Result: The port-migration request is now captured as a concrete follow-up plan with frontend/backend/tooling ownership and a smoke-verification sequence.
- Warnings / blockers: The requested wording can be misleading; implementation should interpret it as “standardize the backend-facing default port to 3001” while keeping the frontend UI server on its own port such as `5173`.
- Approval needed: `none`

### 2026-04-23 / loop-127
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Investigated the user's idea of connecting a GPT LLM API “from shared” to generate recommendation keywords. Re-read the current shared/recommendation/backend boundaries and confirmed that the repository's current shape does not support placing provider integration inside `shared`: `shared` is reserved for cross-boundary types/contracts, while `recommendation` explicitly owns provider integration and orchestration. Also checked current recommendation wiring and found `loadRecommendationEnv()` exists but is not yet connected to backend route registration. Added `detail-010` to `DETAILPLAN.md` with a recommended architecture: keep actual OpenAI/Responses API integration in `recommendation/provider`, optionally move shared recommendation schemas into `shared`, and wire provider selection/env through the backend.
- Tests run: read-only code inspection on `shared/*`, `recommendation/*`, and `backend/src/recommendation/routes.ts`; official OpenAI docs lookup for Responses API, JavaScript SDK, and Structured Outputs
- Result: The GPT keyword-integration request is now framed as a boundary-aware implementation plan rather than a direct “put OpenAI in shared” task.
- Warnings / blockers: If implementation touches shared contracts/types, it becomes a cross-boundary change and should be treated carefully; the current docs make `recommendation` the correct home for provider logic.
- Approval needed: `none`

### 2026-04-23 / loop-128
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `PLANS.md`
- What changed: Re-checked the current recommendation runtime wiring after the user asked whether the new OpenAI path actually reads env. Confirmed that backend runtime now does read `process.env` for `RECOMMENDATION_PROVIDER`, `RECOMMENDATION_MODEL`, `RECOMMENDATION_FALLBACK_TO_HEURISTIC_ON_ERROR`, `OPENAI_API_KEY`, and `RECOMMENDATION_API_KEY`, and passes those values into `createRecommendationProvider(...)`. Also confirmed an important caveat: the repo does not currently load `.env` files automatically via `dotenv` or equivalent, and the launcher/dev scripts simply forward the existing process environment. So values written only into package-local `.env` files will not affect runtime unless the shell or launcher explicitly exports them first.
- Tests run: read-only code inspection on `backend/src/app.ts`, `backend/src/recommendation/routes.ts`, `recommendation/src/provider/factory.ts`, `recommendation/src/config/env.ts`, and launcher/dev scripts
- Result: The recommendation env path is now understood as “runtime env-driven, but not file-backed `.env` auto-loading.”
- Warnings / blockers: Current runtime defaults are still slightly inconsistent (`backend` default model string differs from the recommendation env helper), and env helper usage remains split between direct `process.env` reads and the unused `loadRecommendationEnv()` helper.
- Approval needed: `none`

### 2026-04-23 / loop-130
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Added a dedicated follow-up plan for recommendation runtime env cleanup after the user explicitly asked for it. `detail-011` now captures the remaining gap after detail-010 implementation: recommendation runtime currently reads env values, but `.env` files are not auto-loaded, backend still partially reads `process.env` directly, and source-of-truth ownership between backend runtime and recommendation env helper is still split. The new plan defines a single-parser direction (`loadRecommendationEnv()`), a backend-owned runtime env location, `.env` support decision points, default/model/provider alignment, and test gates.
- Tests run: none (plan/documentation only)
- Result: The env/runtime cleanup is now separated from the earlier provider-implementation work and can be tracked as its own execution item.
- Warnings / blockers: Existing loop numbers in `PLANS.md` have concurrent-chat duplication; this entry is routine log-only and does not resolve the broader numbering conflict.
- Approval needed: `none`

### 2026-04-23 / loop-131
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `recommendation/.env.example`, `ENVIRONMENT.md`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Aligned runtime env ownership with the backend-only direction by removing the leftover `recommendation/.env.example` sample and updating docs to treat `backend/.env.example` as the sole canonical runtime example. Also tightened the `detail-011` wording so docs/sample guidance now explicitly points to backend-side env standardization only.
- Tests run: read-only verification of remaining env-example references
- Result: Recommendation-side env samples are no longer presented as a parallel runtime path, reducing confusion about where OpenAI/recommendation provider values should live.
- Warnings / blockers: Historical references remain in past `PLANS.md` logs by design; they are execution history, not current guidance.
- Approval needed: `none`

### 2026-04-22 / loop-122
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `backend/src/persistence/mysql-store.ts`, `backend/mysql/init/001_create_cloud_projects.sql`, `backend/LOCAL_MYSQL.md`, `PLANS.md`
- What changed: Fixed MySQL schema bootstrap compatibility so normalized persistence tables can be created reliably in local DB. Replaced unsupported `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` usage with an information-schema based backfill helper (`ensureCloudProjectsBackfillColumns`). Added `cloud_accounts` table for future account/auth metadata (Google sign-in ready shape), plus `ensureCloudAccountShell` upsert on import/sync write paths so account rows are materialized lazily. While validating against a real MySQL instance, found and fixed an existing FK DDL bug (`cloud_temporary_drawer_source_node` could not use `ON DELETE SET NULL` with non-null composite key columns); changed to `ON DELETE RESTRICT` in both runtime schema and SQL init file.
- Tests run: `yarn workspace @scenaairo/backend typecheck`; `yarn workspace @scenaairo/backend test -- src/persistence/routes.integration.test.ts` (outside sandbox due `spawn EPERM` in sandbox); local MySQL schema apply verification via `backend/mysql/init/001_create_cloud_projects.sql` + `SHOW TABLES LIKE 'cloud_%'` (result: 8 tables)
- Result: Local MySQL now creates all required persistence tables successfully (`cloud_accounts`, `cloud_projects`, `cloud_episodes`, `cloud_objects`, `cloud_nodes`, `cloud_node_keywords`, `cloud_node_object_links`, `cloud_temporary_drawer`), and backend persistence integration regression remains green.
- Warnings / blockers: Existing worktree has unrelated modified files from parallel loops; this loop intentionally scoped changes to backend persistence/MySQL bootstrap only.
- Approval needed: `none`

### 2026-04-22 / loop-122
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Completed the frontend follow-up for `detail-007` by normalizing timeline end updates on every major drag commit path (`getResolvedTimelineEndY`) and adding a route regression that verifies dragging the prior end major node upward no longer leaves an oversized timeline end marker.
- Tests run: not run (not requested).
- Result: `detail-007` frontend ownership now has a concrete regression that covers the previously stale `timelineEndY` scenario when an end-major node is moved off the bottom.
- Warnings / blockers: Detailed runtime validation for the new test is pending until the user requests test execution, and existing broader suite flakiness around non-deterministic event timing remains unchanged.
- Approval needed: `none`

### 2026-04-23 / loop-123
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `scripts/dev-backend.mjs`, `backend/src/server.ts`, `package.json`, `PLANS.md`
- What changed: Investigated the report that `yarn dev:backend` still fails. Confirmed this environment blocks Node child-process spawn (`spawn EPERM`), which causes `scripts/dev-backend.mjs` fallback mode to fail silently. Also confirmed that direct dist execution path works (`build -> yarn node backend/dist/server.js`) when a free port is used. Improved backend/dev startup diagnostics by printing captured failure output in `dev-backend.mjs` and showing explicit manual compat commands when spawn is blocked. Added explicit server listen failure output in `backend/src/server.ts` so port collisions like `EADDRINUSE` are visible instead of exiting silently. Added root convenience script `dev:backend:compat` for the manual dist startup path.
- Tests run: `yarn workspace @scenaairo/backend build`; `yarn dev:backend` (now prints actionable spawn-block error and compat steps); manual compat validation via `PORT=3003` build+run chain (`yarn workspace @scenaairo/shared build`, `yarn workspace @scenaairo/recommendation build`, `yarn workspace @scenaairo/backend build`, `yarn node backend/dist/server.js`) confirmed long-running backend start.
- Result: Startup failures are now diagnosable from console output, and there is a confirmed working fallback run path even when `yarn dev:backend` cannot spawn child processes in restricted shells.
- Warnings / blockers: Existing background Node processes can still occupy common ports; use a free `PORT` when needed.
- Approval needed: `none`

### 2026-04-23 / loop-124
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `package.json`, `backend/src/server.ts`, `PLANS.md`
- What changed: Resolved the “no response” startup confusion by making backend start visibly acknowledge successful listen and by changing the default root backend dev command to a known working compat path in this shell. Added explicit startup logs in backend server boot (`Backend listening`, `Persistence driver`) and switched root `dev:backend` to `dev:backend:compat`, while preserving the previous watcher entry as `dev:backend:watch`.
- Tests run: `yarn workspace @scenaairo/backend build`; `$env:PORT='3014'; yarn dev:backend` (verified startup output: `Backend listening on http://127.0.0.1:3014`).
- Result: `yarn dev:backend` now gives immediate startup feedback and runs through the compatible path instead of silently failing/appearing unresponsive in restricted shells.
- Warnings / blockers: `dev:backend` now prioritizes reliability over hot-reload watcher behavior; use `yarn dev:backend:watch` only in environments where child-process spawn is allowed.
- Approval needed: `none`

### 2026-04-23 / loop-126
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/vite.config.ts`, `frontend/.env.example`, `backend/.env.example`, `PLANS.md`
- What changed: Implemented the `detail-008` frontend follow-up by narrowing major-lane vertical reflow during major-node drag: all non-active visible major nodes are now excluded from reflow movement via `lockedNodeIds`, reducing lane-wide side-effect shifts after reorder-driven dragging. Also aligned frontend/backend local defaults for the server-port migration by updating Vite proxy fallback target and `.env` samples to `3002`.
- Tests run: not run (not requested).
- Result: `detail-008` coupling risk is mitigated in the render pipeline (major lane reflow no longer shifts unrelated major nodes during active major drag), and port-configuration defaults now consistently target `3002` for local frontend/backend wiring.
- Warnings / blockers: Existing `WorkspaceShell.test.tsx` parser issues from prior loops remain unresolved, so behavior confirmation still relies on inspection of changed paths and targeted helper behavior.
- Approval needed: `none`

### 2026-04-23 / loop-125
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `scripts/dev-backend-compat.mjs`, `package.json`, `PLANS.md`
- What changed: Addressed the “just hangs with no response” UX directly by replacing the silent compat one-liner with a dedicated runner script that prints explicit progress stages (`1/4 shared build`, `2/4 recommendation build`, `3/4 backend build`, `4/4 backend run`) before launching the foreground backend process. Updated both `dev:backend` and `dev:backend:compat` to use this script so users always see deterministic startup progress instead of a blank terminal during build.
- Tests run: `$env:PORT='3018'; yarn dev:backend` (verified staged logs plus final backend listen message).
- Result: Backend startup now provides immediate, continuous console feedback and clearly indicates that the process remains in foreground by design.
- Warnings / blockers: `dev:backend` remains a foreground command; shell prompt does not return until `Ctrl+C` is pressed.
- Approval needed: `none`

### 2026-04-23 / loop-126
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `backend/src/config/env.ts`, `backend/.env.example`, `PLANS.md`
- What changed: Implemented `detail-009` backend scope for local port standardization. Changed backend default listen-port fallback from `3202` to `3001` in `loadBackendEnv()`, and aligned `backend/.env.example` sample `PORT` value from `3002` to `3001`.
- Tests run: `yarn workspace @scenaairo/backend typecheck`; `Remove-Item Env:PORT -ErrorAction SilentlyContinue; yarn dev:backend` (startup log confirms `http://127.0.0.1:3001`); runtime health smoke `GET http://127.0.0.1:3001/api/health` -> `200` with `{ \"status\": \"ok\" }`.
- Result: Backend local default port behavior is now standardized to `3001` in code and sample env, matching detail-009 intent.
- Warnings / blockers: none
- Approval needed: `none`

### 2026-04-23 / loop-127
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `frontend/vite.config.ts`, `frontend/scripts/serve-dist.mjs`, `frontend/.env.example`, `PLANS.md`
- What changed: `detail-009` 요청에 맞춰 프런트엔드 연결 포트를 `3001`로 통일했습니다. `frontend/vite.config.ts`의 `/api` 기본 프록시 타깃, `frontend/scripts/serve-dist.mjs`의 기본 backend 포트 폴백, `frontend/.env.example`의 `SCENAAIRO_BACKEND_PROXY_TARGET` 샘플을 각각 `3001`로 정렬했습니다.
- Tests run: not run (not requested).
- Result: 프런트 dev/배포 정적 경로 모두 동일한 기본 backend target을 사용해 실행 환경별 포트 혼선을 줄였습니다.
- Warnings / blockers: Backend fallback `PORT` 기본값은 아직 별도 작업 구간으로 남아 있어(현재 `3202`), `detail-009`의 백엔드 파트는 미반영 상태입니다.
- Approval needed: `none`

### 2026-04-23 / loop-128
- Active milestone: Post-baseline support task
- Agents engaged: Orchestrator
- Touched zones: `recommendation/src/config/env.ts`, `recommendation/src/index.ts`, `backend/src/app.ts`, `backend/src/config/env.ts`, `backend/src/server.ts`, `backend/.env.example`, `PLANS.md`
- What changed: `detail-011` frontend-only 요청을 넘어 recommendation runtime env source-of-truth 정리로 확장해, `loadRecommendationEnv()`를 backend 설정의 단일 recommendation 파서로 연결했습니다. 기본 provider/mode/key 우선순위/폴백 동작(예: `heuristic` 기본, `OPENAI_API_KEY` 우선) 정합을 backend 경로로 일원화했고, backend/.env 또는 루트 .env 자동 로딩을 추가해 런타임 기대 동작을 정비했습니다.
- Tests run: not run (not requested).
- Result: recommendation runtime 설정은 backend bootstrap에서 한 군데로 모아졌고, backend 실행 시 `.env` 계열 값이 반영되도록 정렬되어 `detail-011` 요구 정합성이 개선되었습니다.
- Warnings / blockers: `.env` 로더는 현재 key-value 단순 파서로 구현해, 따옴표/이스케이프 심화 규칙은 지원하지 않으며, 기존 코드 기준 호환성은 유지됩니다.
- Approval needed: `none`

### 2026-04-23 / loop-128
- Active milestone: Post-baseline support task
- Agents engaged: Recommendation
- Touched zones: `recommendation/package.json`, `recommendation/src/config/env.ts`, `recommendation/src/provider/`, `yarn.lock`, `PLANS.md`
- What changed: Implemented `detail-010` recommendation ownership scope by splitting provider responsibilities into `heuristic.ts`, `openai.ts`, `factory.ts`, and `types.ts`, while keeping `provider/index.ts` as a compatibility re-export surface. Added OpenAI Responses API integration with provider-level structured-output parsing/validation (`label` + `reason` keyword schema), standardized provider-side error codes (`missing_api_key`, `structured_output_invalid`, `recommendation_failed`), and preserved safe rollout behavior through heuristic fallback in the OpenAI path. Extended recommendation env parsing to support `openai|heuristic|stub` plus API key resolution priority (`OPENAI_API_KEY` -> `RECOMMENDATION_API_KEY`). Added recommendation unit tests for factory selection, OpenAI structured parsing, malformed-output fallback, and missing-key handling.
- Tests run: `corepack yarn install --mode=skip-build` (outside sandbox); `corepack yarn workspace @scenaairo/recommendation typecheck`; `corepack yarn exec vitest run --pool threads recommendation/src/orchestration/index.test.ts recommendation/src/provider/factory.test.ts --exclude recommendation/dist/**`; `corepack yarn workspace @scenaairo/recommendation lint`; `corepack yarn workspace @scenaairo/recommendation build`
- Result: `detail-010` recommendation slice is implemented and validated in-package without moving provider implementation into `shared`, preserving current module-boundary policy.
- Warnings / blockers: The default workspace recommendation `test` script still depends on process-spawn behavior that is restricted in this shell (`spawn EPERM`), so verification used a thread-pool vitest command scoped to source tests.
- Approval needed: `none`

### 2026-04-23 / loop-129
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: `backend/src/recommendation/routes.ts`, `PLANS.md`
- What changed: Completed the backend side of `detail-010` error handling by switching recommendation service creation in `registerRecommendationRoutes()` to lazy initialization. This prevents route registration from failing when provider configuration is invalid (for example, unknown provider) and ensures those initialization failures are returned through the existing route-level error mapping (`missing_api_key`/`unsupported_provider` -> 500, `recommendation_failed`/`structured_output_invalid` -> 502).
- Tests run: `corepack yarn install` (outside sandbox, to refresh `file:../recommendation` dependency cache); `corepack yarn workspace @scenaairo/backend integration`; `corepack yarn workspace @scenaairo/backend typecheck`; `corepack yarn workspace @scenaairo/backend test` (outside sandbox); `corepack yarn workspace @scenaairo/backend lint`
- Result: Backend recommendation routes now stay registered and return mapped HTTP errors for provider initialization failures, and backend validation/test commands pass with refreshed workspace dependency resolution.
- Warnings / blockers: none
- Approval needed: `none`

### 2026-04-23 / loop-131
- Active milestone: Post-baseline support task
- Agents engaged: Recommendation, Backend
- Touched zones: `recommendation/src/config/env.ts`, `recommendation/src/config/env.test.ts`, `recommendation/src/index.ts`, `recommendation/src/provider/factory.ts`, `backend/src/app.ts`, `backend/src/recommendation/routes.ts`, `backend/src/recommendation/routes.integration.test.ts`, `backend/.env.example`, `recommendation/.env.example`, `scripts/dev-backend.mjs`, `scripts/dev-backend-compat.mjs`, `scripts/launch-local.ps1`, `scripts/load-env.mjs`, `yarn.lock`, `PLANS.md`
- What changed: Implemented `detail-011` runtime env cleanup by making `loadRecommendationEnv()` the single recommendation parser used by backend bootstrap, extending it to parse provider/model/API key/fallback flag together, and aligning defaults (`heuristic`, `gpt-4.1-mini`, key priority `OPENAI_API_KEY` -> `RECOMMENDATION_API_KEY`). Added backend-owned `.env` loading on runtime entry paths (`dev-backend`, `dev-backend-compat`, `launch-local`) with precedence policy `shell env > backend/.env > root .env` (backend file loaded after root for file-level override). Updated env samples so backend now explicitly documents recommendation runtime keys, and recommendation sample clarifies backend runtime ownership.
- Tests run: `corepack yarn workspace @scenaairo/recommendation typecheck`; `corepack yarn workspace @scenaairo/backend typecheck`; `corepack yarn exec vitest run --pool threads recommendation/src/config/env.test.ts recommendation/src/provider/factory.test.ts recommendation/src/orchestration/index.test.ts --exclude recommendation/dist/**`; `corepack yarn workspace @scenaairo/recommendation build`; `corepack yarn install --mode=skip-build` (outside sandbox, to refresh file workspace hashes); `corepack yarn workspace @scenaairo/backend integration`; `corepack yarn workspace @scenaairo/recommendation lint`; `corepack yarn workspace @scenaairo/backend lint`
- Result: Recommendation runtime env source-of-truth is now centralized and backend-driven, with validated parsing/default behavior and launcher/dev script parity for `.env` usage.
- Warnings / blockers: The repository still contains unrelated in-progress modifications from parallel loops; this loop intentionally did not reconcile those unrelated diffs.
- Approval needed: `none`

### 2026-04-23 / loop-132
- Active milestone: Post-baseline support task
- Agents engaged: Recommendation
- Touched zones: `recommendation/package.json`, `recommendation/.env.example`, `recommendation/src/config/env.ts`, `recommendation/src/config/env.test.ts`, `recommendation/src/provider/types.ts`, `recommendation/src/provider/gemini.ts`, `recommendation/src/provider/factory.ts`, `recommendation/src/provider/index.ts`, `recommendation/src/provider/factory.test.ts`, `yarn.lock`, `PLANS.md`
- What changed: Started and completed the recommendation-owned slice of `detail-012` by adding a first-class Gemini keyword provider path without changing shared contracts. Added `gemini` provider support to provider types/factory, introduced `recommendation/src/provider/gemini.ts` with JSON output parsing and fallback behavior aligned to existing provider semantics, and kept sentence generation on existing fallback-only behavior for phase 1 scope control. Extended recommendation env parsing to be provider-aware (`gemini|openai|heuristic|stub`), added `GEMINI_API_KEY` support, and resolved API key priority by selected provider (`gemini` -> `GEMINI_API_KEY`, `openai` -> `OPENAI_API_KEY`, then generic `RECOMMENDATION_API_KEY` fallback). Updated recommendation env sample and added/expanded unit coverage for gemini factory selection, gemini output normalization, malformed-output fallback, and provider-aware env parsing.
- Tests run: `corepack yarn install --mode=skip-build` (outside sandbox, to install `@google/genai` and refresh workspace links); `corepack yarn workspace @scenaairo/recommendation typecheck`; `corepack yarn exec vitest run --pool threads recommendation/src/config/env.test.ts recommendation/src/provider/factory.test.ts recommendation/src/orchestration/index.test.ts --exclude recommendation/dist/**`; `corepack yarn workspace @scenaairo/recommendation lint`; `corepack yarn workspace @scenaairo/recommendation build`
- Result: Recommendation package now supports `provider=gemini` keyword generation path behind the existing provider abstraction, with passing recommendation typecheck/unit/lint/build gates.
- Warnings / blockers: Backend wiring/env sample/runtime smoke for `detail-012` are intentionally out of scope for this loop and remain for the backend-owned follow-up slice.
- Approval needed: `none`

### 2026-04-23 / loop-132
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: `backend/src/app.ts`, `backend/src/recommendation/routes.integration.test.ts`, `backend/.env.example`, `recommendation/src/index.ts`, `scripts/launch-local.ps1`, `ENVIRONMENT.md`, `PLANS.md`
- What changed: Finalized `detail-011` cleanup pass on top of existing env refactor work. Removed duplicate `config/env` export from recommendation package root, kept backend recommendation wiring strictly on `loadRecommendationEnv()` output (no direct recommendation-key reads from `process.env` in `buildApp()`), added an integration regression for the fallback path (`RECOMMENDATION_FALLBACK_TO_HEURISTIC_ON_ERROR=true` with missing API key), expanded backend sample env with recommendation runtime keys, and aligned launcher docs/behavior so runtime ownership is explicit on backend side.
- Tests run: `corepack yarn workspace @scenaairo/recommendation typecheck`; `corepack yarn workspace @scenaairo/backend typecheck`; `corepack yarn workspace @scenaairo/backend lint`; `corepack yarn exec vitest run --pool threads recommendation/src/config/env.test.ts recommendation/src/provider/factory.test.ts --exclude recommendation/dist/**`; `corepack yarn workspace @scenaairo/backend integration`; `corepack yarn workspace @scenaairo/backend test` (outside sandbox due `spawn EPERM` in sandbox); `corepack yarn workspace @scenaairo/recommendation build`; `corepack yarn workspace @scenaairo/backend build`
- Result: `detail-011` 범위에서 recommendation runtime env source-of-truth와 backend 런타임 동작이 일관되게 정렬되었고, 핵심 회귀 테스트(파서/통합/폴백)가 모두 통과했습니다.
- Warnings / blockers: none
- Approval needed: `none`

### 2026-04-23 / loop-133
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: `recommendation/src/provider/types.ts`, `recommendation/src/config/env.ts`, `recommendation/src/config/env.test.ts`, `backend/src/recommendation/routes.ts`, `backend/.env.example`, `yarn.lock`, `PLANS.md`
- What changed: Started `detail-012` backend scope by making recommendation runtime env parsing provider-aware for Gemini preparation. Added `gemini` to provider-name type, extended `loadRecommendationEnv()` to support `GEMINI_API_KEY` with provider-specific key priority (`gemini` -> `GEMINI_API_KEY`, `openai` -> `OPENAI_API_KEY`, both fallback to `RECOMMENDATION_API_KEY`), and introduced provider-aware default model selection (`gemini` defaults to `gemini-2.5-flash`). Updated backend recommendation error mapping to treat `invalid_api_key` and `upstream_connection_error` as upstream failures (`502`) while keeping config errors (`missing_api_key`, `unsupported_provider`) as `500`. Added `GEMINI_API_KEY` to backend env sample.
- Tests run: `corepack yarn install` (outside sandbox); `corepack yarn workspace @scenaairo/recommendation typecheck`; `corepack yarn workspace @scenaairo/backend typecheck`; `corepack yarn exec vitest run --pool threads recommendation/src/config/env.test.ts recommendation/src/provider/factory.test.ts --exclude recommendation/dist/**`; `corepack yarn workspace @scenaairo/backend integration`; `corepack yarn workspace @scenaairo/backend lint`
- Result: Backend recommendation runtime is now ready for provider-aware Gemini credential/model resolution, and backend error-surface mapping is expanded for upcoming Gemini upstream failures.
- Warnings / blockers: `provider=gemini` actual keyword 호출 경로는 recommendation Gemini provider 본체(Track A/B) 완성 전까지는 `unsupported_provider`로 남습니다.
- Approval needed: `none`

### 2026-04-23 / loop-133
- Active milestone: Post-baseline support task
- Agents engaged: Recommendation, Backend
- Touched zones: `backend/.env`, `backend/src/app.ts`, `backend/src/recommendation/routes.ts`, `recommendation/src/config/env.ts`, `recommendation/src/provider/openai.ts`, `scripts/load-env.mjs`, `PLANS.md`
- What changed: Investigated why the keyword recommendation endpoint still returns `recommendation_failed` after the env/runtime refactor. Verified that backend runtime env loading is active (`backend/.env` is read through `scripts/load-env.mjs`, `buildApp()` consumes `loadRecommendationEnv()`, and `/api/recommendation/keywords` reaches the OpenAI provider path). Isolated the likely root cause to the configured `OPENAI_API_KEY` value rather than the env wiring itself: the current backend-local key format does not match an OpenAI API key format, while provider-side error normalization currently collapses upstream authentication/network/provider failures into the generic `recommendation_failed` code.
- Tests run: read-only code inspection of `backend/.env`, `scripts/load-env.mjs`, `backend/src/app.ts`, `backend/src/recommendation/routes.ts`, `recommendation/src/config/env.ts`, `recommendation/src/provider/openai.ts`; prior local smoke against `/api/recommendation/keywords` still reproduces `502 {"message":"recommendation_failed"}`
- Result: Recommendation env loading is functioning, and the remaining blocker is at the actual OpenAI call boundary (most likely invalid provider credentials, with exact upstream cause hidden by current error normalization).
- Warnings / blockers: `OPENAI_API_KEY` should be rotated/replaced with a real OpenAI key, and provider-side diagnostics are currently too coarse to distinguish invalid key vs outbound network restriction vs provider-side request error.
- Approval needed: `none`

### 2026-04-23 / loop-134
- Active milestone: Post-baseline support task
- Agents engaged: Recommendation, Backend
- Touched zones: `backend/.env`, `recommendation/src/provider/openai.ts`, `PLANS.md`
- What changed: Performed a direct OpenAI SDK probe outside the sandbox using the same runtime model/env path as the recommendation feature to separate network issues from credential issues. Confirmed that outbound connectivity is available when unrestricted and that the current configured key is rejected by OpenAI itself with `401 invalid_api_key`. This narrows the failure from generic backend `recommendation_failed` down to a concrete credential rejection at the upstream OpenAI API boundary.
- Tests run: sandboxed direct `openai` SDK probe -> `Connection error.`; repeated outside sandbox with the same `backend/.env` configuration -> `401 invalid_api_key`
- Result: The recommendation failure is not caused by local env loading or backend-to-OpenAI routing. The immediate blocker is that the current configured credential is not accepted by OpenAI for the direct Responses API call.
- Warnings / blockers: Current provider error normalization still hides this upstream distinction from the app user by collapsing it into `recommendation_failed`; follow-up improvement should preserve or log upstream auth/network error class without exposing secrets.
- Approval needed: `none`

### 2026-04-23 / loop-135
- Active milestone: Post-baseline support task
- Agents engaged: Recommendation
- Touched zones: `PLANS.md`
- What changed: User clarified that the configured credential was a Gemini API key, not an OpenAI API key. This explains the previously confirmed `401 invalid_api_key` result against OpenAI: the current recommendation runtime is still wired only for the OpenAI provider path, so a Gemini key in the OpenAI env slot will always fail authentication.
- Tests run: none
- Result: Root cause is now fully explained: provider/credential mismatch (`Gemini key` used against `OpenAI provider`).
- Warnings / blockers: If Gemini is the intended provider, the next step is provider-scope work rather than further debugging of the current OpenAI path.
- Approval needed: `none`

### 2026-04-23 / loop-136
- Active milestone: Post-baseline support task
- Agents engaged: Recommendation, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Added `detail-012 / Gemini Recommendation Provider 전환 계획` to the consolidated detailed plan. The new plan scopes Gemini adoption to the recommendation/backend boundary, keeps `shared` contracts unchanged in phase 1, recommends the current official Google JS SDK path (`@google/genai`) for the Gemini provider implementation, and splits work into provider implementation, provider-aware env/key resolution, backend route wiring, and validation tracks. The plan also explicitly limits phase 1 to `keyword` recommendations while keeping `sentence` generation on the existing fallback path.
- Tests run: read-only inspection of `recommendation/src/provider/factory.ts`, `recommendation/src/config/env.ts`, `backend/src/app.ts`, `backend/.env.example`; current Google Gemini SDK/model docs checked on official Google AI for Developers pages
- Result: There is now a concrete execution plan for moving the recommendation feature from an OpenAI-only provider path to Gemini support without expanding scope into `shared` or unrelated frontend changes.
- Warnings / blockers: Actual Gemini runtime implementation will still need provider-specific smoke validation with a real Gemini key, and model defaults should remain env-driven to reduce future drift.
- Approval needed: `none`

### 2026-04-23 / loop-137
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: `recommendation/src/provider/types.ts`, `recommendation/src/config/env.ts`, `recommendation/src/config/env.test.ts`, `backend/src/recommendation/routes.ts`, `backend/src/recommendation/routes.integration.test.ts`, `backend/.env.example`, `recommendation/package.json`, `yarn.lock`, `PLANS.md`
- What changed: Started `detail-012` backend-owned slice and aligned runtime wiring to Gemini-aware behavior. Extended recommendation env parser to support provider-aware credential resolution (`gemini` uses `GEMINI_API_KEY`, `openai` uses `OPENAI_API_KEY`, both fallback to `RECOMMENDATION_API_KEY`) and provider-aware default model (`gemini-2.5-flash` for `provider=gemini`). Expanded backend route error mapping to classify `invalid_api_key` and `upstream_connection_error` as upstream failures (`502`). Updated backend env sample with `GEMINI_API_KEY` and added backend integration coverage for Gemini missing-key and fallback-on-error flows.
- Tests run: `corepack yarn install` (outside sandbox); `corepack yarn workspace @scenaairo/recommendation typecheck`; `corepack yarn exec vitest run --pool threads recommendation/src/config/env.test.ts recommendation/src/provider/factory.test.ts --exclude recommendation/dist/**`; `corepack yarn workspace @scenaairo/backend typecheck`; `corepack yarn workspace @scenaairo/backend integration`; `corepack yarn workspace @scenaairo/backend lint`
- Result: Backend runtime path is now provider-aware for Gemini env resolution, and backend integration gates include Gemini error/fallback scenarios.
- Warnings / blockers: Runtime smoke with a real `GEMINI_API_KEY` is still pending.
- Approval needed: `none`

### 2026-04-23 / loop-138
- Active milestone: Post-baseline support task
- Agents engaged: Recommendation, Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Added `detail-013 / Gemini Keyword Recommendation Latency 대응 계획` to the consolidated detailed plan. The new plan isolates latency work from the provider migration itself and splits responsibility across frontend UX/cache behavior, recommendation provider prompt/model/output tuning, and backend timeout/cache observability. It prioritizes flash-tier models, prompt/context reduction, suggestion-count reduction, timeout + heuristic fallback, and short-TTL caching before considering more complex techniques like streaming.
- Tests run: read-only inspection only
- Result: There is now a concrete mitigation plan for Gemini response-time issues that can be executed independently of broader provider migration work.
- Warnings / blockers: Actual latency improvement still requires implementation plus runtime measurement with a real Gemini key; model naming should remain env-driven because Gemini model availability changes over time.
- Approval needed: `none`

### 2026-04-23 / loop-139
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend, Version Control
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Added `detail-014 / Google Login + Real DB 전환 계획` to the consolidated detailed plan. The new plan recommends a Google Identity Services ID-token flow with backend verification and DB-backed server sessions rather than a broader OAuth code-flow integration, because the immediate goal is account authentication plus account-scoped persistence, not Google API resource access. The plan covers frontend replacement of `StubAuthBoundary`, backend auth endpoints/session issuance, migration of persistence routes away from trusting path-supplied `accountId`, MySQL canonical usage for authenticated mode, guest-to-account import policy, and expected schema additions such as `cloud_sessions`.
- Tests run: read-only inspection of `DISCOVERY.md`, `SPEC.md`, `AGENT_SYSTEM.md`, `frontend/src/auth/stubAuthBoundary.ts`, `frontend/src/routes/AuthCallbackPage.tsx`, `frontend/src/config/env.ts`, `backend/src/config/env.ts`, `backend/LOCAL_MYSQL.md`, `shared/src/contracts/auth.ts`; official Google Identity Services and Google ID token verification docs reviewed
- Result: There is now a concrete approval-ready implementation plan for moving from stub auth/local-first behavior to real Google-backed authentication and MySQL-backed authenticated persistence.
- Warnings / blockers: This remains a hard-stop implementation area under the repo rules because it touches authentication, sessions, secrets, and schema; implementation should not start until the human approves the chosen login/session/storage design.
- Approval needed: `implementation approval required before coding`

### 2026-04-23 / loop-139
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: `recommendation/src/config/env.ts`, `recommendation/src/config/env.test.ts`, `backend/src/app.ts`, `backend/src/recommendation/routes.ts`, `backend/src/recommendation/routes.integration.test.ts`, `backend/.env.example`, `PLANS.md`
- What changed: Implemented the backend-owned part of `detail-013` (Track H/I). Added runtime-tunable latency knobs to recommendation env parsing and backend wiring (`RECOMMENDATION_TIMEOUT_MS`, `RECOMMENDATION_CACHE_TTL_MS`, `RECOMMENDATION_MAX_SUGGESTIONS`). Applied those knobs in recommendation routes with provider-call timeout handling (`recommendation_timeout`), timeout-triggered heuristic fallback when enabled, keyword response trimming by max suggestion count, and short-TTL in-memory keyword cache keyed by provider/model/story/maxSuggestions. Also added lightweight observability logs for request duration, cache hit/miss, timeout, and fallback counters.
- Tests run: `corepack yarn workspace @scenaairo/recommendation typecheck`; `corepack yarn workspace @scenaairo/backend typecheck`; `corepack yarn exec vitest run --pool threads recommendation/src/config/env.test.ts recommendation/src/provider/factory.test.ts --exclude recommendation/dist/**`; `corepack yarn workspace @scenaairo/backend integration`; `corepack yarn workspace @scenaairo/backend lint`
- Result: Backend now has configurable timeout/cache/max-suggestion controls with runtime behavior and integration coverage, satisfying the immediate `detail-013` backend execution slice.
- Warnings / blockers: Runtime smoke/latency comparison with a real Gemini key is still pending.
- Approval needed: `none`

### 2026-04-23 / loop-140
- Active milestone: Post-baseline support task
- Agents engaged: Recommendation
- Touched zones: `recommendation/src/contracts/index.ts`, `recommendation/src/context/index.ts`, `recommendation/src/provider/types.ts`, `recommendation/src/provider/factory.ts`, `recommendation/src/provider/gemini.ts`, `recommendation/src/provider/factory.test.ts`, `PLANS.md`
- What changed: Executed recommendation-owned `detail-013` latency slice (Track C/D/E/F/G) in the Gemini keyword path. Reduced prompt context to core fields (`nodeLevel`, focused node/parent context, top object anchors, top locked facts), limited output to a smaller configurable max suggestion count, added provider-level timeout handling with fallback compatibility, and added provider-side short-TTL in-memory cache with signature-based keys for repeated requests. Expanded factory options to pass Gemini latency tuning fields (`timeoutMs`, `cacheTtlMs`, `maxSuggestions`) and updated recommendation context payload to expose `parentSummary`/`lockedFacts` directly for lightweight prompt composition.
- Tests run: `corepack yarn workspace @scenaairo/recommendation typecheck`; `corepack yarn exec vitest run --pool threads recommendation/src/config/env.test.ts recommendation/src/provider/factory.test.ts recommendation/src/orchestration/index.test.ts --exclude recommendation/dist/**`; `corepack yarn workspace @scenaairo/recommendation lint`; `corepack yarn workspace @scenaairo/recommendation build`; `corepack yarn workspace @scenaairo/backend typecheck`
- Result: Recommendation module now applies latency-focused behavior directly in the Gemini provider with passing recommendation and backend type gates.
- Warnings / blockers: End-to-end runtime latency comparison with a real Gemini key remains pending.
- Approval needed: `none`

### 2026-04-23 / loop-141
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: `backend/package.json`, `frontend/package.json`, `PLANS.md`
- What changed: Fixed `yarn dev:backend` compile failure caused by stale copied package types under `node_modules/@scenaairo/recommendation`. Changed internal workspace dependency declarations from `file:../...` to `workspace:*` in backend/frontend so Yarn links local workspaces directly instead of using stale copied package contents.
- Tests run: `corepack yarn install`; `corepack yarn workspace @scenaairo/backend build`; `corepack yarn dev:backend` (startup verification, timed stop)
- Result: `yarn dev:backend` now reaches runtime successfully and reports `Backend listening on http://127.0.0.1:3001` without `RecommendationEnv` property errors.
- Warnings / blockers: `corepack yarn install` still reports existing peer warning (`@scenaairo/backend` missing `@types/node` peer for `mysql2`) but does not block startup.
- Approval needed: `none`

### 2026-04-23 / loop-142
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: `backend/src/logging/console.ts`, `backend/src/config/env.ts`, `backend/src/app.ts`, `backend/src/recommendation/routes.ts`, `backend/src/server.ts`, `backend/.env.example`, `PLANS.md`
- What changed: Improved backend console readability by introducing a shared plain-text logger format (`[timestamp][SCENAAIRO][scope][level]`). Added runtime env controls (`BACKEND_LOG_LEVEL`, `BACKEND_LOG_REQUESTS`), registered request lifecycle hooks (`request_start`, `request_end`, `request_error`) in app bootstrapping, and aligned recommendation observability events to the same log formatter. Also switched server startup/failure output from scattered `console.log/error` calls to structured logger events (`backend_starting`, `backend_listening`, `backend_start_failed`).
- Tests run: `corepack yarn workspace @scenaairo/backend typecheck`; `corepack yarn workspace @scenaairo/backend lint`; `corepack yarn workspace @scenaairo/backend integration`; `corepack yarn dev:backend` (log output verification, observed expected `EADDRINUSE` due existing listener on 3001)
- Result: Backend logs are now consistently formatted and easier to scan during local development, with configurable verbosity and request logging toggle.
- Warnings / blockers: Local port `3001` was already occupied during final runtime check, so startup failed as expected after logging the structured failure event.
- Approval needed: `none`

### 2026-04-23 / loop-143
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: `backend/src/auth/*`, `backend/src/config/env.ts`, `backend/src/app.ts`, `backend/src/persistence/routes.ts`, `backend/src/persistence/mysql-store.ts`, `backend/mysql/init/001_create_cloud_projects.sql`, `backend/.env.example`, `backend/LOCAL_MYSQL.md`, `backend/package.json`, `backend/src/app.test.ts`, `PLANS.md`
- What changed: Executed `detail-014` backend scope (Auth+Session + Persistence Guard). Added Google login/session APIs (`POST /api/auth/google/login`, `GET /api/auth/session`, `POST /api/auth/logout`), server-side ID token verification scaffolding (Google JWK + signature/aud/iss/exp checks), MySQL-backed auth/session store with `cloud_sessions` lifecycle, and session cookie handling (`HttpOnly`, `SameSite`, `Secure` env-driven). Added transitional persistence guard so session account and path account mismatch is blocked, plus canonical authenticated persistence routes (`/api/persistence/projects*`) that require session and route authenticated writes/reads to MySQL.
- Tests run: `corepack yarn workspace @scenaairo/backend typecheck`; `corepack yarn workspace @scenaairo/backend lint`; `corepack yarn workspace @scenaairo/backend integration` (auth integration 포함, 22 passed); `corepack yarn dev:backend` (runtime start check; local 3001 already in use); `corepack yarn workspace @scenaairo/backend test` attempted but failed in sandbox due Vitest worker spawn EPERM
- Result: `detail-014` backend minimum slice is now implemented with auth/session endpoints, DB session schema, and persistence authorization guard in place.
- Warnings / blockers: Real Google login runtime smoke still needs a valid `GOOGLE_CLIENT_ID` and browser-side GIS credential flow; local full smoke may require freeing port `3001`.
- Approval needed: `user requested implementation and execution`

### 2026-04-23 / loop-142
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend, Recommendation
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Refined `detail-014` so it is usable for parallel execution across chats. Added explicit FE / BE / Recommendation directory ownership, candidate file sets, per-directory done conditions, parallel-safe sequencing, recommended chat split (`Backend Auth + Session`, `Backend Persistence Guard`, `Frontend Auth Boundary`, `Frontend Workspace UI`, `Recommendation Regression Guard`), and explicit “no-touch / no direct implementation” guidance for the recommendation directory in phase 1.
- Tests run: read-only planning update only
- Result: The Google login + real DB migration plan is now organized by directory and parallel workstream rather than only by conceptual domain.
- Warnings / blockers: This remains approval-gated implementation work because it touches auth, sessions, secrets, and schema.
- Approval needed: `implementation approval required before coding`

### 2026-04-23 / loop-143
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/persistence/controller.ts`, `frontend/src/persistence/nodeTree.ts`, `PLANS.md`
- What changed: Investigated the reported bug where moving a minor node under major/minor connections causes it to reattach to the last major node. The issue appears to be frontend-side reorder intent generation rather than backend canonicalization. `WorkspaceShell.getInsertIndexForCanvasY()` currently computes the drop anchor using only same-level nodes and, when there is no later same-level node, falls back to `orderedNodes.length`. That causes `controller.moveNode()` to interpret the drag as “move to episode end”, and `inferParentId()` then rewires the moved minor root to the last available major parent.
- Tests run: read-only code inspection only
- Result: Likely root cause identified. The fix should target frontend insert-index calculation near the no-next-same-level fallback path, not persistence canonicalization.
- Warnings / blockers: No existing route test appears to cover this exact drag/reparent scenario, so a regression test should be added before or with the fix.
- Approval needed: `none`

### 2026-04-23 / loop-144
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Added `detail-015 / Minor Node Drag Reparent-to-Last-Major 버그 수정 계획` to the consolidated detailed plan. The new plan is organized for parallel work by directory and clarifies that this bug is frontend-owned: `WorkspaceShell` should own drag-intent and insert-index correction, while `controller/nodeTree` only receive a secondary review if route-side fixes are insufficient. Backend and Recommendation are explicitly marked as no-touch for phase 1 except for final smoke verification.
- Tests run: planning update only
- Result: There is now a concrete FE/BE/Recommendation-scoped fix plan for the minor-drag reparent bug, including recommended chat split and test gates.
- Warnings / blockers: `WorkspaceShell.tsx` remains a high-conflict file and should be treated as single-writer during implementation.
- Approval needed: `none`

### 2026-04-23 / loop-143
- Active milestone: Post-baseline support task
- Agents engaged: Recommendation
- Touched zones: `PLANS.md`
- What changed: Executed `detail-014` Recommendation Regression Guard scope as defined in the parallelized plan (`no-touch / smoke / regression only`). Performed recommendation and backend-recommendation regression gates to ensure auth/session transition work did not break recommendation contracts or route behavior. No direct implementation changes were applied under `recommendation/src`.
- Tests run: `corepack yarn workspace @scenaairo/recommendation typecheck`; `corepack yarn exec vitest run --pool threads recommendation/src/config/env.test.ts recommendation/src/provider/factory.test.ts recommendation/src/orchestration/index.test.ts --exclude recommendation/dist/**`; `corepack yarn workspace @scenaairo/recommendation lint`; `corepack yarn workspace @scenaairo/recommendation build`; `corepack yarn workspace @scenaairo/backend typecheck`; `corepack yarn exec vitest run --pool threads backend/src/recommendation/routes.integration.test.ts --exclude backend/dist/**`
- Result: Recommendation regression guard passed with all targeted gates green; current auth/session-related work does not regress recommendation behavior at this stage.
- Warnings / blockers: Runtime smoke under real authenticated Google session is still pending until the auth/session implementation track is merged and runnable end-to-end.
- Approval needed: `none`

### 2026-04-23 / loop-144
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/auth/sessionAuthBoundary.ts`, `frontend/src/config/env.ts`, `frontend/src/copy.ts`, `frontend/src/routes/AuthCallbackPage.tsx`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/.env.example`, `PLANS.md`
- What changed: Implemented the Frontend slice of `detail-014` by introducing session-based auth boundary wiring in WorkspaceShell, adding server-session auth API calls (`/api/auth/session`, `/api/auth/google/login`, `/api/auth/logout`) for initialization/sign-in/sign-out, adding Google credential callback exchange handling on `/auth/callback`, and adding `VITE_GOOGLE_CLIENT_ID` to frontend env samples.
- Tests run: not run (not requested).
- Result: Served-mode workspace now bootstraps auth state from server session endpoint while standalone mode continues to use local stub auth for compatibility.
- Warnings / blockers: The callback page currently supports `credential` exchange only and still keeps legacy `code/state` display behavior; full OAuth redirect-code exchange and successful runtime smoke require backend auth endpoints and Google provider wiring.
- Approval needed: `implementation approval required before final hard-stop gate`

### 2026-04-23 / loop-145
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/auth/sessionAuthBoundary.ts`, `frontend/src/routes/AuthCallbackPage.tsx`, `frontend/.env`, `PLANS.md`
- What changed: Refined the `detail-014` frontend slice by stabilizing the new `SessionAuthBoundary` implementation (comment normalization, clearer error handling, and Google SDK load guards) and making `/auth/callback` auto-return to `/` after successful Google credential exchange for faster post-login flow.
- Tests run: not run (not requested).
- Result: Frontend Google-session bootstrap path now behaves consistently for callback completion and provides cleaner fallback behavior when guest/session queries fail or Google SDK is unavailable.
- Warnings / blockers: Backend auth/session endpoints are still pending, so end-to-end runtime verification remains blocked until backend `detail-014` tracks complete.
- Approval needed: `implementation approval required before final hard-stop gate`

### 2026-04-23 / loop-146
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/AuthCallbackPage.tsx`, `PLANS.md`
- What changed: Fixed `/auth/callback` side effects by memoizing query parsing and narrowing effect dependencies, preventing duplicate Google credential exchange loops on route re-renders.
- Tests run: not run (not requested).
- Result: Callback flow now performs one session exchange per query change and avoids re-dispatching POST calls when only local component state changes.
- Warnings / blockers: Backend auth/session endpoints are still pending, so end-to-end runtime verification remains blocked until backend `detail-014` tracks complete.
- Approval needed: `implementation approval required before final hard-stop gate`
### 2026-04-23 / loop-147
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Fixed `detail-015` by adjusting `WorkspaceShell.getInsertIndexForCanvasY()` fallback behavior for drag moves with no same-level anchor, and added a regression test that verifies a dragged minor stays connected to its original major parent when moved below another major node.
- Tests run: not run (not requested)
- Result: Route-layer fix + regression test coverage added.
- Warnings / blockers: Regression test validates parent drift path by checking connection-line start position; broader controller/canonicalized-path confirmation still follows existing checks.
- Approval needed: `none`

### 2026-04-23 / loop-148
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `frontend/.env`, `frontend/src/auth/sessionAuthBoundary.ts`, `frontend/src/config/env.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `backend/.env`, `backend/.env.example`, `backend/src/auth/service.ts`, `backend/src/config/env.ts`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Investigated why clicking the Google sign-in entry does not reliably open a Google login UI. Confirmed three likely causes from the current code/config state: frontend `VITE_GOOGLE_CLIENT_ID` is not configured so `SessionAuthBoundary.signIn()` can fail before opening GIS; backend token verification still depends on `GOOGLE_CLIENT_ID`, so credential exchange can fail even after frontend credential acquisition; and the current frontend entry path relies on `google.accounts.id.prompt()` semantics, which do not guarantee a deterministic “custom button click always opens login popup” UX. Added `detail-016 / Google 로그인 버튼 클릭 시 로그인 UI 미노출 원인 및 수정 계획` to split this issue into frontend login-entry/auth-surface work, backend readiness/error-contract work, and explicit recommendation no-touch guidance.
- Tests run: read-only code inspection and configuration review only
- Result: Root cause is narrowed to configuration readiness plus the current GIS interaction choice, not generic frontend/backend connectivity.
- Warnings / blockers: This remains auth-sensitive work under the existing hard-stop policy; implementation should stay aligned with official GIS button semantics rather than trying to force-open unsupported custom-button flows.
- Approval needed: `none`

### 2026-04-23 / loop-149
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend, Recommendation
- Touched zones: `backend/src/app.ts`, `backend/src/auth/routes.ts`, `backend/src/auth/service.ts`, `backend/src/persistence/routes.ts`, `backend/LOCAL_MYSQL.md`, `backend/mysql/init/001_create_cloud_projects.sql`, `frontend/src/auth/sessionAuthBoundary.ts`, `frontend/src/persistence/cloudClient.ts`, `frontend/src/persistence/controller.ts`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Re-read the current Google-login and persistence cutover paths to plan the “login success -> real DB-backed service” transition. Confirmed that the repository already has most backend building blocks in place: auth/session routes, `cloud_accounts` + `cloud_sessions`, MySQL-backed auth store, authenticated canonical persistence routes (`/api/persistence/projects*`), and frontend `connectAuthenticatedSession(...)` import logic. The main remaining gap is that frontend cloud access still centers on legacy `/api/persistence/accounts/:accountId/*` paths, while the actual service target should be session-scoped canonical persistence after login. Added `detail-017 / Google 로그인 성공 후 실제 DB 서비스 전환 계획` with explicit FE / BE / Recommendation ownership, cutover policy, legacy route bridge strategy, MySQL readiness scope, and smoke gates.
- Tests run: read-only code inspection only
- Result: The next-phase migration is now framed as a session-scoped persistence and guest-to-account cutover task, not a greenfield auth build.
- Warnings / blockers: This remains approval-gated implementation work because it touches auth, sessions, persistence boundaries, and effective schema-backed service behavior.
- Approval needed: `implementation approval required before coding` 

### 2026-04-23 / loop-150
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/auth/sessionAuthBoundary.ts`, `frontend/src/persistence/cloudClient.ts`, `PLANS.md`
- What changed: Investigated the runtime error `Failed to execute 'fetch' on 'Window': Illegal invocation` reported immediately after Google sign-in UI completion. Re-read the auth/session exchange path and found a likely frontend-only cause: `SessionAuthBoundary` stores the raw global `fetch` reference via `options.fetchImpl ?? fetch` and later invokes it through an instance field, while the newer `CloudPersistenceClient` already protects against this exact browser binding issue by defaulting to `(...args) => fetch(...args)`. This makes the post-Google credential exchange (`/api/auth/google/login`) a likely failure point before the app can switch into authenticated mode.
- Tests run: read-only code inspection only
- Result: Likely root cause narrowed to unbound native `fetch` usage inside the auth boundary, not Google token verification or DB persistence itself.
- Warnings / blockers: Fixing it requires touching the auth-sensitive frontend login path, so actual code changes should stay within the existing auth hard-stop approval boundary.
- Approval needed: `implementation approval required before coding`

### 2026-04-23 / loop-151
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Added `detail-018 / Google 로그인 후 fetch Illegal invocation 오류 대응 계획` to isolate the newly observed post-login runtime failure from the broader Google-login and DB-cutover streams. The new plan frames this as a frontend-owned auth-boundary bug with explicit FE / BE / Recommendation ownership: frontend fixes the unbound fetch issue and adds auth-boundary regression coverage, backend only performs route/session smoke after the fix, and recommendation remains no-touch.
- Tests run: planning update only
- Result: The team now has a dedicated execution plan for the “Google UI succeeds but app never becomes authenticated” failure mode, separate from `detail-016` and `detail-017`.
- Warnings / blockers: Still inside the auth hard-stop area; implementation should remain a minimal targeted fix before broader DB service cutover work.
- Approval needed: `none`

### 2026-04-23 / loop-152
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `frontend/src/persistence/localStore.ts`, `frontend/src/persistence/controller.ts`, `frontend/src/persistence/flushQueue.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Analyzed the newly reported post-login data-leak/cache-mixing problem. Confirmed that the current frontend still uses a single local cache namespace across guest and authenticated sessions, loads local registry/snapshot before authenticated account bootstrap, and keeps the previous authenticated snapshot visible on sign-out. This creates three concrete risks: stale guest/A-account data can render before current-account data on boot, A-account data can remain visible after logout, and account/project UI localStorage keys can be reused across accounts. Added `detail-019 / 인증 상태 변화 기준 로컬 캐시 스코프 분리 및 이전 계정 노출 방지` with explicit FE / BE / Recommendation work streams, scope-aware storage strategy, authenticated bootstrap guard, sign-out reset strategy, UI cache key scoping, merge order, and validation matrix.
- Tests run: read-only code inspection only
- Result: Root cause and execution strategy are now documented as a frontend cache-scope/bootstrap problem rather than a Google OAuth failure.
- Warnings / blockers: Implementation touches auth-adjacent persistence state and first-render behavior, so integration needs to be validated against login refresh/account-switch scenarios before completion.
- Approval needed: `none`

### 2026-04-23 / loop-149
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: `backend/src/auth/routes.ts`, `backend/src/auth/service.ts`, `backend/src/auth/routes.integration.test.ts`, `backend/src/app.ts`, `backend/src/server.ts`, `backend/.env.example`, `frontend/.env.example`, `ENVIRONMENT.md`, `PLANS.md`
- What changed: Executed the backend-owned slice of `detail-016` (Auth Readiness + Error Contract). Normalized login error responses to explicit contract codes (`google_auth_not_configured`, `google_token_verification_failed`, `google_login_failed`) instead of leaking low-level verifier messages. Added startup/runtime readiness visibility by logging Google auth configuration status and warning when `GOOGLE_CLIENT_ID` is unset. Updated env/documentation alignment so frontend `VITE_GOOGLE_CLIENT_ID` and backend `GOOGLE_CLIENT_ID` are explicitly documented to target the same OAuth client.
- Tests run: `corepack yarn workspace @scenaairo/backend typecheck`; `corepack yarn workspace @scenaairo/backend lint`; `corepack yarn workspace @scenaairo/backend integration` (24 passed); `corepack yarn dev:backend` (startup log verification)
- Result: Backend now returns clear auth configuration/verification errors for Google login and surfaces readiness issues in logs, satisfying `detail-016` backend scope.
- Warnings / blockers: End-to-end user-visible login UI behavior still depends on frontend `prompt()` path changes (separate frontend-owned `detail-016` tracks).
- Approval needed: `none`

### 2026-04-23 / loop-150
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: `backend/src/health/readiness.ts`, `backend/src/app.ts`, `backend/src/config/env.ts`, `backend/src/persistence/routes.ts`, `backend/src/app.test.ts`, `backend/src/persistence/routes.integration.test.ts`, `backend/.env.example`, `backend/LOCAL_MYSQL.md`, `PLANS.md`
- What changed: Executed the backend-owned slice of `detail-017` by reinforcing authenticated DB-service readiness and legacy-bridge signaling. Added dedicated MySQL readiness probe utility and new endpoint `GET /api/health/readiness` that reports `googleAuthConfigured` and live MySQL reachability (`ready`/`degraded`). Kept existing `/api/health` contract intact. Added `MYSQL_READINESS_TIMEOUT_MS` env parsing to control probe timeout. Marked legacy accountId persistence routes as migration bridge by returning deprecation headers while keeping behavior unchanged. Preserved canonical authenticated persistence path (`/api/persistence/projects*`) as MySQL-first contract.
- Tests run: `corepack yarn workspace @scenaairo/backend typecheck`; `corepack yarn workspace @scenaairo/backend lint`; `corepack yarn workspace @scenaairo/backend integration`; `corepack yarn exec vitest run --pool threads backend/src/app.test.ts backend/src/persistence/routes.integration.test.ts --exclude backend/dist/**`; `corepack yarn dev:backend` (runtime log verification; local 3001 occupied)
- Result: Backend now exposes explicit readiness state for Google-login-to-DB cutover and tags legacy persistence routes as deprecation bridge, satisfying `detail-017` backend track A/B/C.
- Warnings / blockers: Full runtime smoke for authenticated persistence still requires end-to-end frontend cutover to session-scoped canonical routes (`detail-017` frontend tracks).
- Approval needed: `none`
### 2026-04-23 / loop-151
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/copy.ts`, `frontend/src/persistence/controller.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.common.tsx`, `PLANS.md`
- What changed: Completed frontend `detail-017` cutover UX hardening by adding explicit auth-transition signaling in `WorkspacePersistenceController.signIn()` and tightening the `WorkspaceShell` auth menu during sign-in (`sign-in in progress` state, button disable while exchange is running, and clearer cloud cutover status text). This reduces perceived ambiguity right after Google login by showing DB-connected transition explicitly.
- Tests run: not run (not requested).
- Result: User-visible sign-in path now keeps actions blocked during auth exchange and displays clearer `detail-017` transition status while retaining existing session-scoped persistence route behavior.
- Warnings / blockers: Runtime smoke still depends on actual Google OAuth credential exchange and backend MySQL availability.
- Approval needed: `none`

### 2026-04-23 / loop-152
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/auth/sessionAuthBoundary.ts`, `frontend/src/auth/sessionAuthBoundary.test.ts`, `PLANS.md`
- What changed: Implemented frontend `detail-018` Track A/B minimum slice by wrapping default auth-boundary fetch usage with a safe function (`createSafeFetch`) so credential exchange requests are not invoked with an instance-method `this` context, and added dedicated regression tests for (1) method-context-safe session fetch and (2) Google credential -> `/api/auth/google/login` exchange path normalization to authenticated session.
- Tests run: `corepack yarn --cwd frontend run -T vitest run src/auth/sessionAuthBoundary.test.ts` (pass); `corepack yarn --cwd frontend run -T eslint src/auth/sessionAuthBoundary.ts src/auth/sessionAuthBoundary.test.ts --max-warnings=0` (pass); attempted full `corepack yarn --cwd frontend typecheck` and broad test entry but both are currently blocked by pre-existing failures unrelated to this slice.
- Result: Auth boundary no longer stores raw default `fetch` directly; targeted regression coverage for the `Illegal invocation` path is now in place and passing.
- Warnings / blockers: Repository baseline currently has existing failures outside this slice (`frontend/src/routes/WorkspaceShell.test.tsx` parse error and an existing controller test expectation mismatch), so full-frontend gate remains red until those are repaired.
- Approval needed: `none`

### 2026-04-23 / loop-153
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/persistence/localStore.ts`, `frontend/src/persistence/flushQueue.ts`, `frontend/src/persistence/controller.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/useEpisodeCanvasState.ts`, `frontend/src/persistence/controller.test.ts`, `frontend/src/auth/sessionAuthBoundary.test.ts`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Executed `detail-019` to isolate local cache by auth/account scope and stop previous-user data from leaking across login state changes. Added scope-aware local persistence keys (`guest` vs `account:<id>`), switched controller bootstrap/sign-in/sign-out flows to swap cache scope and pending sync state, prevented authenticated boot from preloading guest cache, and replaced sign-out visible state with a fresh guest workspace instead of leaving the prior account snapshot on screen. Also scoped `WorkspaceShell` UI localStorage keys (folders, folder pins, pinned objects, node sizes) by the same cache scope rule so project/episode UI state no longer crosses account boundaries. Added focused controller regressions for guest -> auth boot, auth -> sign-out reset, and A -> logout -> B switch, then fixed auth-boundary test environment assumptions (`window` presence) so targeted auth/cache tests pass in the current branch.
- Tests run: `corepack yarn --cwd frontend typecheck` (pass, prior run); `corepack yarn --cwd frontend build` (pass); `corepack yarn exec vitest run frontend/src/persistence/controller.test.ts frontend/src/auth/sessionAuthBoundary.test.ts --exclude frontend/src/routes/WorkspaceShell.test.tsx` (pass, 22 tests); `corepack yarn --cwd frontend run -T eslint src/persistence/localStore.ts src/persistence/flushQueue.ts src/persistence/controller.ts src/persistence/controller.test.ts src/auth/sessionAuthBoundary.ts src/auth/sessionAuthBoundary.test.ts src/routes/WorkspaceShell.tsx src/routes/workspace-shell/useEpisodeCanvasState.ts --max-warnings=0` (fails on pre-existing `react-hooks/set-state-in-effect` issues in `WorkspaceShell.tsx` and `useEpisodeCanvasState.ts`)
- Result: Current-account data is now the only local persistence scope loaded after Google sign-in, previous authenticated data is dropped on sign-out, and account-specific UI cache keys are separated instead of being shared globally.
- Warnings / blockers: Full `WorkspaceShell` route suite and repo-wide frontend lint are still not green on this branch due existing baseline issues outside the auth-cache fix itself. The remaining recommended check is manual browser smoke for A -> logout -> B and refresh flows against a live backend session.
- Approval needed: `none`

### 2026-04-23 / loop-154
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `frontend/src/persistence/controller.ts`, `frontend/src/persistence/sampleWorkspace.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/persistence/controller.test.ts`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Analyzed the follow-up issue where a brand-new authenticated Google account still sees populated workspace data even after cache-scope isolation. Confirmed that the remaining cause is not previous-user cache leakage but current frontend bootstrap policy: `bootstrapAuthenticatedSession(...)` still calls `seedWorkspace()` when `listProjects()` returns zero projects, and even in the error path. Added `detail-020 / 신규 authenticated 계정은 샘플 시드 없이 빈 상태로 시작하도록 전환` to separate guest-only sample seeding from authenticated empty-state behavior, including FE / BE / Recommendation ownership, alternative comparison (`auto-empty-project` vs true empty state), merge order, and validation gates.
- Tests run: read-only code inspection only
- Result: The next change is now framed as a product-policy correction in authenticated bootstrap semantics, not another cache bug.
- Warnings / blockers: Implementing true authenticated empty state may widen the impact if current UI assumes `snapshot` always exists. This should be handled as a minimal targeted cutover with frontend single-writer ownership on `controller.ts` / `WorkspaceShell.tsx`.
- Approval needed: `none`

### 2026-04-23 / loop-155
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/persistence/controller.ts`, `frontend/src/persistence/localStore.ts`, `frontend/src/persistence/sampleWorkspace.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/persistence/controller.test.ts`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Re-analyzed the still-visible `Episode 9/10/11/12` issue after the partial `authenticated-empty` branch changes landed. Confirmed that the remaining leak is now specifically in auth transition semantics: `signIn()` still passes the current guest snapshot into `connectAuthenticatedSession(...)`, which can import guest sample data into a newly authenticated account, and `signOut()` still unconditionally calls `seedWorkspace()`, recreating the sample episodes on guest transition. Added `detail-021 / 로그인 및 로그아웃 전환 시 샘플 워크스페이스 유입 차단` to isolate this narrower problem, including FE / BE / Recommendation ownership, guest-sample cache risk handling, merge order, and focused validation gates for login, logout, and refresh transitions.
- Tests run: read-only code inspection only
- Result: The remaining `Episode 9/10/11/12` issue is now scoped as an auth-transition sample-seeding/import bug rather than a generic cache-scope problem.
- Warnings / blockers: Existing guest-scope sample cache may still be present in local storage, so the implementation should distinguish sample signature invalidation from legitimate guest work before clearing or bypassing guest data.
- Approval needed: `none`

### 2026-04-23 / loop-156
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/useEpisodeCanvasState.ts`, `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`, `frontend/src/routes/workspace-shell/workspaceShell.storage.ts`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Investigated the newly reported refresh-time layout drift where the main-lane arrow appears reset and node spacing compresses after reload. Narrowed the issue to frontend canvas restoration semantics rather than persistence/auth: `useEpisodeCanvasState.ts` contains an episode-scoped `timelineEndY` / `laneDividerXs` / `nodeSizes` persistence path but is not actually used by `WorkspaceShell.tsx`, while `WorkspaceShell.tsx` keeps duplicated state logic and only restores `nodeSizes` from localStorage on refresh. At render time, placements are then reinterpreted through `resolveNodeOverlapPlacement(...)` and `applyLaneVerticalReflow(...)`, and `effectiveTimelineEndY` is recomputed from `max(timelineEndY, lowestNodeBottom)`, which can make refresh-time layout differ from the pre-refresh canvas. Added `detail-022 / 새로고침 후 메인 레인 애로우 및 노드 간격 드리프트 복원 안정화` with FE-only streams for state-owner consolidation, layout determinism, and regression coverage.
- Tests run: read-only code inspection only
- Result: The refresh drift is now scoped as a duplicated canvas-state / non-deterministic layout-recompute problem in frontend rendering, not a DB or cache-scope issue.
- Warnings / blockers: `WorkspaceShell.tsx` is currently high-conflict and also has unrelated baseline lint/test debt, so implementation should stay single-writer and separate restoration-owner cleanup from reflow-rule changes.
- Approval needed: `none`

### 2026-04-23 / loop-157
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/persistence/sampleWorkspace.ts`, `frontend/src/persistence/controller.ts`, `frontend/src/persistence/localStore.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/copy.ts`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Planned the removal of remaining guest demo hardcoding after confirming that the `Episode 12 / 11 / 10 / 9` sequence comes directly from `createSampleWorkspace(...)` and its sample signature constants. Added `detail-023 / 게스트 샘플 하드코딩 제거 및 초기 상태 정상화` to fully retire automatic guest sample seeding, normalize guest/authenticated/starter initialization semantics, and keep any legacy sample-signature cleanup strictly as a migration aid instead of a live initialization path. The plan includes FE / BE / Recommendation ownership, stream split, merge order, and regression gates.
- Tests run: planning update only
- Result: The next cleanup is now framed as seed-policy normalization rather than a numbering bug. `Episode 9~12` appearing at all is treated as legacy sample-workspace leakage and should disappear once sample seeding is retired.
- Warnings / blockers: Legacy guest localStorage may still contain sample snapshots, so implementation must distinguish sample signature cleanup from legitimate guest work to avoid over-deleting local data.
- Approval needed: `none`

### 2026-04-23 / loop-158
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Reformatted `detail-023` from stream-oriented decomposition into domain-oriented ownership at the user's request. The plan now groups work by `Frontend / Backend / Service`, with each domain section explicitly listing owner type, goal, target files, prerequisites, non-overlapping ownership boundaries, parallelism, merge order, validation points, and risks.
- Tests run: planning update only
- Result: `detail-023` is now immediately assignable by domain instead of by stream.
- Warnings / blockers: none
- Approval needed: `none`

### 2026-04-23 / loop-155
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: `backend/src/app.ts`, `backend/src/persistence/routes.ts`, `backend/src/auth/routes.integration.test.ts`, `PLANS.md`
- What changed: Executed backend `detail-020` verification track by enabling test-time persistence-store injection for canonical routes and adding an auth integration regression that logs in a brand-new authenticated account and verifies `GET /api/persistence/projects` returns an empty list without sample seeding.
- Tests run: `corepack yarn workspace @scenaairo/backend typecheck`; `corepack yarn workspace @scenaairo/backend lint`; `corepack yarn workspace @scenaairo/backend integration` (25 passed)
- Result: Backend canonical contract for new authenticated accounts is now explicitly covered: empty account state returns `{ projects: [] }`.
- Warnings / blockers: This loop validates backend response contract only; frontend empty-state rendering/boot policy remains handled in frontend `detail-020` tracks.
- Approval needed: `none`

### 2026-04-23 / loop-156
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/persistence/controller.ts`, `frontend/src/persistence/sampleWorkspace.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.common.tsx`, `frontend/src/persistence/controller.test.ts`, `frontend/src/copy.ts`, `PLANS.md`
- What changed: Executed frontend `detail-020` Stream A/B by removing authenticated bootstrap sample seeding and introducing an explicit authenticated-empty state. `WorkspacePersistenceController.bootstrapAuthenticatedSession(...)` now transitions to `authenticated-empty` when cloud project count is zero (or to `error` without seeding on fetch failures), while guest seeding remains unchanged. Added explicit empty-state helpers (`createEmptyWorkspaceShell`, `createStarterWorkspace`) and a new explicit CTA path `createWorkspaceFromEmptyState()` so the first cloud project is created only after user action. Updated `WorkspaceShell` to render a dedicated authenticated-empty screen with `Create Project` / `Sign Out` actions, and updated cloud-status copy to describe the new state.
- Tests run: `corepack yarn --cwd frontend run -T vitest run src/persistence/controller.test.ts` (pass, 22 tests); `corepack yarn --cwd frontend run -T eslint src/persistence/controller.ts src/persistence/sampleWorkspace.ts src/persistence/controller.test.ts src/routes/workspace-shell/workspaceShell.common.tsx src/copy.ts --max-warnings=0` (pass); attempted lint including `src/routes/WorkspaceShell.tsx` is still blocked by pre-existing `react-hooks/set-state-in-effect` baseline violations in that file.
- Result: New authenticated accounts now start in empty state without sample project auto-creation, and first project creation is explicitly user-triggered.
- Warnings / blockers: `WorkspaceShell.tsx` still carries pre-existing lint blockers unrelated to this slice; full-file lint gate remains red until that baseline issue is handled.
- Approval needed: `none`

### 2026-04-23 / loop-157
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/persistence/controller.ts`, `frontend/src/persistence/localStore.ts`, `frontend/src/persistence/sampleWorkspace.ts`, `frontend/src/persistence/controller.test.ts`, `frontend/src/auth/sessionAuthBoundary.test.ts`, `PLANS.md`
- What changed: Executed `detail-021` Stream A by changing auth transition semantics to block sample workspace inflow. `signIn()` no longer forwards guest snapshot into authenticated import; it now boots from authenticated scope/local cache or authenticated bootstrap only. `signOut()` no longer calls `seedWorkspace()` and now restores guest local workspace if available, otherwise creates a guest empty workspace shell. Added guest cache sanitization that detects and removes legacy sample-signature snapshots before guest restore. Added local-store deletion helpers (`removeSnapshot`, `removeLinkage`) to support targeted sample cleanup. Expanded controller regression coverage for (1) guest sample -> new auth sign-in does not import sample, and (2) sign-out removes sample cache and keeps it removed after guest reinitialize.
- Tests run: `corepack yarn --cwd frontend run -T vitest run src/persistence/controller.test.ts` (pass, 24 tests); `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); `corepack yarn --cwd frontend run -T eslint src/persistence/controller.ts src/persistence/localStore.ts src/persistence/sampleWorkspace.ts src/persistence/controller.test.ts src/auth/sessionAuthBoundary.test.ts --max-warnings=0` (pass)
- Result: Login/logout transition paths no longer inject sample episodes 9/10/11/12 into authenticated or post-logout guest state.
- Warnings / blockers: none
- Approval needed: `none`

### 2026-04-23 / loop-158
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/copy.ts`, `PLANS.md`
- What changed: Executed `detail-021` Stream B by extending empty-state rendering to cover both authenticated-empty and guest-empty semantics. Added guest empty-state copy and UI path with explicit CTA (`Add Episodes`) plus sign-in entry from empty guest screen, while keeping authenticated-empty CTA (`Create Project`, `Sign Out`) intact. This keeps post-transition empty states explicit and prevents fallback UI from looking like seeded content.
- Tests run: `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); `corepack yarn --cwd frontend run -T eslint src/copy.ts --max-warnings=0` (pass); `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.tsx --max-warnings=0` attempted but blocked by pre-existing `react-hooks/set-state-in-effect` errors unrelated to this slice.
- Result: Guest/authenticated empty states now render intentionally with transition-specific actions instead of implicitly falling through to regular workspace rendering.
- Warnings / blockers: `WorkspaceShell.tsx` full-file lint remains red on existing baseline rules (`react-hooks/set-state-in-effect`), same as before this stream.
- Approval needed: `none`

### 2026-04-23 / loop-157
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: `PLANS.md`
- What changed: Executed `detail-021` Stream C (Backend Verification Smoke) without code changes. Re-ran canonical persistence smoke to confirm a newly authenticated account receives an empty project list and no sample project is auto-imported into server-side canonical storage.
- Tests run: `corepack yarn workspace @scenaairo/backend integration` (25 passed); `corepack yarn exec vitest run --pool threads backend/src/auth/routes.integration.test.ts --exclude backend/dist/**` (8 passed)
- Result: Backend canonical contract remains valid for Stream C: login-only path does not create/import sample workspace, and `/api/persistence/projects` returns `{ projects: [] }` for a fresh account.
- Warnings / blockers: Stream C validates backend contract only; guest/authenticated empty-state UX and transition semantics remain frontend-owned (Stream A/B).
- Approval needed: `none`

### 2026-04-23 / loop-159
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: `PLANS.md`
- What changed: Reset only the project database (`scenaairo_local`) and recreated schema tables from `backend/mysql/init/001_create_cloud_projects.sql` without touching global/local MySQL instance configuration.
- Tests run: runtime DB smoke (`DROP DATABASE IF EXISTS scenaairo_local`; `CREATE DATABASE scenaairo_local`; schema re-apply; `SHOW TABLES`)
- Result: Project DB reset completed; 9 tables recreated (`cloud_accounts`, `cloud_sessions`, `cloud_projects`, `cloud_episodes`, `cloud_objects`, `cloud_nodes`, `cloud_node_keywords`, `cloud_node_object_links`, `cloud_temporary_drawer`).
- Warnings / blockers: `mysql` CLI is not installed in this environment and Docker daemon is not running, so reset was executed through backend `mysql2` runtime connection.
- Approval needed: `none`

### 2026-04-23 / loop-160
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/useEpisodeCanvasState.ts`, `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`, `frontend/src/routes/workspace-shell/workspaceShell.layout.test.ts`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Executed `detail-022` frontend scope. Stream A: removed duplicated canvas UI restore path from `WorkspaceShell.tsx` and connected `useEpisodeCanvasState` as the single state owner for `timelineEndY`, `laneDividerXs`, `nodeSizes`, including `runUndo`/`runRedo` restore. Extended hook storage keys with auth cache scope (`guest` / `account:<id>`) and added a legacy-key migration fallback so existing episode canvas UI state can be lifted into the scoped key path on first read. Stream B: reduced refresh-time overlap reinterpretation by using `resolveNodeOverlapPlacement(..., { gap: 0 })` in the render-path placement pass while keeping existing lane reflow behavior unchanged for interaction stability. Stream C: added regression coverage for overlap detection unit behavior and rewrote the reload restoration test to verify episode canvas UI restore using persisted storage-driven values (timeline handle, divider handles, node size).
- Tests run: `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx src/routes/workspace-shell/workspaceShell.layout.test.ts -t "restores episode canvas UI state across reload|detects overlap only when lane nodes are actually intersecting"` (pass, 2 tests); `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx src/routes/workspace-shell/workspaceShell.layout.test.ts` (fails on pre-existing broader `WorkspaceShell` route regressions outside this slice).
- Result: Episode canvas UI refresh restoration is now consolidated into one scoped persistence path and validated by focused regression tests; main-lane timeline handle and node-size restoration no longer depend on the previous split storage/history logic.
- Warnings / blockers: Full `WorkspaceShell.test.tsx` suite still has existing broad failures in this worktree unrelated to the focused detail-022 assertions, so only targeted regression gates are green for this loop.
- Approval needed: `none`

### 2026-04-25 / loop-161
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Consolidated the remaining non-UI follow-up work into a lighter-weight handoff-style plan at the user's request. Added `detail-024 / 남은 비-UI 후속 정리 계획 (인수인계용)` that does not attempt to fully specify implementation, and instead gives FE / BE / Service owners only the issue summary, likely direction, candidate files, validation points, merge order, and main risks. The current remaining items are framed as (1) frontend seed-policy cleanup finishing `detail-023`, and (2) frontend `WorkspaceShell` baseline stabilization separating broad route/lint debt from the already-fixed auth/cache/empty-state work, with backend limited to post-change contract smoke.
- Tests run: planning update only
- Result: The remaining work is now documented in the shorter “owner handoff” style the user requested, rather than in a full prescriptive breakdown.
- Warnings / blockers: none
- Approval needed: `none`

### 2026-04-25 / loop-162
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Investigated the newly reported bug where typing in one node and then switching to another node causes the first node's content to disappear. Narrowed the issue to frontend inline-editor state ownership in `WorkspaceShell.tsx`: current selected-node text is persisted primarily through `textarea onBlur`, but selection-change logic also overwrites `inlineNodeTextDraft` with the next node's contents as soon as `selectedNodeId` changes. Added `detail-025 / 노드 전환 시 인라인 작성 draft 유실` as a FE-only handoff plan with the likely root cause, candidate files, and regression checks, without over-specifying the exact implementation.
- Tests run: read-only code inspection only
- Result: The issue is now scoped as a frontend selection-transition/save-timing bug, not a backend persistence bug.
- Warnings / blockers: `WorkspaceShell.tsx` is a high-conflict file and this fix may interact with blur, paste, mention, and keyword flows, so it should stay isolated from unrelated same-file work.
- Approval needed: `none`

### 2026-04-25 / loop-162
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `PLANS.md`
- What changed: Created an isolated merge-verification worktree at `C:\work\ARIAD\.tmp\merge-test-master-feature-jaesung-20260425` on temporary branch `codex/merge-test-master-feature-jaesung-20260425`, then attempted to merge the current `feature-jaesung` branch into the current `master` tip (`b2ae5bf`). The raw merge produced 13 conflicted files (`PLANS.md`, `backend/package.json`, `backend/src/persistence/store.ts`, `frontend/.env.example`, `frontend/package.json`, `frontend/src/copy.ts`, `frontend/src/persistence/controller.ts`, `frontend/src/persistence/standaloneCloudClient.ts`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/styles.css`, `scripts/dev-backend.mjs`, `yarn.lock`). For testability only, a conservative master-priority conflict resolution was staged in the isolated worktree; validation then showed the merged tree still contains a broad namespace/workspace split between `@scenaairo/*` and `@ariad/*`, so the branch is not close to a ready merge baseline.
- Tests run: `git merge-base master feature-jaesung`; `git rev-list --left-right --count master...feature-jaesung` (`4` vs `1`); isolated merge attempt `git merge --no-ff --no-commit feature-jaesung`; conflict inventory via `git diff --name-only --diff-filter=U`; provisional master-priority conflict resolution in the isolated worktree; `corepack yarn typecheck` (failed: root workspace/lockfile mismatch); `corepack yarn build` (failed with the same workspace/lockfile mismatch); `corepack yarn install --mode=skip-build` (failed: `@scenaairo/recommendation@workspace:*` workspace not found); namespace scan via `rg -o --no-filename "@ariad/|@scenaairo/" ...` (`@ariad/` 41 hits, `@scenaairo/` 46 hits)
- Result: Current `master` and `feature-jaesung` do not merge as a light conflict-fix. The branch now has both direct content conflicts and a wider package/import rename divergence, so even a conservative conflict resolution does not reach a runnable Yarn workspace state.
- Warnings / blockers: The isolated test worktree remains present for inspection at `C:\work\ARIAD\.tmp\merge-test-master-feature-jaesung-20260425`. Full merge integration would need a deliberate namespace/workspace normalization pass before ordinary lint/typecheck/build validation becomes meaningful.
- Approval needed: `none`

### 2026-04-25 / loop-163
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `PLANS.md`
- What changed: Continued the same isolated merge on `codex/merge-test-master-feature-jaesung-20260425` after user confirmed `@ariad/*` is the correct workspace namespace. Normalized the temporary merge result to `@ariad/*` package names/imports, refreshed the workspace with `corepack yarn install --mode=skip-build`, staged the resolved merge state, and re-ran validation. The isolated branch is now in "all conflicts fixed, still merging" state and is ready for a merge commit if we decide to conclude it.
- Tests run: `corepack yarn install --mode=skip-build` (pass with existing peer warning: `@ariad/backend` missing `@types/node` for `mysql2`); `corepack yarn typecheck` (pass); `corepack yarn lint` (fails on existing frontend `react-hooks/set-state-in-effect` findings in `AuthCallbackPage.tsx`, `WorkspaceShell.tsx`, `useEpisodeCanvasState.ts`, plus existing script `no-undef` findings in `scripts/*.mjs`); `corepack yarn test` outside sandbox (fails: 7 frontend tests, 94 pass / 7 fail); `corepack yarn build` outside sandbox (pass); `git diff master --` on failing implementation files (`WorkspaceShell.tsx`, `useEpisodeCanvasState.ts`, `controller.ts`, related workspace-shell helpers) showing only namespace/import changes relative to current `master`
- Result: The temporary merge is now technically coherent as an `@ariad/*` Yarn workspace: install, typecheck, and production build succeed. Remaining red state is concentrated in frontend tests and pre-existing lint baseline issues rather than unresolved merge conflicts.
- Warnings / blockers: The 7 failing tests are `frontend/src/persistence/controller.reorder.test.ts` (1) and `frontend/src/routes/WorkspaceShell.test.tsx` (6). Based on `git diff master --` for the implicated implementation files, those failures do not appear to come from additional logic changes in the merge branch beyond namespace normalization, so they are likely existing baseline/frontend behavior issues that need separate triage rather than raw merge-conflict repair.
- Approval needed: `none`

### 2026-04-25 / loop-163
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/persistence/controller.ts`, `frontend/src/persistence/controller.test.ts`, `PLANS.md`
- What changed: Executed `detail-024` Frontend Problem A (seed-policy follow-up) by removing guest/sample auto-seeding from controller initialization/reload paths. `WorkspacePersistenceController` now reads scoped local workspace only (`loadOrSeedWorkspace()` no longer seeds), and guest fallback consistently resolves to explicit guest-empty shell instead of implicit sample creation. Updated controller regression tests to empty-first semantics: legacy guest sample cache sanitation coverage, explicit episode/node/object setup in node/episode/drawer scenarios, and guest/auth transition assertions aligned to non-seeded defaults.
- Tests run: `corepack yarn --cwd frontend run -T vitest run src/persistence/controller.test.ts` (pass, 25 tests); `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); `corepack yarn --cwd frontend run -T eslint src/persistence/controller.ts src/persistence/controller.test.ts --max-warnings=0` (pass)
- Result: Guest baseline no longer auto-generates sample workspace data, legacy sample cleanup remains migration-only, and persistence controller test coverage is green under empty-first initialization.
- Warnings / blockers: `detail-024` Frontend Problem B (`WorkspaceShell` broad baseline stabilization) remains pending and is intentionally separated from this seed-policy slice.
- Approval needed: `none`

### 2026-04-25 / loop-164
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/persistence/controller.reorder.test.ts`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Continued on the isolated merge-verification branch `codex/merge-test-master-feature-jaesung-20260425` and aligned the remaining stale frontend tests to current empty-first / draft-first UI behavior. `controller.reorder.test.ts` now creates an authenticated-empty project explicitly before exercising reorder replay, instead of assuming `signIn()` seeds a node. `WorkspaceShell.test.tsx` was updated to assert the current invariants rather than older implementation details: keyword recommendation calls are counted by endpoint instead of raw `fetch` total, major end-marker checks follow the visually lowest major node and timeline-handle alignment, resize spacing uses the current 8px lane reflow gap, the minor-lane creation flow enters draft mode before clicking a lane, and the minor-parent drag test preserves whichever major is actually selected by current parent inference rather than assuming the first major node.
- Tests run: focused rerun `corepack yarn --cwd frontend test -- src/persistence/controller.reorder.test.ts src/routes/WorkspaceShell.test.tsx` (pass, 101 tests); full isolated suite `corepack yarn test` (pass: shared 2/2, recommendation 22/22, backend 19/19, frontend 101/101)
- Result: The isolated merge branch now has a green full test suite after stale frontend expectations were brought in line with the current master-side behavior model.
- Warnings / blockers: Existing lint baseline issues from the prior loop were not revisited here; this loop was limited to test-alignment and verification on the isolated merge branch.
- Approval needed: `none`

### 2026-04-25 / loop-165
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Continued `detail-024` Frontend Problem B directly on `master` and stabilized the current `WorkspaceShell` route baseline around the updated empty-first/auth-transition behavior. The remaining route-level regression was resolved by tightening the minor-parent drag assertion to verify parent-connection stability by observed connection-line start retention instead of assuming a fixed major target. This keeps the test aligned to current parent inference and drag semantics while still guarding the user-facing behavior (drag below another major must not silently rewire parent).
- Tests run: `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.tsx src/routes/WorkspaceShell.test.tsx --max-warnings=0` (pass); `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx src/routes/workspace-shell/workspaceShell.layout.test.ts` (pass, 56 tests)
- Result: `WorkspaceShell` B-scope baseline gate is now green on `master` for lint, typecheck, and route/layout regression coverage.
- Warnings / blockers: This loop intentionally stayed within `WorkspaceShell` scope; broader repository-wide lint/test debt outside this area was not re-triaged.
- Approval needed: `none`

### 2026-04-25 / loop-166
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Implemented `detail-025 / 노드 전환 시 인라인 작성 draft 유실` on `master`. Added explicit draft flush-on-selection-switch behavior (`flushSelectedNodeDraftBeforeSelection(...)`) in node-switch interaction paths (node click/double-click/menu select, drag/resize/rewire selection capture, canvas blank click) so the current node's inline draft is persisted before selection changes. Hardened `persistInlineNodeContent(...)` so asynchronous save completion only re-syncs local inline state when the same node is still selected, preventing late save results from overwriting a newly selected node's draft view. Added route regression coverage for the exact failure mode: typing in node A, switching to node B, and returning to node A now preserves the draft text.
- Tests run: `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.tsx src/routes/WorkspaceShell.test.tsx --max-warnings=0` (pass); `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); targeted `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx -t "creates and reuses object mentions from inline node text|keeps inline draft content when switching selection to another node"` (pass, 2 tests); full `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx src/routes/workspace-shell/workspaceShell.layout.test.ts` (pass, 57 tests)
- Result: Node-switch inline draft loss is fixed in the workspace route flow and guarded by regression tests.
- Warnings / blockers: none
- Approval needed: `none`

### 2026-04-28 / loop-167
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend, Recommendation
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Investigated the keyword cloud path for the requested 3x3 fixed layout. Current frontend display code already pins selected keywords first, but still returns up to 25 items and CSS uses a 5-column grid; loading currently renders a one-line text fallback instead of a same-footprint motion state. Backend and recommendation defaults still assume 10 suggestions, while heuristic/OpenAI paths retain 25-item cloud assumptions. Added `detail-026 / 키워드 클라우드 3x3 고정 배열 및 로딩 모션` as a FE / BE / Service handoff plan covering fixed 9-slot display, selected-keyword inclusion, loading skeleton/motion, and 9-suggestion service/backend alignment.
- Tests run: read-only code inspection and planning update only
- Result: Implementation is not started yet; the next work can proceed from `detail-026` with Frontend as the first owner and Backend/Recommendation alignment after the UI invariant is fixed.
- Warnings / blockers: `WorkspaceShell.tsx` remains a high-conflict file, and selected-keyword overflow behavior (>9 selected keywords) needs an explicit FE policy during implementation.
- Approval needed: `none`

### 2026-04-28 / loop-168
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.tsx`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/CanvasNodeCard.tsx`, `frontend/src/styles.css`, `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Implemented `detail-026` frontend scope. Added a fixed keyword-cloud slot constant (`9`) and updated `buildDisplayedKeywordSuggestions(...)` to keep selected keywords first, remove case-insensitive duplicates, and cap the returned cloud to nine items. Switched keyword-cloud UI rendering in both `WorkspaceShell` and `CanvasNodeCard` to a fixed 3x3 grid footprint with filler slots, and added loading-time pulse skeleton tiles that keep the same nine-slot layout instead of collapsing to a single text line. Updated styles to `repeat(3, minmax(0, 1fr))` and introduced skeleton/empty-slot visual states. Added regression coverage for helper-level nine-slot behavior and route-level nine-slot rendering plus loading skeleton visibility.
- Tests run: `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.tsx src/routes/WorkspaceShell.test.tsx src/routes/workspace-shell/workspaceShell.inlineEditor.tsx src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts src/routes/workspace-shell/CanvasNodeCard.tsx --max-warnings=0` (pass); `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); targeted `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx -t "renders at most nine keyword slots even when recommendation returns more|shows nine loading skeleton slots while keyword recommendations are in flight"` (pass, 2 tests); full focused `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts src/routes/WorkspaceShell.test.tsx src/routes/workspace-shell/workspaceShell.layout.test.ts` (pass, 66 tests)
- Result: Keyword cloud is now fixed to a 3x3 nine-slot layout with stable loading motion and selected-keyword-first display invariants at the frontend layer.
- Warnings / blockers: Backend/Recommendation default suggestion-count alignment to `9` (detail-026 BE/Service scope) remains pending and was intentionally not included in this frontend-only execution loop.
- Approval needed: `none`

### 2026-04-28 / loop-168
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend, Recommendation
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Investigated the requested fixed-node edit lock and Major Event Lane timeline-end behavior. Current frontend blocks drag/resize for `node.isFixed`, but selected fixed nodes can still render the inline textarea and related text/keyword mutation paths. The major timeline end is currently coupled to `lowestNodeBottom` across all visible lanes, and several drag/resize/drop paths update `timelineEndY` from non-major nodes. Added `detail-027 / FIX 노드 편집 잠금 및 Major 타임라인 끝점 분리` as a FE-first handoff plan with Backend/Service marked as no direct implementation for this slice.
- Tests run: read-only code inspection and planning update only
- Result: Implementation is not started yet; the next work should first block fixed-node text/keyword mutation, then split major timeline end rendering from whole-canvas stage height.
- Warnings / blockers: Many keyword-cloud files are already modified in the worktree by concurrent work, so `WorkspaceShell.tsx` and related route tests should be treated as single-writer files before implementing `detail-027`.
- Approval needed: `none`

### 2026-04-28 / loop-169
- Active milestone: Post-baseline support task
- Agents engaged: Backend, Recommendation
- Touched zones: `recommendation/src/config/env.ts`, `recommendation/src/config/env.test.ts`, `recommendation/src/provider/heuristic.ts`, `recommendation/src/provider/factory.ts`, `recommendation/src/provider/factory.test.ts`, `recommendation/src/provider/gemini.ts`, `recommendation/src/provider/openai.ts`, `recommendation/src/provider/types.ts`, `recommendation/src/orchestration/index.test.ts`, `backend/src/recommendation/routes.ts`, `backend/src/recommendation/routes.integration.test.ts`, `backend/src/app.test.ts`, `backend/.env.example`, `PLANS.md`
- What changed: Completed the remaining `detail-026` Backend/Recommendation alignment. Default keyword suggestion count is now `9` across recommendation env, Gemini/OpenAI/heuristic provider defaults, backend route fallback, and `.env.example`. The heuristic fallback service now receives the resolved backend max suggestion count, and OpenAI schema/prompt/parsing trims to the configured limit while keeping explicit override behavior intact.
- Tests run: `corepack yarn workspace @scenaairo/recommendation typecheck` (pass); `corepack yarn workspace @scenaairo/backend typecheck` (pass); `corepack yarn workspace @scenaairo/recommendation lint` (pass); `corepack yarn workspace @scenaairo/backend lint` (pass); `corepack yarn workspace @scenaairo/recommendation build` (pass); `corepack yarn workspace @scenaairo/backend build` (pass); `corepack yarn exec vitest run --pool threads recommendation/src/config/env.test.ts recommendation/src/provider/factory.test.ts recommendation/src/orchestration/index.test.ts --exclude recommendation/dist/**` (pass, 56 tests); `corepack yarn workspace @scenaairo/backend integration` (pass, 25 tests); `corepack yarn workspace @scenaairo/backend test` (pass, 19 tests); `corepack yarn workspace @scenaairo/recommendation test` (pass, 22 tests)
- Result: Backend and recommendation service now default to the same 9-slot keyword cloud contract as the frontend while preserving max-suggestion overrides.
- Warnings / blockers: Vitest/Vite commands needed sandbox escalation on Windows due `spawn EPERM`. Backend integration depends on a fresh recommendation build because backend imports the recommendation package through `dist`.
- Approval needed: `none`

### 2026-04-28 / loop-170
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/routes/workspace-shell/CanvasNodeCard.tsx`, `PLANS.md`
- What changed: Implemented `detail-027` frontend scope. Fixed nodes now render selected content as read-only text instead of a textarea, block inline persistence and object mention insertion, hide/guard keyword recommendation entry points, and close any keyword panel when a node is fixed. Major timeline rendering now uses the visual end major node bottom instead of all visible node bottoms; non-major drag/resize/delete paths no longer mutate `timelineEndY`, while stage height still grows from the whole-canvas lowest node. Major drag/resize/reorder and timeline-end handle behavior continue to update the major timeline end.
- Tests run: `corepack yarn --cwd frontend run -T eslint src/routes/WorkspaceShell.tsx src/routes/WorkspaceShell.test.tsx src/routes/workspace-shell/CanvasNodeCard.tsx --max-warnings=0` (pass); `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); focused `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx -t "fixed nodes read-only|dragging a minor below|resizing a minor below|persists inline node edits across reload|hides resize handles for fixed nodes|reorders major nodes|timeline end"` (pass, 9 tests); full `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (pass, 58 tests); `corepack yarn workspace @scenaairo/frontend build` (pass)
- Result: Fixed-node content mutation is blocked at UI and handler layers, and the major timeline arrow no longer stretches to minor/detail nodes while canvas height still accommodates them.
- Warnings / blockers: Vitest/Vite build needed sandbox escalation on Windows due `spawn EPERM`.
- Approval needed: `none`

### 2026-04-28 / loop-171
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Investigated the newly reported broad node movement instability: nodes sometimes jump downward during drag/drop and nearby nodes appear to move together. Re-read the current frontend placement pipeline and confirmed the highest-risk frontend paths are render-time `applyLaneVerticalReflow(...)` over full lanes, drag/drop `resolveNodeOverlapPlacement(...)`, and `moveNodeFreely(...) -> controller.moveNode(...)` structural reorder happening in the same interaction. Backend is currently a preservation/smoke concern rather than the likely source. Added `detail-028 / 노드 이동 안정화 종합 점검 계획` with separate Frontend and Backend ownership.
- Tests run: `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.layout.test.ts` (pass, 4 tests, outside sandbox after `spawn EPERM`); `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (pass, 58 tests, outside sandbox after `spawn EPERM`); `corepack yarn --cwd frontend test -- src/routes/WorkspaceShell.test.tsx` (fails because the package test script still loads stale broader tests: `AppRoutes.test.tsx` expects `Canvas` on an empty guest state, and `controller.reorder.test.ts` assumes seeded initial nodes).
- Result: Current focused route/layout movement-related baseline is green, but the reported UX symptoms are not yet covered by dedicated regressions. The next implementation should first add route-level reproductions for sibling movement, parent-descendant movement, and preview/drop y stability before changing reflow behavior.
- Warnings / blockers: Full frontend package test entry remains noisy due unrelated stale expectations from empty-first workspace behavior. The movement fix should keep `WorkspaceShell.tsx` effectively single-writer because it is the central drag/render file.
- Approval needed: `none`

### 2026-04-28 / loop-172
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Replanned the node movement stabilization around the user's lane-array idea. Added `detail-029 / Lane Array + Spacer 기반 노드 이동 안정화 재계획`, which supersedes the preferred implementation direction of `detail-028`: lanes should be represented internally as `node` and layout-only `spacer` blocks, drag/drop should become block movement plus spacer-height adjustment, and backend/shared persistence should stay unchanged in phase 1 by continuing to save existing `canvasX`, `canvasY`, `orderIndex`, and `parentId` fields.
- Tests run: planning update only
- Result: The recommended direction is now to adopt a frontend-only lane array + spacer layout model first, then defer any backend/shared lane-layout persistence decision until after the interaction model is stable.
- Warnings / blockers: A later backend/shared persistence model for lane arrays would trigger shared-contract/schema/version-control review and likely human approval; phase 1 explicitly avoids that scope.
- Approval needed: `none`

### 2026-04-28 / loop-173
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.laneLayout.ts`, `frontend/src/routes/workspace-shell/workspaceShell.laneLayout.test.ts`, `frontend/src/routes/workspace-shell/CanvasLaneSpacer.tsx`, `frontend/src/routes/workspace-shell/CanvasNodeCard.tsx`, `frontend/src/styles.css`, `PLANS.md`
- What changed: Implemented `detail-029` phase 1 without changing backend/shared contracts. Added a lane-array layout helper that converts each lane into `node` and layout-only `spacer` blocks, preserves saved vertical gaps as spacer height, repairs overlaps with the minimum gap, and projects drop positions into stable block slots. Switched `WorkspaceShell` render placement away from full-lane `applyLaneVerticalReflow(...)` and into lane-layout-derived node placement, rendered spacer blocks inside lane tracks, and routed draft/node drops through lane slot projection. Kept existing persistence fields (`canvasX`, `canvasY`, `orderIndex`, `parentId`) as the only saved model.
- Tests run: `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.laneLayout.test.ts` (pass, 5 tests, outside sandbox after Vite `spawn EPERM`); `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.layout.test.ts` (pass, 4 tests, outside sandbox); `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (pass, 58 tests, outside sandbox); `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); changed-file frontend eslint (pass); `corepack yarn workspace @scenaairo/backend integration` (pass, 25 tests); `corepack yarn workspace @scenaairo/frontend build` (pass outside sandbox after Vite `spawn EPERM`)
- Result: Lane rendering now uses an explicit node/spacer layout model, route regressions around major drag/timeline behavior remain green, and backend persistence smoke confirms no contract/schema change was needed.
- Warnings / blockers: Vitest and Vite build still require sandbox escalation on Windows because config loading can hit `spawn EPERM`; no product hard stop or backend/shared persistence change was introduced.
- Approval needed: `none`

### 2026-04-28 / loop-174
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend, Version Control
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Added `detail-030 / 노드 크기 DB 저장 계획` as a separate follow-up item at the user's request. The new plan keeps lane array/spacer as a frontend-only calculated model, but adds canonical node size persistence through optional `canvasWidth` and `canvasHeight` fields on nodes. It explicitly scopes the work across shared types, backend MySQL schema/store/read-write paths, frontend node size source/migration behavior, and validation gates.
- Tests run: planning update only
- Result: DB persistence for node size is now separated from `detail-029` and ready as its own implementation item.
- Warnings / blockers: Implementing `detail-030` will touch shared contracts and backend schema, so it must go through Version Control gate with rollback/backward-compatibility coverage before code changes.
- Approval needed: `none`

### 2026-04-28 / loop-175
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Planned restoration of inline object creation from unmatched `@` mention queries. Added `detail-031 / 인라인 작성 중 미등록 오브젝트 생성 복구 계획`, covering a frontend-first UX where the object mention menu shows `Create "Name" as object` when the typed query has no exact existing object match, then reuses the existing inline object token and object attach flow. Backend is scoped to existing object persistence smoke only, with no schema/API change.
- Tests run: planning update and read-only code inspection only
- Result: The missing create-from-mention UX is now separated as its own frontend-led implementation plan.
- Warnings / blockers: Existing code already auto-creates missing objects when a closed `@name@` token is present, so implementation must avoid duplicate object creation by reusing the normalized name lookup.
- Approval needed: `none`

### 2026-04-28 / loop-176
- Active milestone: Post-baseline support task
- Agents engaged: Backend, Frontend, Version Control
- Touched zones: `shared/src/types/domain.ts`, `shared/src/types/domain.d.ts`, `backend/mysql/init/001_create_cloud_projects.sql`, `backend/src/persistence/mysql-store.ts`, `backend/src/persistence/node-order.ts`, `backend/src/persistence/node-order.test.ts`, `backend/src/persistence/routes.integration.test.ts`, `frontend/src/persistence/controller.ts`, `frontend/src/persistence/controller.test.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/routes/workspace-shell/useEpisodeCanvasState.ts`, `frontend/src/routes/workspace-shell/workspaceShell.storage.ts`, `PLANS.md`
- What changed: Implemented `detail-030` node-size canonical persistence. Added optional `canvasWidth`/`canvasHeight` to `StoryNode`, added nullable MySQL columns plus bootstrap/backfill handling, persisted/read node sizes through the MySQL store, and extended reorder/canonicalization tests so size fields are preserved. Frontend controller create/update placement now accepts node size, `WorkspaceShell` resolves size as canonical DB value -> legacy localStorage fallback -> default size, and resize/create/move paths write canonical size. Hydration now avoids restoring stale episode UI timeline state on pure node position/size changes and drops stored timeline length when no major nodes remain.
- Tests run: `git diff --check` (pass); `corepack yarn workspace @scenaairo/shared typecheck` (pass); `corepack yarn workspace @scenaairo/backend typecheck` (pass); `corepack yarn workspace @scenaairo/frontend typecheck` (pass); `corepack yarn workspace @scenaairo/recommendation typecheck` (pass); `corepack yarn workspace @scenaairo/shared test` (pass, outside sandbox after `spawn EPERM`); `corepack yarn workspace @scenaairo/backend test` (pass, 19 tests); `corepack yarn workspace @scenaairo/backend integration` (pass, 25 tests); `corepack yarn workspace @scenaairo/recommendation test` (pass, 22 tests); `corepack yarn --cwd frontend run -T vitest run src/persistence/controller.test.ts src/routes/workspace-shell/workspaceShell.laneLayout.test.ts src/routes/WorkspaceShell.test.tsx` (pass, 89 tests, outside sandbox); `corepack yarn workspace @scenaairo/shared lint` (pass); `corepack yarn workspace @scenaairo/backend lint` (pass); changed-file frontend ESLint (pass); `corepack yarn build` (pass, outside sandbox after Vite `spawn EPERM`).
- Result: Node card dimensions are now part of canonical persistence while lane array/spacer remains frontend-only calculated layout. Existing nodes without size fields continue to fall back to local/default sizes.
- Warnings / blockers: Full `corepack yarn workspace @scenaairo/frontend lint` still fails on unrelated pre-existing `frontend/src/routes/AuthCallbackPage.tsx` `react-hooks/set-state-in-effect`. Requested Docker/MySQL DB reset was attempted only as far as checking Docker availability; `docker compose -f docker-compose.mysql.yml down -v` failed because Docker Desktop engine was not running, `Start-Service com.docker.service` failed due permissions, and the user then requested no Docker work. Docker service remains `Stopped`, no volume was removed, and DB recreation is intentionally not performed in this loop.
- Approval needed: `none`

### 2026-04-28 / loop-177
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend, Version Control
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/routes/workspace-shell/useEpisodeCanvasState.ts`, `frontend/src/routes/workspace-shell/workspaceShell.storage.ts`, `frontend/src/persistence/controller.test.ts`, `PLANS.md`
- What changed: Reconciled the final `detail-030` frontend patch. Resize now keeps a local active-size overlay during pointer movement but writes canonical `canvasWidth/canvasHeight` only on pointer-up. The final-major delete/timeline shrink regression was preserved by avoiding stale episode UI hydration during node position/size changes, and the route suite now includes a canonical resize reload test that clears episode UI `nodeSizes` before remounting.
- Tests run: `corepack yarn workspace @scenaairo/shared typecheck` (pass); `corepack yarn workspace @scenaairo/backend typecheck` (pass); `corepack yarn workspace @scenaairo/frontend typecheck` (pass after final edits); `corepack yarn workspace @scenaairo/shared lint` (pass); `corepack yarn workspace @scenaairo/backend lint` (pass); changed-file frontend ESLint plus storage file lint (pass); `corepack yarn --cwd backend run -T vitest run src/persistence/node-order.test.ts` (sandbox `spawn EPERM`, rerun outside sandbox pass, 1 test); `corepack yarn --cwd backend run -T vitest run --pool threads src/persistence/routes.integration.test.ts` (pass, 7 tests); `corepack yarn --cwd frontend run -T vitest run src/persistence/controller.test.ts` (sandbox `spawn EPERM`, rerun outside sandbox pass, 25 tests); `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (outside sandbox pass on rerun, 59 tests); `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.laneLayout.test.ts` (outside sandbox pass, 5 tests); `corepack yarn workspace @scenaairo/frontend build` (sandbox `spawn EPERM`, rerun outside sandbox pass); `corepack yarn workspace @scenaairo/shared build` (pass); `corepack yarn workspace @scenaairo/backend build` (pass); `corepack yarn --cwd shared run -T vitest run src/index.test.ts` (outside sandbox pass, 1 test); `git diff --check` (pass, line-ending warnings only).
- Result: Final detail-030 patch is validated with canonical-size persistence, live resize behavior, old local-size fallback, and final-major timeline shrink intact.
- Warnings / blockers: Windows sandbox still blocks some Vitest/Vite worker/config spawning with `spawn EPERM`; approved escalation was required for those commands. `corepack yarn workspace @scenaairo/shared test` picked up generated `shared/dist/index.test.js` after build, so the focused source test was used in this verification pass.
- Approval needed: `none`

### 2026-04-28 / loop-178
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: local MySQL `scenaairo_local`, `PLANS.md`
- What changed: Reset the local MySQL database requested for `detail-030`. Confirmed `MySQL80` service is running, connected with the repo default local MySQL config, dropped and recreated `scenaairo_local`, then reapplied `backend/mysql/init/001_create_cloud_projects.sql`.
- Tests run: Local MySQL connection smoke (`SELECT DATABASE(), VERSION()`) pass; schema recreation command pass; `INFORMATION_SCHEMA.COLUMNS` check confirmed `cloud_nodes.canvas_width` and `cloud_nodes.canvas_height` are nullable `double` columns; row count smoke confirmed `cloud_projects`, `cloud_nodes`, and `cloud_accounts` are empty.
- Result: Local MySQL DB is now clean and recreated from the updated schema with the new node size columns.
- Warnings / blockers: This was the local `MySQL80` service, not Docker. The reset is destructive and removed local `scenaairo_local` data as requested.
- Approval needed: `none`

### 2026-04-28 / loop-179
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: local MySQL `scenaairo_local`, `PLANS.md`
- What changed: Rechecked the user's report that the DB did not look reset. Found `scenaairo_local` had been repopulated with 1 project and 5 nodes after the previous reset, then reset the local MySQL database again by dropping/recreating `scenaairo_local` and reapplying `backend/mysql/init/001_create_cloud_projects.sql`.
- Tests run: Immediate table count smoke after reset (all 9 tables 0 rows); delayed table count smoke after 5 seconds (all 9 tables still 0 rows).
- Result: Local MySQL is currently empty and recreated from the updated schema.
- Warnings / blockers: `backend/.env` currently has `PERSISTENCE_DRIVER=file`, so visible app data may come from file persistence or browser localStorage rather than MySQL.
- Approval needed: `none`

### 2026-04-28 / loop-180
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: local MySQL `scenaairo_local`, `PLANS.md`
- What changed: Recreated the local MySQL database again on user request. Dropped and recreated `scenaairo_local`, then reapplied `backend/mysql/init/001_create_cloud_projects.sql`.
- Tests run: `cloud_nodes.canvas_width` and `cloud_nodes.canvas_height` column check (pass, nullable `double`); immediate row count smoke across all 9 tables (all 0); delayed row count smoke after 5 seconds (all 0).
- Result: Local MySQL `scenaairo_local` is recreated and empty.
- Warnings / blockers: Visible app data can still come from file persistence or browser localStorage if the app is not configured to use MySQL.
- Approval needed: `none`

### 2026-04-28 / loop-181
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: local MySQL `scenaairo_local`, `PLANS.md`
- What changed: Recreated the local MySQL database again on user request. Dropped and recreated `scenaairo_local`, then reapplied `backend/mysql/init/001_create_cloud_projects.sql`.
- Tests run: `cloud_nodes.canvas_width` and `cloud_nodes.canvas_height` column check (pass, nullable `double`); immediate row count smoke across all 9 tables (all 0); delayed row count smoke after 5 seconds (all 0).
- Result: Local MySQL `scenaairo_local` is recreated and empty.
- Warnings / blockers: Visible app data can still come from file persistence or browser localStorage if the app is not configured to use MySQL.
- Approval needed: `none`

### 2026-04-28 / loop-182
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: local MySQL `scenaairo_local`, `PLANS.md`
- What changed: Reinitialized the local MySQL database on user request. Dropped and recreated `scenaairo_local`, then reapplied `backend/mysql/init/001_create_cloud_projects.sql`.
- Tests run: `cloud_nodes.canvas_width` and `cloud_nodes.canvas_height` column check (pass, nullable `double`); immediate row count smoke across all 9 tables (all 0); delayed row count smoke after 5 seconds (all 0).
- Result: Local MySQL `scenaairo_local` is recreated and empty.
- Warnings / blockers: Visible app data can still come from file persistence or browser localStorage if the app is not configured to use MySQL.
- Approval needed: `none`

### 2026-04-28 / loop-181
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts`, `frontend/src/routes/workspace-shell/CanvasNodeCard.tsx`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Implemented `detail-031`. Added an inline object mention create-candidate helper that sanitizes open `@` mention queries, rejects blank/too-long/exact existing object names, and preserves the display casing for valid unmatched names. `WorkspaceShell` now shows `Create "Name" as object` at the bottom of the object mention menu when a typed query has no exact existing match, including partial-match states. `CanvasNodeCard` keyboard handling now treats existing suggestions and the create option as one option list, with `Enter`/`Tab` selecting the active option and `Space` remaining available for multi-word mention typing. The selection path reuses `applyObjectMentionSelection(...)` and the existing `syncInlineObjectMentions(...)` object create/attach flow.
- Tests run: `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); changed-file frontend ESLint for the detail-031 files (pass); `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts` (sandbox `spawn EPERM`, rerun outside sandbox pass, 9 tests); focused `WorkspaceShell.test.tsx` mention tests (pass, 3 tests); `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (pass, 60 tests); `corepack yarn workspace @scenaairo/frontend build` (sandbox `spawn EPERM`, rerun outside sandbox pass); `git diff --check` (pass, line-ending warnings only).
- Result: Inline editing can now recover unmatched `@` mention queries by offering a create action, while fixed nodes remain blocked from create candidates and exact existing object names continue to show only the existing object option.
- Warnings / blockers: Windows sandbox still blocks some Vitest/Vite worker/config spawning with `spawn EPERM`; approved escalation was required for those commands. No backend, schema, or shared contract change was introduced for `detail-031`.
- Approval needed: `none`

### 2026-04-28 / loop-182
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Investigated the user's report that a new Google account shows `Episode 9` and `1` folders. Confirmed folders are frontend sidebar UI state stored in localStorage, not backend folder entities. Added `detail-032 / 신규 Google 계정 로그인 후 과거 폴더 노출 방지 계획`, focused on clearing sidebar state for authenticated-empty/account transitions, removing restore-time folders whose episode ids no longer exist, and backend smoke-checking that new account project responses are empty.
- Tests run: planning update and read-only code inspection only
- Result: The issue is now scoped as a frontend stale sidebar folder cache fix with backend verification, not a folder schema/API change.
- Warnings / blockers: If backend `/api/persistence/projects` actually returns an `Episode 9` project for the reported account, the issue becomes account persistence data cleanup rather than frontend localStorage cleanup. Active persistence driver must be checked because file persistence and MySQL reset can diverge.
- Approval needed: `none`

### 2026-04-28 / loop-183
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Planned the requested connection behavior update as `detail-033 / Y축 근접 부모 연결 및 자연스러운 연결 화살표 계획`. The plan changes automatic cross-lane parent selection from order-neighbor inference to nearest Y-axis parent selection, keeps same-lane arrows as visual-only flow lines rather than `parentId`, makes connection paths use drag preview placement so arrows stretch with moving nodes, and adds the user's follow-up requirement to replace the oversized SVG arrowhead with a compact timeline-style marker.
- Tests run: planning update and read-only code inspection only
- Result: The connection task is scoped as a frontend interaction/rendering update with backend schema unchanged and existing parent-level integrity preserved.
- Warnings / blockers: Same-lane flow arrows must not be persisted as `parentId` because backend validation rejects same-level parent relationships. Existing manual rewire intent also needs a clear preservation policy when moving nodes.
- Approval needed: `none`

### 2026-04-28 / loop-184
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Revised `detail-033` after the user clarified that the previous connection behavior request itself needed a fuller plan, not only arrowhead styling. The revised plan now explicitly separates five decisions: cross-lane structure remains `parentId`, automatic parent selection uses nearest visual Y center, same-lane arrows are visual-only flow lines, drag preview placement drives live connection path updates, and connection arrowheads are restyled to a compact timeline-like marker.
- Tests run: planning update only
- Result: `detail-033` is now a complete implementation plan for automatic connection behavior, same-lane visual flow, live drag-linked arrows, and arrowhead styling.
- Warnings / blockers: Moving an existing minor/detail node can now imply parent recalculation, so the implementation must protect explicit rewire intent from being overwritten by tiny position changes.
- Approval needed: `none`

### 2026-04-28 / loop-185
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.sidebar.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.sidebar.test.tsx`, `PLANS.md`
- What changed: Implemented `detail-032`. Sidebar folder restore now sanitizes stored folders against the current snapshot and drops restore-time folders that no longer contain any valid episode. Folder pin maps and pinned object ids are also sanitized at restore. Sidebar local UI storage now uses the registry active project id rather than the authenticated-empty placeholder snapshot id, clears folder/pin/pinned-object state when no real active project exists, and gates save effects until the current project/account scope has been restored so stale state cannot be written into a new account project during transitions.
- Tests run: `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); changed-file frontend ESLint (pass); `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.sidebar.test.tsx` (sandbox `spawn EPERM`, rerun outside sandbox pass, 3 tests); focused `WorkspaceShell.test.tsx` stale sidebar restore test (sandbox `spawn EPERM`, rerun outside sandbox pass, 1 test); `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (outside sandbox pass, 61 tests); `corepack yarn workspace @scenaairo/frontend build` (sandbox `spawn EPERM`, rerun outside sandbox pass); backend focused auth persistence smoke `corepack yarn --cwd backend run -T vitest run src/auth/routes.integration.test.ts -t "returns an empty canonical project list for a new authenticated account"` (sandbox `spawn EPERM`, rerun outside sandbox pass, 1 test); `git diff --check` (pass, line-ending warnings only).
- Result: New authenticated-empty/account transition states no longer retain or persist stale sidebar folder UI, and restored project sidebar state removes legacy folders/pins whose episodes are absent from the current snapshot. Backend behavior remains unchanged and the new-account project-list smoke stays empty.
- Warnings / blockers: Windows sandbox still blocks Vitest/Vite worker/config spawning with `spawn EPERM`; approved escalation was required for affected test/build commands. Empty folders intentionally created during a live session are preserved by normal sanitization, but restore-time empty folders are treated as stale cache and removed.
- Approval needed: `none`

### 2026-04-28 / loop-186
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`, `frontend/src/routes/workspace-shell/workspaceShell.canvas.test.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/persistence/controller.ts`, `frontend/src/styles.css`, `PLANS.md`
- What changed: Implemented `detail-033`. Added Y-center nearest-parent resolution for cross-lane automatic structure links, passed explicit parent intent into node create/move persistence calls, and updated minor/detail drop behavior so moved nodes rewire to the nearest valid parent level after drop. Connection rendering now uses drag-preview placements for live endpoint updates, keeps rewire handles on structural parent-child lines only, and replaces the oversized SVG marker with a compact timeline-style arrowhead plus a blue preview marker.
- Tests run: `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); changed-file frontend ESLint for detail-033 files (pass); `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.canvas.test.ts` (sandbox `spawn EPERM`, rerun outside sandbox pass, 6 tests); focused controller tests for move/preserve/placement behavior (sandbox `spawn EPERM`, rerun outside sandbox pass, 3 tests); focused `WorkspaceShell.test.tsx` nearest-parent drag regression (sandbox `spawn EPERM`, rerun outside sandbox pass, 1 test); full `corepack yarn --cwd frontend run -T vitest run src/persistence/controller.test.ts` (outside sandbox pass, 25 tests); full `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (outside sandbox pass, 61 tests); backend `corepack yarn --cwd backend run -T vitest run src/persistence/routes.reorder.integration.test.ts` (outside sandbox pass, 2 tests); `corepack yarn workspace @scenaairo/frontend build` (sandbox `spawn EPERM`, rerun outside sandbox pass); `git diff --check` (pass, line-ending warnings only).
- Result: Cross-lane structural links now follow visual Y proximity on create/drop, same-lane flow is rendered without writing same-level `parentId`, and arrows track moving nodes through preview placement.
- Warnings / blockers: Windows sandbox still blocks Vitest/Vite worker/config spawning with `spawn EPERM`; approved escalation was required for affected commands. Explicit `moveNode(..., { preserveParent: true })` remains available for callers that must keep manual parent intent, while the canvas drag/drop path now intentionally recalculates nearest parent.
- Approval needed: `none`

### 2026-04-28 / loop-187
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`, `frontend/src/routes/workspace-shell/workspaceShell.canvas.test.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/styles.css`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Corrected the user's same-line arrow clarification for `detail-033`. Removed the automatic same-lane adjacent-node flow arrows. Same-level connection rendering now applies only when an explicit connection line exists, using top/bottom vertical anchors instead of left/right anchors. Rewire preview also switches to the vertical path while hovering a same-level target, and the compact arrowhead styling remains.
- Tests run: `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); changed-file frontend ESLint for the correction files (pass); `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.canvas.test.ts` (pass, 6 tests); focused `WorkspaceShell.test.tsx` nearest-parent drag regression (sandbox `spawn EPERM`, rerun outside sandbox pass, 1 test); full `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (outside sandbox pass, 61 tests); `corepack yarn workspace @scenaairo/frontend build` (outside sandbox pass); `git diff --check` (pass, line-ending warnings only).
- Result: Same-line arrows are no longer displayed as automatic flow guides; they are vertical only for actual connection/preview paths.
- Warnings / blockers: Windows sandbox still blocks some Vitest/Vite config spawning with `spawn EPERM`. Persistent same-level relationship semantics remain separate from this visual correction because backend parent-level validation still rejects same-level `parentId` in cloud sync.
- Approval needed: `none`

### 2026-04-28 / loop-188
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `frontend/src/persistence/controller.ts`, `frontend/src/persistence/controller.test.ts`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Investigated why folders and episodes still appeared after the `detail-032` sidebar patch. Found that episodes were not a sidebar issue: authenticated `initialize()`/`signIn()` loaded browser `account:<id>` local workspace cache before checking cloud projects, so stale local snapshots could display and re-import. Changed authenticated bootstrapping to use cloud project list first and added a regression proving stale authenticated local cache is ignored when cloud has no projects.
- Tests run: `corepack yarn --cwd frontend run -T vitest run src/persistence/controller.test.ts` (sandbox `spawn EPERM`, rerun outside sandbox pass, 26 tests); `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.sidebar.test.tsx src/routes/WorkspaceShell.test.tsx` (sandbox `spawn EPERM`, rerun outside sandbox pass, 64 tests); `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); changed-file frontend ESLint for controller/sidebar/WorkspaceShell files (pass)
- Result: New authenticated accounts now stay `authenticated-empty` when cloud has no projects, even if stale browser account-scope local snapshots still exist.
- Warnings / blockers: Existing browser localStorage keys may remain physically present, but they are no longer selected for authenticated empty accounts. Windows sandbox still blocks Vitest config loading with `spawn EPERM`.
- Approval needed: `none`

### 2026-04-28 / loop-189
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/persistence/controller.test.ts`, `PLANS.md`
- What changed: Finished the requested revised `detail-032` patch by adding the missing sign-in-path regression. The new test seeds stale `account:<id>` local workspace cache before a guest user signs in to that same empty cloud account, then proves the controller still shows `authenticated-empty`, clears the active registry, shows zero episodes/nodes, and does not import the stale local snapshot into cloud.
- Tests run: `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); changed-file frontend ESLint for controller/sidebar/WorkspaceShell files (pass); focused `corepack yarn --cwd frontend run -T vitest run src/persistence/controller.test.ts -t "ignores stale authenticated local cache|does not import guest local workspace"` (sandbox `spawn EPERM`, rerun outside sandbox pass, 3 tests); full `corepack yarn --cwd frontend run -T vitest run src/persistence/controller.test.ts` (outside sandbox pass, 27 tests); `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.sidebar.test.tsx src/routes/WorkspaceShell.test.tsx` (outside sandbox pass, 64 tests); `corepack yarn workspace @scenaairo/frontend build` (outside sandbox pass).
- Result: Revised `detail-032` now covers both authenticated initialize and guest-to-authenticated sign-in paths against stale account-scoped local cache.
- Warnings / blockers: Windows sandbox still blocks Vitest/Vite config spawning with `spawn EPERM`; affected commands were rerun outside sandbox. This does not physically delete stale localStorage entries, but prevents them from being selected or re-imported for empty cloud accounts.
- Approval needed: `none`

### 2026-04-28 / loop-190
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/persistence/controller.ts`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Corrected the second `detail-033` clarification. Y-axis nearest-parent selection now remains only in the new-node creation path. Existing minor/detail node moves preserve the current `parentId` and update only placement/order, and the temporary `moveNode(..., { parentIdOverride })` option was removed. The route regression was changed back to prove a dragged minor remains connected to its original major even when moved below another major.
- Tests run: `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); changed-file frontend ESLint for route/controller files (pass); `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.canvas.test.ts` (pass, 6 tests); focused `WorkspaceShell.test.tsx` movement parent-preservation test (sandbox `spawn EPERM`, rerun outside sandbox pass, 1 test); focused controller parent-preservation tests (sandbox `spawn EPERM`, rerun outside sandbox pass, 2 tests); full `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (outside sandbox pass, 61 tests); full `corepack yarn --cwd frontend run -T vitest run src/persistence/controller.test.ts` (outside sandbox pass, 27 tests); `corepack yarn workspace @scenaairo/frontend build` (outside sandbox pass); `git diff --check` (pass, line-ending warnings only).
- Result: New nodes still choose the nearest valid parent by Y on creation, while moving existing nodes no longer changes their connection.
- Warnings / blockers: Windows sandbox still blocks some Vitest/Vite config spawning with `spawn EPERM`; affected commands were rerun outside sandbox.
- Approval needed: `none`

### 2026-04-28 / loop-191
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Planned `detail-034 / 노드 및 연결선 드래그 중 캔버스 자동 스크롤 계획` for the user's request that node moves and connection-line rewire drags should keep moving when the pointer reaches the visible canvas top/bottom. The plan introduces a frontend-only vertical auto-scroll loop for `node-drag` and `rewire-drag`, refactors drag preview updates so scrolling without new pointer movement still updates node/line positions, and keeps backend persistence unchanged.
- Tests run: planning update and read-only code inspection only
- Result: Auto-scroll is now scoped as a frontend canvas interaction follow-up with shared helper tests and route-level smoke coverage.
- Warnings / blockers: The implementation must avoid jitter between pointermove and requestAnimationFrame updates and must stop the animation loop on pointerup/pointercancel/unmount.
- Approval needed: `none`

### 2026-04-28 / loop-192
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/WorkspaceSidebarRecents.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/persistence/controller.ts`, `frontend/src/persistence/controller.test.ts`, `frontend/src/copy.ts`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Implemented `detail-035`. Guest workspaces with zero episodes now render the normal shell and empty canvas instead of an episode-create empty-state screen, and the obsolete empty/locked episode copy was removed. Sidebar episode delete actions are no longer disabled for the last remaining episode. `WorkspacePersistenceController.deleteEpisode(...)` now allows deleting the last episode and clears `project.activeEpisodeId` to `""` when no episodes remain.
- Tests run: `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); changed-file frontend ESLint (pass); focused `controller.test.ts` episode delete regression (sandbox `spawn EPERM`, rerun outside sandbox pass, 1 test); focused `WorkspaceShell.test.tsx` last-episode UI regression (sandbox `spawn EPERM`, rerun outside sandbox pass, 1 test); full `corepack yarn --cwd frontend run -T vitest run src/persistence/controller.test.ts src/routes/WorkspaceShell.test.tsx` (outside sandbox pass, 90 tests).
- Result: A project can now be left with zero episodes without being forced into an episode creation prompt.
- Warnings / blockers: Node/object/drawer data still requires an episode scope; when the last episode is deleted, those episode-scoped records are removed with it.
- Approval needed: `none`

### 2026-04-28 / loop-193
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`, `frontend/src/routes/workspace-shell/workspaceShell.canvas.test.ts`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Implemented the `detail-034` auto-scroll patch. Added a shared vertical edge-speed helper, added a requestAnimationFrame auto-scroll loop for active `node-drag` and `rewire-drag`, and refactored drag preview updates so the same stored pointer coordinate is reapplied after viewport scrolling. Node drag preview now expands stage height while dragging, and rewire preview uses the current scrolled stage rect for endpoint and hover recalculation.
- Tests run: `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); changed-file frontend ESLint (pass); `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.canvas.test.ts` (pass, 7 tests); focused `WorkspaceShell.test.tsx` node drag auto-scroll smoke (sandbox `spawn EPERM`, rerun outside sandbox pass, 1 test); full `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (pass, 63 tests); `corepack yarn workspace @scenaairo/frontend build` (sandbox `spawn EPERM`, rerun outside sandbox pass); `git diff --check` (pass, line-ending warnings only).
- Result: Dragging a node or rewire line near the visible canvas top/bottom now scrolls the canvas vertically and keeps the live preview in sync.
- Warnings / blockers: Windows sandbox still blocks some Vite config loads with `spawn EPERM`; affected build/focused Vitest commands were rerun outside sandbox. Horizontal auto-scroll remains out of scope per `detail-034`.
- Approval needed: `none`

### 2026-04-28 / loop-194
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Implemented `detail-036`. Added a shared object mention match-name normalizer and applied it to inline object creation candidate checks, mention signatures, existing-object lookup during node sync, and suggestion filtering. The node editor now treats `Hero` and `hero` as the same object for `@` mention search/create behavior, so casing-only differences cannot produce a new create option.
- Tests run: `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); changed-file frontend ESLint (pass); focused object mention Vitest run (sandbox `spawn EPERM`, rerun outside sandbox pass, 3 tests); full `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts src/routes/WorkspaceShell.test.tsx` (outside sandbox pass, 72 tests).
- Result: `@hero` resolves against existing `Hero` instead of offering duplicate object creation.
- Warnings / blockers: Backend uniqueness was not changed; this patch covers the node text editor mention path only.
- Approval needed: `none`

### 2026-04-28 / loop-195
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`, `frontend/src/routes/workspace-shell/workspaceShell.canvas.test.ts`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Revised the `detail-034` auto-scroll edge policy after the user's clarification. Auto-scroll now clips the canvas viewport rect to the browser-visible viewport before computing top/bottom edge velocity, so a drag near the browser screen bottom can scroll the canvas even when the canvas element itself continues below the visible screen. The patch keeps scrolling scoped to the canvas viewport and does not move document/window scroll.
- Tests run: `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); changed-file frontend ESLint (pass); `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.canvas.test.ts` (pass, 8 tests); focused `WorkspaceShell.test.tsx` browser-bottom auto-scroll regression (sandbox `spawn EPERM`, rerun outside sandbox pass, 1 test); full `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (pass, 63 tests); `corepack yarn workspace @scenaairo/frontend build` (pass); `git diff --check` (pass, line-ending warnings only).
- Result: Node/rewire drag auto-scroll now responds to the visible browser top/bottom boundary, not only the raw canvas viewport boundary.
- Warnings / blockers: Horizontal auto-scroll remains out of scope. Existing dirty inline-editor files are unrelated `detail-036` work and were not touched by this correction.
- Approval needed: `none`

### 2026-04-28 / loop-196
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend, Recommendation
- Touched zones: `DETAILPLAN.md`, `PLANS.md`, read-only review of `C:\Users\rladu\Downloads\GEMINI_PROVIDER_RECOMMENDATION_PRD.md`, `recommendation/src/contracts/index.ts`, `recommendation/src/context/index.ts`, `recommendation/src/provider/gemini.ts`, `recommendation/src/provider/heuristic.ts`, `frontend/src/recommendation/request.ts`, `backend/src/recommendation/routes.ts`
- What changed: Planned `detail-037 / Gemini Provider Structured Context 추천 품질 개선 계획` from the handoff PRD. The plan keeps the `KeywordSuggestion { label, reason }` response shape, moves the recommendation request path from flat anchors toward structured current/direct/flow/episode/object context, and chooses request-time structured context assembly for the first implementation instead of persistent summaries, RAG, or fine-tuning.
- Tests run: planning update and read-only code inspection only
- Result: Gemini recommendation work is scoped as a contract/context/provider migration with frontend request assembly and backend route/cache adjustments, while summary storage/RAG remain deferred until cross-episode or large-project context becomes first-class.
- Warnings / blockers: Any contract change must update frontend, backend, recommendation package, standalone client, and tests together. Folder context remains deferred because sidebar folders are currently frontend-local rather than shared/backend persistence.
- Approval needed: `none`

### 2026-04-28 / loop-197
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Corrected the `detail-034` browser-edge auto-scroll behavior after the user's follow-up. The auto-scroll loop now computes separate canvas and window vertical velocities. When a node or rewire drag reaches the browser viewport top/bottom, document/window scroll advances; when the pointer is also near the visible canvas edge, the canvas viewport scrollTop advances as before. Preview recomputation still runs after both scroll updates using the current stage rect.
- Tests run: `corepack yarn --cwd frontend run -T tsc -p tsconfig.app.json --noEmit` (pass); changed-file frontend ESLint (pass); `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.canvas.test.ts` (pass, 8 tests); focused `WorkspaceShell.test.tsx` browser-bottom auto-scroll regression (sandbox `spawn EPERM`, rerun outside sandbox pass, 1 test); full `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (pass, 63 tests); `corepack yarn workspace @scenaairo/frontend build` (pass); `git diff --check` (pass, line-ending warnings only).
- Result: Dragging near the browser screen edge now moves the page window and keeps canvas auto-scroll/preview sync intact.
- Warnings / blockers: Horizontal auto-scroll remains out of scope. Existing dirty inline-editor/detail-037 files are unrelated to this correction and were not modified.
- Approval needed: `none`

### 2026-04-28 / loop-198
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Clarified the user's question about `detail-029` phase 2. Moved the lane-layout follow-up to `detail-039 / detail-029 2차 Lane Layout Persistence 검토 계획` to explicitly track that phase 1 lane-array/spacer rendering was implemented, `detail-030` separately implemented node size persistence, but lane array/spacer canonical persistence itself remains unimplemented and intentionally deferred.
- Tests run: planning update and read-only code inspection only
- Result: The remaining `detail-029` phase 2 decision is now visible as a separate follow-up gate: continue frontend-calculated lane layout unless reload/cross-device drag stability proves that additional layout persistence is necessary.
- Warnings / blockers: Persisting lane arrays or spacer state would require shared contract/schema/API changes, compatibility work, Version Control gate review, and human approval.
- Approval needed: `none`

### 2026-04-28 / loop-199
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend, Recommendation
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Added `detail-038 / Structured Context 중요도 랭킹 및 압축 계획` after the user clarified that snapshot-derived context is too flat without importance. The new plan defines ranked context items with `source`, `role`, `priorityScore`, `distance`, and compression policy so Gemini receives prioritized current-node, direct-connection, same-lane, major-flow, object, and episode context instead of a simple snapshot dump.
- Tests run: planning update only
- Result: `detail-037` now covers request-time structured context, while `detail-038` covers ranking, token-budget trimming, and prompt priority semantics.
- Warnings / blockers: This remains contract/context work; implementation must update frontend request assembly, recommendation context types, provider prompts, backend validation/cache, and tests together.
- Approval needed: `none`

### 2026-04-28 / loop-200
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend, Recommendation
- Touched zones: `frontend/src/recommendation/request.ts`, `frontend/src/recommendation/request.test.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `recommendation/src/contracts/index.ts`, `recommendation/src/context/index.ts`, `recommendation/src/provider/gemini.ts`, `recommendation/src/provider/heuristic.ts`, `recommendation/src/provider/factory.test.ts`, `backend/src/recommendation/routes.ts`, `backend/src/recommendation/routes.structured.test.ts`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Implemented `detail-037`. Frontend keyword/sentence recommendation requests now send request-time structured context with current node, direct links, major lane flow sorted by canvasY, episode/object context, language, selected keywords, open-slot `maxSuggestions`, and ranked priority items. Recommendation context conversion preserves legacy story compatibility, Gemini now receives structured priority/source sections and filters selected duplicates, sentence-like labels, and pure emotion/category labels, while heuristic fallback reads structured anchors but keeps the existing seed keyword order. Backend route handling validates the structured shape, clamps request max suggestions against server config, and includes structured context, selected keywords, and max suggestions in keyword cache keys.
- Tests run: `corepack yarn workspace @scenaairo/recommendation typecheck` (pass); `corepack yarn workspace @scenaairo/frontend typecheck` (pass); `corepack yarn workspace @scenaairo/backend typecheck` (pass); recommendation lint (pass); changed-file frontend ESLint (pass); changed-file backend ESLint (pass); `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx src/recommendation/request.test.ts` (outside sandbox pass, 65 tests); `corepack yarn --cwd recommendation run -T vitest run src/provider/factory.test.ts src/orchestration/index.test.ts src/config/env.test.ts` (outside sandbox pass, 30 tests); `corepack yarn --cwd backend run -T vitest run src/recommendation/routes.structured.test.ts src/recommendation/routes.integration.test.ts` (outside sandbox pass, 13 tests); recommendation/backend/frontend build smoke (pass); `git diff --check` (pass, line-ending warnings only).
- Result: Keyword recommendation requests now carry enough structured current-screen context for Gemini without adding summary storage, RAG, fine-tuning, schema changes, or changing the public `KeywordSuggestion { label, reason }` response shape.
- Warnings / blockers: Frontend and recommendation runtime tests needed outside-sandbox execution because Windows worker spawning still fails with `spawn EPERM`. Existing unrelated dirty canvas/inline-editor files remain in the worktree and were not reverted.
- Approval needed: `none`

### 2026-04-28 / loop-201
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend, Recommendation
- Touched zones: `recommendation/src/contracts/index.ts`, `recommendation/src/context/index.ts`, `recommendation/src/provider/gemini.ts`, `recommendation/src/provider/heuristic.ts`, `recommendation/src/provider/factory.test.ts`, `frontend/src/recommendation/request.ts`, `frontend/src/recommendation/request.test.ts`, `backend/src/recommendation/routes.ts`, `backend/src/recommendation/routes.structured.test.ts`, `PLANS.md`
- What changed: Implemented `detail-038`. Added ranked structured context items to the shared contract, frontend request assembly, recommendation context normalization, Gemini prompt sections, provider cache key material, heuristic anchors, and backend route validation. Ranking now preserves current-node priority, selected keyword priority metadata, direct/object/episode/major-flow roles, distance/canvas metadata, and low-priority compression before provider execution.
- Tests run: `corepack yarn workspace @scenaairo/recommendation typecheck` (pass); `corepack yarn workspace @scenaairo/backend typecheck` (pass); `corepack yarn workspace @scenaairo/frontend typecheck` (pass); `corepack yarn --cwd frontend run -T vitest run src/recommendation/request.test.ts` (outside sandbox pass, 1 test); `corepack yarn workspace @scenaairo/recommendation test` (sandbox `spawn EPERM`, rerun outside sandbox pass, 24 tests); `corepack yarn --cwd backend run -T vitest run src/recommendation/routes.integration.test.ts` (outside sandbox pass, 10 tests); `corepack yarn --cwd backend run -T vitest run src/recommendation/routes.structured.test.ts` (sandbox `spawn EPERM`, rerun outside sandbox pass, 3 tests); `corepack yarn workspace @scenaairo/backend test` (outside sandbox pass, 19 tests); changed-file ESLint for frontend recommendation files, recommendation package lint, and backend recommendation route files (pass); `corepack yarn build` (sandbox `spawn EPERM`, rerun outside sandbox pass)
- Result: Gemini and heuristic recommendation flows now receive prioritized ranked context instead of treating snapshot-derived context as a flat dump. Backend rejects malformed ranked items, including non-object array entries, and no DB schema changes were needed.
- Warnings / blockers: Windows sandbox still blocks some Vite/Vitest child process spawning with `spawn EPERM`; affected validation was rerun outside sandbox. Existing unrelated dirty files from earlier detail work remain in the worktree and were not reverted.
- Approval needed: `none`

### 2026-04-28 / loop-202
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/persistence/controller.ts`, `frontend/src/persistence/controller.test.ts`, `PLANS.md`
- What changed: Changed node delete behavior before the next phase. The canvas delete action now computes each direct child's replacement parent with the same visual Y-nearest upper-lane rule used for creation, then calls a new persistence controller path that deletes only the selected node and rewires direct children instead of deleting the whole subtree. The controller validates replacement parents against project, episode, level, and cycle rules, and nulls temporary-drawer source references when the deleted node was the source.
- Tests run: `corepack yarn --cwd frontend run -T vitest run src/persistence/controller.test.ts -t "deletes only the selected parent|reconnects same-lane"` (sandbox `spawn EPERM`, rerun outside sandbox pass, 2 tests); `corepack yarn --cwd frontend run -T vitest run src/persistence/controller.test.ts` (outside sandbox pass, 29 tests); `corepack yarn --cwd frontend run -T eslint src/persistence/controller.ts src/persistence/controller.test.ts src/routes/WorkspaceShell.tsx` (pass); `corepack yarn workspace @scenaairo/frontend build` (pass).
- Result: Deleting a parent no longer removes its child chain. Direct children remain on canvas and reconnect to the nearest valid upper-lane node; descendants below those children keep their existing parent links.
- Warnings / blockers: No DB/schema change was made. Existing dirty recommendation, auto-scroll, and inline-editor files are unrelated to this deletion fix and were not reverted.
- Approval needed: `none`

### 2026-04-29 / loop-203
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend, Recommendation
- Touched zones: `DETAILPLAN.md`, `PLANS.md`, read-only review of `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/WorkspaceObjectPanel.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.sidebar.tsx`, `frontend/src/routes/workspace-shell/CanvasNodeCard.tsx`, `backend/src/recommendation/routes.ts`, `recommendation/src/provider/gemini.ts`
- What changed: Added `detail-040 / Workspace 편집 UX 안정화 계획` for the seven requested interaction fixes. The plan splits immediate frontend fixes for folder Enter submit, one-line object summary, canvas-scoped undo/redo, and keyword refresh from second-phase episode updatedAt semantics and inline object token atomic editing. Connection-line direct dragging is recorded as a third-phase UX follow-up.
- Tests run: planning update and read-only code inspection only
- Result: The work is now divided by frontend/backend/recommendation ownership, with cache bypass identified as the one item that must cross frontend request, backend route cache, and Gemini provider cache.
- Warnings / blockers: Episode recent-modified sorting should reuse existing `StoryEpisode.updatedAt`; no new queue/stack structure is recommended. Object token protection should be solved in the frontend editor before considering backend name uniqueness.
- Approval needed: `none`

### 2026-04-29 / loop-204
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend, Recommendation
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/routes/workspace-shell/WorkspaceObjectPanel.tsx`, `frontend/src/recommendation/request.ts`, `frontend/src/recommendation/request.test.ts`, `recommendation/src/contracts/index.ts`, `recommendation/src/context/index.ts`, `recommendation/src/provider/gemini.ts`, `recommendation/src/provider/factory.test.ts`, `backend/src/recommendation/routes.ts`, `backend/src/recommendation/routes.structured.test.ts`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Implemented `detail-040` phase 1. Folder creation now submits on Enter and cancels on Escape, object summary uses a one-line input with newline normalization, canvas undo/redo is gated by workspace interaction scope, keyword cloud refresh sends `cacheBypass: true`, stale refresh responses are ignored, and backend/Gemini keyword caches are skipped only for bypass requests.
- Tests run: `corepack yarn workspace @scenaairo/recommendation typecheck` (pass); `corepack yarn workspace @scenaairo/backend typecheck` (pass); `corepack yarn workspace @scenaairo/frontend typecheck` (pass); changed-file frontend ESLint (pass); changed-file backend recommendation ESLint (pass); recommendation lint (pass); `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx src/recommendation/request.test.ts` (outside sandbox pass, 65 tests); `corepack yarn --cwd recommendation run -T vitest run src/provider/factory.test.ts` (outside sandbox pass, 21 tests); `corepack yarn --cwd backend run -T vitest run src/recommendation/routes.structured.test.ts` (outside sandbox pass, 5 tests); frontend/backend/recommendation build smoke (pass).
- Result: The immediate edit UX bugs and keyword refresh cache issue are fixed without schema changes. Phase 2 episode updatedAt semantics and object-token atomic editing remain intentionally deferred.
- Warnings / blockers: Windows sandbox still blocks Vitest worker startup with `spawn EPERM`, so focused tests were rerun outside sandbox. `detail-040` phase 2 and 3 remain open by plan.
- Approval needed: `none`

### 2026-04-29 / loop-204
- Active milestone: Post-baseline support task
- Agents engaged: Backend, Recommendation
- Touched zones: `backend/src/recommendation/routes.ts`, `backend/src/recommendation/routes.structured.test.ts`, `recommendation/src/contracts/index.ts`, `recommendation/src/context/index.ts`, `recommendation/src/provider/gemini.ts`, `recommendation/src/provider/factory.test.ts`, `PLANS.md`
- What changed: Implemented the backend/recommendation slice of `detail-040` keyword refresh cache bypass. Added `cacheBypass?: boolean` to keyword recommendation requests and provider context, validated the flag in the backend keyword route, skipped backend keyword cache read/write when true, logged `keyword_cache_bypass`, and made Gemini provider skip its internal keyword cache on bypassed contexts. After the user clarified backend scope, frontend UI/request edits from this loop were reverted and left out of the patch.
- Tests run: `corepack yarn workspace @scenaairo/recommendation typecheck` (pass); `corepack yarn workspace @scenaairo/recommendation build` (pass); `corepack yarn workspace @scenaairo/recommendation lint` (pass); `corepack yarn workspace @scenaairo/recommendation test` (outside sandbox pass, 25 tests); `corepack yarn workspace @scenaairo/backend typecheck` (pass); changed-file backend ESLint for recommendation route files (pass); `corepack yarn workspace @scenaairo/backend build` (pass); `corepack yarn --cwd backend run -T vitest run src/recommendation/routes.structured.test.ts` (outside sandbox pass, 5 tests); `corepack yarn workspace @scenaairo/backend test` (outside sandbox pass, 19 tests)
- Result: Backend and Gemini cache layers now have a dedicated keyword refresh bypass path without DB schema changes and without changing sentence recommendation requests.
- Warnings / blockers: Windows sandbox still blocks Vitest child process spawning with `spawn EPERM`; affected tests were run outside sandbox. Frontend still needs a separate owner to send `cacheBypass: true` from the refresh button.
- Approval needed: `none`

### 2026-04-29 / loop-205
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Added `detail-041 / Workspace 생성·삭제 키보드 상호작용 공통화 계획` after the user clarified that keyboard interaction must not be limited to folder Enter submit. The new plan absorbs the narrow folder Enter work into a workspace-wide keyboard command policy covering episode/folder/object creation on Enter, Delete-to-confirm for episode/folder/object/node targets, input/editor/mention-menu exceptions, and confirm dialog Enter/Escape behavior.
- Tests run: planning update only
- Result: Frontend ownership is now keyboard routing, focus scope, creation form submit, and destructive confirm UX. Backend ownership is limited to existing delete side-effect consistency; no schema/API/DB change is planned.
- Warnings / blockers: Existing in-progress implementation changes from the interrupted loop were not expanded in this planning update. Before implementation, frontend patches should be reconciled against `detail-041` so folder-only behavior is not treated as complete.
- Approval needed: `none`

### 2026-04-29 / loop-206
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Expanded `detail-040` with a dedicated `40.7 2차 구현 계획`. The second phase is now split into Track A for episode recent-modified semantics (`selectEpisode()` must not touch episode `updatedAt`; node/object/structure mutations must touch it) and Track B for inline object token atomic editing (object token range parser, caret boundary snap, internal edit blocking, 2-step object token delete, keyword token edit preservation).
- Tests run: planning update only
- Result: `detail-040` phase 2 now has implementation order, frontend/backend ownership, validation gates, and completion criteria instead of only high-level remaining items.
- Warnings / blockers: Track B must be implemented together with `detail-041` keyboard shortcut exceptions so inline Delete for object-token editing does not conflict with entity Delete confirm shortcuts.
- Approval needed: `none`

### 2026-04-29 / loop-207
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Corrected the phase-2 plan placement after the user clarified it should be a new numbered detail. The former `40.7` phase-2 content is now promoted to `detail-042 / Workspace 편집 UX 2차 안정화 계획`, while `detail-040` only points to `detail-042` for the remaining episode updatedAt and inline object-token work.
- Tests run: planning update only
- Result: Detail numbering is now aligned: `detail-040` remains the phase-1 UX stabilization container, `detail-041` covers common creation/delete keyboard policy, and `detail-042` owns the phase-2 recent-modified + atomic token plan.
- Warnings / blockers: `loop-206` remains as historical log context, but the current source of truth is `detail-042`.
- Approval needed: `none`

### 2026-04-29 / loop-208
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: `backend/src/persistence/routes.integration.test.ts`, `PLANS.md`
- What changed: Implemented the backend verification slice of `detail-042` Track A. Added a persistence integration regression that imports a project with an older episode `updatedAt`, verifies a node-only sync does not invent a new episode modified timestamp, then verifies an explicit episode upsert roundtrips the frontend-provided `updatedAt` through sync and get responses.
- Tests run: `corepack yarn --cwd backend run -T vitest run src/persistence/routes.integration.test.ts -t "preserves episode updatedAt"` (sandbox `spawn EPERM`, rerun outside sandbox pass, 1 test); `corepack yarn workspace @scenaairo/backend typecheck` (pass); changed-file backend ESLint for `src/persistence/routes.integration.test.ts` (pass); `corepack yarn --cwd backend run -T vitest run src/persistence/routes.integration.test.ts` (outside sandbox pass, 8 tests); `corepack yarn workspace @scenaairo/backend test` (pass, 20 tests); `corepack yarn workspace @scenaairo/backend build` (pass)
- Result: Backend file persistence now has explicit coverage for the `detail-042` contract: episode `updatedAt` is preserved exactly as supplied by frontend/controller state, and backend does not reinterpret node-only sync as an episode modification.
- Warnings / blockers: No DB schema or API contract change was made. MySQL code already stores/reconstructs `cloud_episodes.updated_at`, but no live MySQL integration was run in this loop.
- Approval needed: `none`

### 2026-04-29 / loop-209
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend, Recommendation
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/routes/workspace-shell/WorkspaceObjectPanel.tsx`, `frontend/src/routes/workspace-shell/WorkspaceSidebarRecents.tsx`, `frontend/src/recommendation/request.ts`, `frontend/src/recommendation/request.test.ts`, `backend/src/recommendation/routes.ts`, `backend/src/recommendation/routes.structured.test.ts`, `recommendation/src/contracts/index.ts`, `recommendation/src/context/index.ts`, `recommendation/src/provider/gemini.ts`, `recommendation/src/provider/factory.test.ts`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Repatched `detail-040` and implemented the practical `detail-041` keyboard policy slice. Restored frontend cache bypass payloads, one-line object summary input, folder Enter/Escape form behavior, canvas-scoped history controls, stale keyword refresh guarding, sidebar/object Delete-to-confirm routing, folder/object confirm dialogs, and focused row metadata for sidebar/object keyboard targets.
- Tests run: `corepack yarn workspace @scenaairo/frontend typecheck` (pass); changed-file frontend ESLint (pass); `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx src/recommendation/request.test.ts` (outside sandbox pass, 71 tests); `corepack yarn workspace @scenaairo/recommendation typecheck` (pass); recommendation lint (pass); `corepack yarn --cwd recommendation run -T vitest run src/provider/factory.test.ts` (outside sandbox pass, 21 tests); `corepack yarn workspace @scenaairo/backend typecheck` (pass); changed-file backend recommendation ESLint (pass); `corepack yarn --cwd backend run -T vitest run src/recommendation/routes.structured.test.ts` (outside sandbox pass, 5 tests); frontend/backend/recommendation build smoke (pass); `git diff --check` (pass, line-ending warnings only).
- Result: 40번 immediate UX fixes and 41번 folder/object/sidebar Delete confirm behavior are now implemented together. New Episode remains the existing button-based immediate creation path; adding a dedicated episode-title creation input is left as a separate UI change if needed.
- Warnings / blockers: Windows sandbox still blocks Vitest worker startup with `spawn EPERM`, so focused Vitest runs used the approved outside-sandbox path. Existing `backend/src/persistence/routes.integration.test.ts` changes from loop-208 remain in the worktree and were not modified by this patch.
- Approval needed: `none`

### 2026-04-29 / loop-210
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/persistence/controller.ts`, `frontend/src/persistence/controller.test.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/routes/workspace-shell/CanvasNodeCard.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Implemented the frontend slice of `detail-042`. `selectEpisode()` now changes active episode without touching episode `updatedAt`, while node/object/drawer/rewire/placement/delete/restore/paste mutations touch the owning episode in the same persistence transaction. Root recent stories therefore stay in modified order, not viewed order. Inline object mentions now use object-token range parsing, caret/selection snapping, internal edit and paste blocking, two-step Backspace/Delete removal, and explicit-create-only object creation. Keyword token editing remains separate from object-token atomic behavior.
- Tests run: `corepack yarn workspace @scenaairo/frontend typecheck` (pass); changed-file frontend ESLint for the detail-042 files (pass); `corepack yarn --cwd frontend run -T vitest run src/persistence/controller.test.ts src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts` (sandbox `spawn EPERM`, rerun outside sandbox pass, 44 tests); `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts` (sandbox `spawn EPERM`, rerun outside sandbox pass, 13 tests after paste guard refinement); `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (pass, 71 tests); `corepack yarn workspace @scenaairo/frontend build` (pass).
- Result: Episode list order changes only after real edits, and object-token partial edit paths no longer create typo objects. Inline Delete remains inside the editor and does not trigger workspace destructive-confirm shortcuts.
- Warnings / blockers: Windows sandbox still intermittently blocks Vitest/Vite config loading with `spawn EPERM`; affected focused tests were rerun outside sandbox. Existing backend/recommendation dirty files from earlier loops remain in the worktree and were not reverted.
- Approval needed: `none`

### 2026-04-29 / loop-210
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Added `detail-043 / 연결선·화살표 직접 드래그 UX 계획` as the new index for the former `detail-040` phase-3 follow-up. The plan covers visible path vs transparent hit path separation, hover/active affordance, direct drag-to-rewire state, nearest valid parent highlighting, scroll-synced preview updates, compact arrowhead styling, and pointer-event collision rules.
- Tests run: planning update only
- Result: Third-phase work is now isolated from `detail-040`: frontend owns the direct manipulation UX and reuses existing parent rewire paths; backend keeps the existing `parentId` persistence/validation model with no schema/API change.
- Warnings / blockers: This should be implemented after the current keyboard/token work is stable because connection drag, canvas pan, node drag, and auto-scroll share pointer-event ownership.
- Approval needed: `none`

### 2026-04-29 / loop-211
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.canvas.ts`, `frontend/src/routes/workspace-shell/workspaceShell.canvas.test.ts`, `frontend/src/styles.css`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Implemented `detail-043`. Connection rendering now includes a transparent wide hit path that shares the visible path geometry, hover/active styling, compact active arrowhead, and a midpoint drag grip. Dragging a connection hit path or existing endpoint port starts the same rewire preview flow, highlights the candidate parent, commits via the existing `controller.rewireNode()` path on valid drop, and preserves the original parent on invalid drop.
- Tests run: `corepack yarn workspace @scenaairo/frontend typecheck` (pass); changed-file frontend ESLint for TS/TSX files (pass; CSS is not covered by this ESLint config); `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.canvas.test.ts` (pass, 8 tests); `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (pass, 73 tests); `corepack yarn workspace @scenaairo/frontend build` (pass); `git diff --check` (pass, line-ending warnings only).
- Result: Users can now grab the connection line/arrow area directly to rewire a child node without relying only on the small endpoint handles.
- Warnings / blockers: No backend/schema/API change was made. Existing dirty backend/recommendation files from earlier loops remain in the worktree and were not modified by this patch.
- Approval needed: `none`

### 2026-04-29 / loop-212
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/persistence/controller.ts`, `frontend/src/persistence/controller.test.ts`, `frontend/src/routes/WorkspaceShell.test.tsx`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Implemented `detail-044`. Canvas undo/redo history is now keyed by active/owning episode instead of one global stack. Episode create/select/rename/delete no longer create canvas history entries, deleted episode stacks are purged, and historical undo/redo application merges only that episode's episode/node/object/drawer slices while preserving the current `project.activeEpisodeId` and other episodes' latest data.
- Tests run: `corepack yarn workspace @scenaairo/frontend typecheck` (pass); changed-file frontend ESLint for controller and WorkspaceShell tests (pass); focused controller episode-scoped history Vitest (sandbox `spawn EPERM`, rerun outside sandbox pass, 1 test); focused WorkspaceShell keyboard scoped-history Vitest (outside sandbox pass, 1 test); full `corepack yarn --cwd frontend run -T vitest run src/persistence/controller.test.ts` (outside sandbox pass, 32 tests); full `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (outside sandbox pass, 74 tests); `corepack yarn workspace @scenaairo/frontend build` (pass); `git diff --check` (pass, line-ending warnings only).
- Result: Ctrl+Z / Ctrl+Y now operate against the currently selected episode's canvas history and no longer jump back to another episode or overwrite another episode's newer canvas data.
- Warnings / blockers: Multi-episode object-reference edits are still treated by their primary owning episode for history ownership; no schema/API/backend change was made.
- Approval needed: `none`

### 2026-04-29 / loop-213
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Implemented `detail-045`. Removed the first-major-node special case that stretched the node to the main-event timeline span, so first major nodes now persist with the same default card size as other created nodes. The main-event timeline end now keeps `initialTimelineEndY` as a minimum instead of collapsing to the only/last major node bottom, and related timeline movement/resize guards use the same minimum.
- Tests run: `corepack yarn workspace @scenaairo/frontend typecheck` (pass); changed-file frontend ESLint for WorkspaceShell files (pass); focused timeline Vitest for first node/timeline end cases (sandbox `spawn EPERM`, rerun outside sandbox pass, 6 tests); full `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (outside sandbox pass, 74 tests); `corepack yarn workspace @scenaairo/frontend build` (pass); `git diff --check` (pass, line-ending warnings only).
- Result: Creating the first major node no longer produces an oversized card, while the main-event lane arrow remains long enough to leave room for adding additional major nodes.
- Warnings / blockers: The timeline end can still extend when major nodes are deliberately moved below the current minimum; no persistence schema/API change was made.
- Approval needed: `none`

### 2026-04-29 / loop-214
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend, Recommendation
- Touched zones: `DETAILPLAN.md`, `PLANS.md`, read-only review of `frontend/src/recommendation/request.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `backend/src/recommendation/routes.ts`, `recommendation/src/context/index.ts`, `recommendation/src/provider/gemini.ts`
- What changed: Investigated the keyword cloud refresh and empty-node language issue, then added `detail-046 / 키워드 추천 refresh·언어 추론·LLM 재시도 안정화 계획`. Current code already sends `cacheBypass: true` from refresh and skips backend/Gemini keyword caches, but it does not send a refresh nonce or excluded current suggestion labels, so a fresh LLM call can still produce the same labels. The language bug is explained by frontend request assembly: `structuredContext.language` is detected only from the current node text, so an empty current node defaults to `en` even when parent/same-lane/flow context is Korean. Gemini keyword calls currently attempt once, then may fallback or error; the new plan requires 3 total LLM attempts and a visible error if all fail.
- Tests run: planning update and read-only code inspection only
- Result: The fix is now split by ownership: frontend must strengthen refresh payloads and context-based language detection, backend must validate new refresh fields and avoid hiding refresh LLM failures with heuristic fallback, and recommendation must add Gemini retry plus prompt/output filtering for excluded labels.
- Warnings / blockers: Refresh cache bypass alone is not enough to guarantee visibly new words; the prompt also needs previous-suggestion exclusion or a refresh nonce. The empty-node Korean case should be treated as a confirmed frontend language-inference gap.
- Approval needed: `none`

### 2026-04-29 / loop-215
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: `backend/src/recommendation/routes.ts`, `backend/src/recommendation/routes.structured.test.ts`, `recommendation/src/contracts/index.ts`, `PLANS.md`
- What changed: Implemented the backend slice of `detail-046`. Keyword requests now accept optional `refreshNonce` and `excludedSuggestionLabels`, validate nonce length and excluded-label count/length, include both fields in the backend keyword cache key, and route `cacheBypass: true` refresh calls through a no-heuristic-fallback provider accessor so refresh LLM/provider failures are returned as errors instead of being hidden by heuristic suggestions.
- Tests run: `corepack yarn workspace @scenaairo/backend typecheck` (pass); `corepack yarn workspace @scenaairo/recommendation typecheck` (pass); changed-file backend recommendation ESLint (pass); `corepack yarn workspace @scenaairo/recommendation lint` (pass); `corepack yarn --cwd backend run -T vitest run src/recommendation/routes.structured.test.ts` (sandbox `spawn EPERM`, rerun outside sandbox pass, 9 tests); `corepack yarn workspace @scenaairo/backend test` (pass, 20 tests); `corepack yarn workspace @scenaairo/recommendation build` (pass); `corepack yarn workspace @scenaairo/backend build` (rerun after recommendation dist refresh pass); `corepack yarn --cwd backend run -T vitest run src/recommendation/routes.integration.test.ts` (sandbox `spawn EPERM`, rerun outside sandbox pass, 10 tests)
- Result: Backend route behavior now distinguishes refresh metadata in cache semantics and preserves refresh as a real provider-call path that surfaces provider errors.
- Warnings / blockers: Frontend still needs to send `refreshNonce` and current suggestion labels, and recommendation provider still needs retry/prompt/output-filter work for full `detail-046` completion. No DB schema change was made.
- Approval needed: `none`

### 2026-04-29 / loop-216
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/recommendation/request.ts`, `frontend/src/recommendation/request.test.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Implemented the frontend slice of `detail-046`. Keyword refresh now sends a fresh nonce and the currently displayed keyword labels as `excludedSuggestionLabels` while keeping `cacheBypass: true`. Recommendation request assembly now infers `structuredContext.language` from current node text/keywords first, then ranked/direct/major-flow/episode/object context by priority score and distance, so empty nodes can inherit Korean or Japanese context instead of defaulting to English.
- Tests run: `corepack yarn --cwd frontend run -T vitest run src/recommendation/request.test.ts` (sandbox `spawn EPERM`, rerun outside sandbox pass, 5 tests); `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx -t "cache bypass|keyword cloud error"` (sandbox `spawn EPERM`, rerun outside sandbox pass, 2 tests); `corepack yarn workspace @scenaairo/frontend typecheck` (pass); changed-file frontend ESLint for request and WorkspaceShell files (pass); full `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (outside sandbox pass, 75 tests); `corepack yarn workspace @scenaairo/frontend build` (pass); `git diff --check` (pass, line-ending warnings only).
- Result: Refresh requests now carry enough frontend metadata for backend/provider layers to request alternate keyword sets, and empty current nodes can request keywords in the language implied by nearby high-priority context.
- Warnings / blockers: Recommendation provider retry, prompt use of excluded labels, and provider-side output filtering remain outside this frontend patch. Existing backend/recommendation dirty files from the backend slice were not reverted.
- Approval needed: `none`

### 2026-04-29 / loop-217
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`
- What changed: Added `detail-047 / 오브젝트 atomic 토큰과 키워드 editable 토큰 분리 계획` after the user clarified the inline editor policy. The new plan keeps object mentions as fully atomic tokens that cannot be entered or partially edited, while keyword tokens become editable styled text. Keyword label edits must update node keywords and keyword cloud state, and keyword style removal is defined as a double-Backspace unwrap that preserves the label as plain text.
- Tests run: planning update only
- Result: Ownership is now explicit: Frontend owns token taxonomy, object-only caret snapping, keyword internal editing, double-Backspace keyword unwrap, and keyword cloud sync from the inline draft. Backend has no schema/API work and only needs to preserve the normalized text/keywords/objectIds it receives.
- Warnings / blockers: Implementation must be reconciled with the existing `detail-042` object-token atomic edit code because current helpers/tests may still treat adjacent keyword tokens as whole-token deletion targets.
- Approval needed: `none`

### 2026-04-29 / loop-218
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.tsx`, `frontend/src/routes/workspace-shell/CanvasNodeCard.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Implemented `detail-047`. Object tokens remain atomic, while keyword tokens are now editable styled text. Common token deletion helpers no longer remove keyword tokens wholesale, keyword label edits update `selectedAiKeywords`, keyword cloud slots, and refresh request `selectedKeywords`, and keyword boundary Backspace now uses a two-step unwrap that preserves the label as plain text. Empty keyword tokens are stripped, keyword extraction de-duplicates case-insensitively, and cloud insertion avoids nesting a new keyword marker inside an edited keyword token.
- Tests run: `corepack yarn --cwd frontend run -T vitest run src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts` (sandbox `spawn EPERM`, rerun outside sandbox pass, 18 tests); focused `WorkspaceShell.test.tsx` token tests (outside sandbox pass, 4 tests); `corepack yarn workspace @scenaairo/frontend typecheck` (pass); changed-file frontend ESLint for inline editor, CanvasNodeCard, WorkspaceShell files (pass); full `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (outside sandbox pass, 77 tests); `corepack yarn workspace @scenaairo/frontend build` (pass); `git diff --check` (pass, line-ending warnings only).
- Result: Users can edit keyword labels directly without deleting the whole token, unwrap keyword styling with double Backspace, and keep the keyword cloud/recommendation request state aligned with the edited label. Object mention tokens still reject internal edits and two-step delete as before.
- Warnings / blockers: Textarea overlay caret placement should still be browser-smoke-tested for visual precision. Existing backend/recommendation dirty files from earlier slices were not reverted.
- Approval needed: `none`

### 2026-04-29 / loop-219
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`, read-only review of `frontend/src/routes/workspace-shell/CanvasNodeCard.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.constants.ts`, `frontend/src/styles.css`
- What changed: Investigated the awkward caret placement around inline object/keyword tokens and added `detail-048 / 인라인 토큰 caret 위치 불일치 개선 계획`. The root cause is the current frontend editing model: a transparent textarea owns the browser caret while a separate absolute preview renders tokenized text, and the saved value contains invisible marker characters that do not exist visually in the preview. Object caret snapping and keyword marker protection make this mismatch more visible.
- Tests run: planning update and read-only code inspection only
- Result: The recommended fix is frontend-only: replace the transparent textarea/preview overlay with a token-aware inline editor where displayed token DOM and caret DOM are the same editing surface, while preserving the existing marker-string serialization for persistence.
- Warnings / blockers: A small CSS/index patch can reduce confusion but cannot fully solve the structural mismatch. Contenteditable/token DOM work needs careful IME, paste, selection restore, and canvas undo/redo regression coverage.
- Approval needed: `none`

### 2026-04-29 / loop-220
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/workspace-shell/CanvasNodeCard.tsx`, `frontend/src/styles.css`, `frontend/src/routes/WorkspaceShell.test.tsx`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Implemented the frontend correction for `detail-048`. The inline editor now toggles a focused `is-editing` state; while editing, the token preview layer is hidden and the real textarea text is visible, so the visible text and browser caret use the same raw input surface. On blur, the styled preview returns. Existing object atomic behavior and keyword editable/double-Backspace behavior remain unchanged.
- Tests run: focused `WorkspaceShell.test.tsx` input-surface/token tests (outside sandbox pass, 4 tests); `corepack yarn workspace @scenaairo/frontend typecheck` (pass); changed-file frontend ESLint for `CanvasNodeCard.tsx` and `WorkspaceShell.test.tsx` (pass); full `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (outside sandbox pass, 78 tests); `corepack yarn workspace @scenaairo/frontend build` (pass); `git diff --check` (pass, line-ending warnings only).
- Result: During actual editing, caret placement is no longer competing with the separate styled preview layer, reducing the object/keyword marker mismatch while preserving existing persistence and token behavior.
- Warnings / blockers: This is a focused textarea-surface correction, not the full contenteditable/token-DOM rewrite described as the long-term 048 direction. Existing backend/recommendation dirty files from earlier slices were not reverted.
- Approval needed: `none`

### 2026-04-29 / loop-220-fix
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/styles.css`, `frontend/src/routes/WorkspaceShell.test.tsx`, `DETAILPLAN.md`, `PLANS.md`
- What changed: Corrected the 048 visual regression called out by the user. Focused inline editing no longer hides the styled token preview or exposes plain raw textarea text; keyword/object preview typography remains visible while `is-editing` only tracks focus state. The regression test now asserts that a focused keyword token still renders through `.node-inline-keyword` and is not hidden with opacity.
- Tests run: focused `WorkspaceShell.test.tsx -t "styled keyword preview"` (outside sandbox pass, 1 test); `corepack yarn workspace @scenaairo/frontend typecheck` (pass); changed-file frontend ESLint for `WorkspaceShell.test.tsx` and `CanvasNodeCard.tsx` (pass; CSS is not covered by this ESLint config); full `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (outside sandbox pass, 78 tests); `corepack yarn workspace @scenaairo/frontend build` (pass); `git diff --check` (pass, line-ending warnings only).
- Result: Keyword/object visual styling is preserved during editing, while the 048 focus state remains available for future caret affordance work.
- Warnings / blockers: The full caret mismatch still requires the longer-term token-DOM/contenteditable work; this patch intentionally restores the token visual language instead of hiding it.
- Approval needed: `none`

### 2026-04-29 / loop-221
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend, Recommendation
- Touched zones: `DETAILPLAN.md`, `PLANS.md`, read-only review of `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/recommendation/request.ts`, `backend/src/recommendation/routes.ts`, `recommendation/src/context/index.ts`, `recommendation/src/provider/gemini.ts`, `recommendation/src/contracts/index.ts`
- What changed: Investigated the user's keyword cloud refresh follow-up and added `detail-049 / 키워드 클라우드 batch pool과 Gemini retry 보강 계획`. Current code still calls Gemini once per provider request, request context does not yet forward `refreshNonce` or `excludedSuggestionLabels` into `RecommendationContext`, frontend still requests only the current open slot count, and server/provider defaults still cap maxSuggestions at 9. The new plan combines the remaining `detail-046` Recommendation retry work with a frontend keyword suggestion queue/pool that fetches roughly two cloud pages per LLM call and consumes unused suggestions on the next same-context refresh.
- Tests run: planning update and read-only code inspection only
- Result: Recommended policy is pool-first refresh: if the current node/context signature has unused suggestions, refresh consumes them without an API call; if the pool is empty or context changed, frontend calls LLM for `openSlots * 2` suggestions. Gemini failures should use one initial attempt plus three retries before surfacing an error.
- Warnings / blockers: Raising frontend batch requests to 18 will not work until backend/provider `maxSuggestions` defaults or env are raised from 9. Backend route outer timeout also needs adjustment so it does not cancel provider-level retries before all attempts finish.
- Approval needed: `none`

### 2026-04-29 / loop-222
- Active milestone: Post-baseline support task
- Agents engaged: Backend
- Touched zones: `backend/.env.example`, `backend/src/recommendation/routes.ts`, `backend/src/recommendation/routes.structured.test.ts`, `PLANS.md`
- What changed: Implemented the backend slice of `detail-049`. The backend env example now sets `RECOMMENDATION_MAX_SUGGESTIONS=18` for two keyword-cloud pages, the route fallback max now defaults to the same 18-item batch size, keyword route timeout now allows four provider attempts plus a buffer before the backend wrapper aborts, and route regression coverage verifies that an 18-suggestion batch request passes through.
- Tests run: `corepack yarn workspace @scenaairo/backend typecheck` (pass); changed-file backend recommendation ESLint (pass); `corepack yarn --cwd backend run -T vitest run src/recommendation/routes.structured.test.ts` (sandbox `spawn EPERM`, rerun outside sandbox pass, 10 tests); `corepack yarn workspace @scenaairo/backend test` (pass, 20 tests); focused 18-item batch Vitest (outside sandbox pass, 1 test); `corepack yarn workspace @scenaairo/backend build` (pass)
- Result: Backend can now support the frontend keyword batch-pool policy at 18 suggestions and no longer has a route-level timeout that preempts the planned provider retry window.
- Warnings / blockers: Recommendation provider retry and provider-side excluded-label filtering are still pending for full `detail-049` completion. No DB schema/API endpoint change was made.
- Approval needed: `none`

### 2026-04-29 / loop-223
- Active milestone: Post-baseline support task
- Agents engaged: Frontend, Backend
- Touched zones: `DETAILPLAN.md`, `PLANS.md`, read-only review of `frontend/src/persistence/controller.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/useEpisodeCanvasState.ts`
- What changed: Investigated node text undo/redo behavior and added `detail-050 / 노드 텍스트 undo-redo 히스토리 연동 계획`. Current controller snapshots already include saved node text/keywords after `updateNodeContent()`, but inline editing is only committed on blur/explicit content save and Ctrl+Z/Y inside the textarea is intentionally left to browser-native text undo. The plan adds a required async draft flush before canvas undo/redo, removes blur/history-button race conditions, synchronizes selected-node draft state after history apply, and groups node text/keyword/object mention changes into one history action where possible.
- Tests run: planning update and read-only code inspection only
- Result: Frontend owns the fix. Backend persistence schema/API should not change; backend only receives the resulting node/object sync operations.
- Warnings / blockers: Inline mention sync currently calls `attachObjectToNode()` / `detachObjectFromNode()` as separate mutations, so objectIds may become separate undo entries unless the content save path is grouped into one controller mutation.
- Approval needed: `none`

### 2026-04-29 / loop-224
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Implemented the frontend slice of `detail-049`. Keyword suggestions now request a two-page batch sized as `openSlots * 2`, store unused candidates in an in-memory queue keyed by a stable recommendation context signature, consume same-context pool candidates on refresh without another API call, and invalidate the pool when selected keywords or surrounding request context changes. Refresh API calls now include both currently displayed and already consumed labels in `excludedSuggestionLabels`; unsaved inline draft text/keywords are reflected in the request signature and payload.
- Tests run: `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (pass, 80 tests); `corepack yarn workspace @scenaairo/frontend typecheck` (pass); changed-file frontend ESLint for `WorkspaceShell.tsx` and `WorkspaceShell.test.tsx` (pass); `corepack yarn workspace @scenaairo/frontend build` (pass)
- Result: The keyword cloud shows the first nine suggestions from an 18-item default batch, refreshes from the local pool first for the same context, then calls the API again only after the pool is exhausted or invalidated.
- Warnings / blockers: Full frontend lint still fails in pre-existing `frontend/src/routes/AuthCallbackPage.tsx` at `react-hooks/set-state-in-effect`; this patch did not touch that file. Recommendation provider retry and provider-side excluded-label filtering remain pending for full `detail-049` completion.
- Approval needed: `none`

### 2026-04-29 / loop-225
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.tsx`, `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.test.ts`, `frontend/src/persistence/controller.ts`, `frontend/src/persistence/controller.test.ts`, `frontend/src/routes/WorkspaceShell.tsx`, `frontend/src/routes/workspace-shell/CanvasNodeCard.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `PLANS.md`
- What changed: Implemented the user's keyword caret correction and the frontend `detail-050` patch. Keyword insertion no longer adds an artificial trailing space at the end, and keyword preview font metrics now match the textarea text metrics while retaining the distinct color/weight styling, reducing the marker/preview caret mismatch. Canvas undo/redo now shares an inline draft flush path with blur, waits for dirty node text before applying history, skips stale redo after a dirty flush, and re-syncs selected node draft/keywords/keyword pool after history apply. Inline object mention bindings are saved with node content through a single controller mutation, so text/keywords/objectIds undo and redo together.
- Tests run: focused inline/controller Vitest for keyword caret and object binding history (outside sandbox pass, 3 tests); focused WorkspaceShell history/object/keyword regressions (outside sandbox pass); full `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (outside sandbox pass, 82 tests); `corepack yarn workspace @scenaairo/frontend typecheck` (pass); changed-file frontend ESLint for WorkspaceShell, CanvasNodeCard, inline editor, controller files (pass); `corepack yarn workspace @scenaairo/frontend build` (pass); `git diff --check` (pass, line-ending warnings only)
- Result: Keyword insertion caret no longer carries a forced visible gap, unsaved node text is no longer skipped by canvas undo, Ctrl+Z/Y in the node textarea now uses canvas history, redo does not cross a new dirty text save, and object mention bindings stay coupled to the node text history action.
- Warnings / blockers: Full frontend lint still has the unrelated pre-existing `frontend/src/routes/AuthCallbackPage.tsx` hook lint failure if run across all `src`; changed-file lint for this patch passes. Browser visual smoke is still useful for pixel-level caret feel because the editor remains a transparent textarea over a styled preview.
- Approval needed: `none`

### 2026-04-29 / loop-226
- Active milestone: Post-baseline support task
- Agents engaged: Frontend
- Touched zones: `frontend/src/routes/workspace-shell/workspaceShell.inlineEditor.tsx`, `frontend/src/routes/workspace-shell/CanvasNodeCard.tsx`, `frontend/src/routes/WorkspaceShell.test.tsx`, `frontend/src/styles.css`, `PLANS.md`
- What changed: Added a distinct keyword edit-mode affordance for the inline editor. Keyword spans can now receive `is-keyword-editing` when the textarea selection is inside a keyword label, while the first Backspace at a keyword boundary marks the token with `is-keyword-unwrap-pending` before the second Backspace unwraps it to plain text. CSS adds non-layout-changing highlight/underline pulse states and preserves the existing keyword/object font styling.
- Tests run: focused `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx -t "keyword edit mode|unwraps keyword styling"` (sandbox `spawn EPERM`, rerun outside sandbox pass, 2 tests); full `corepack yarn --cwd frontend run -T vitest run src/routes/WorkspaceShell.test.tsx` (outside sandbox pass, 83 tests); `corepack yarn workspace @scenaairo/frontend typecheck` (pass); changed-file frontend ESLint via root `eslint` for CanvasNodeCard, inline editor, and WorkspaceShell test files (pass; first `frontend exec eslint` attempt failed because `eslint` was not found in that workspace command context); `corepack yarn workspace @scenaairo/frontend build` (pass); `git diff --check` (pass, line-ending warnings only)
- Result: Users can visually tell when they are editing a keyword label versus preparing to convert that keyword to plain text, without removing the keyword-specific typography.
- Warnings / blockers: Full frontend lint still has the unrelated pre-existing `frontend/src/routes/AuthCallbackPage.tsx` hook lint failure if run across all `src`. Browser visual smoke is still useful because the editor remains a transparent textarea over a styled preview.
- Approval needed: `none`

### 2026-05-01 / loop-227
- Active milestone: Local frontend dev support
- Agents engaged: Frontend
- Touched zones: `scripts/dev-frontend.mjs`, `frontend/scripts/serve-dist.mjs`, `scripts/serve-standalone.mjs`, `PLANS.md`
- What changed: Diagnosed `yarn dev:frontend` failing after the Vite path hit Windows `spawn EPERM`. The fallback server worked when launched directly, but `dev-frontend.mjs` tried to launch fallback through another `yarn.cmd`/`cmd.exe` child process, which can hit the same spawn restriction. The fallback now imports and starts the built dist server or standalone server in the current Node process, and both server scripts export explicit start functions while still supporting direct CLI execution.
- Tests run: `corepack yarn dev:frontend` (now reaches `Dist server listening on http://127.0.0.1:5173`; command timed out intentionally because the server stays running); `node --check scripts/dev-frontend.mjs` (pass); `node --check scripts/serve-standalone.mjs` (pass); `node --check frontend/scripts/serve-dist.mjs` (pass); changed-file ESLint for the three scripts (pass); `corepack yarn workspace @scenaairo/frontend build` (pass); `git diff --check` (pass, line-ending warnings only)
- Result: In spawn-restricted environments, `yarn dev:frontend` can now fall back to serving the built frontend in-process instead of exiting immediately after printing the fallback message.
- Warnings / blockers: This fallback serves the latest built `frontend/dist` output, not true Vite hot-reload dev mode, when the environment blocks child-process spawn. Run `corepack yarn workspace @scenaairo/frontend build` before relying on the fallback if dist is stale.
- Approval needed: `none`
