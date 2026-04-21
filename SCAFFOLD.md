# SCAFFOLD.md

## 1. Purpose

This document defines the initial technical scaffold for SCENAAIRO. It is not a full architecture document and it is not a vendor lock-in document. Its role is to fix the initial structural boundaries, persistence policies, quality gates, and safety disciplines that the repo should start with.

The scaffold should support fast implementation without collapsing structural clarity. It should also make later expansion possible without forcing heavyweight production operations too early.

## 2. Scaffold Philosophy

### 2.1 Workspace scaffold

SCENAAIRO starts as a workspace-style scaffold rather than a single undifferentiated app. The initial scaffold should separate the main functional boundaries of the product so that frontend, backend, recommendation logic, and shared contracts can evolve without being tangled together.

### 2.2 Production-aware balanced foundation

Use a production-aware balanced foundation: keep strong structural boundaries, testing discipline, and secure configuration from day one, while deferring heavyweight production operations until they are actually needed.

This means:

- treat configuration and secrets carefully from the start
- keep clear module boundaries from the start
- enforce test-before-completion discipline from the start
- avoid premature heavy deployment/ops scaffolding
- defer billing, collaboration, advanced observability, and production-only operations until later phases

## 3. Repository-Level Shape

At scaffold time, the repository should be organized around four primary concerns:

- frontend workspace shell
- backend application layer
- recommendation module with a service-like boundary
- one shared package with clear internal folders

The exact framework/vendor choice is deferred to the appendix. The scaffold should preserve these boundaries regardless of the eventual framework choice.

## 4. Primary Module Boundaries

### 4.1 Frontend boundary

The frontend owns:

- the single workspace shell
- canvas interaction
- episode/project selection UI
- object/library UI
- temporary drawer UI
- node editing UI
- keyword cloud invocation UI
- local working cache interaction

### 4.2 Backend boundary

The backend owns:

- persistence orchestration
- account-based cloud persistence
- guest vs logged-in persistence rules
- auth boundary
- recommendation request orchestration
- sync and import coordination

### 4.3 Recommendation boundary

Recommendation uses a service-like boundary.

This means recommendation logic is treated as its own logical module rather than being scattered across backend code. It may live in the same repository and even the same deployment unit at first, but its input/output contract and internal logic should remain separable.

### 4.4 Shared boundary

Shared starts as one package with clear internal folders rather than many tiny packages.

Initial internal folders should include:

- `types/`
- `contracts/`
- `i18n/`

Shared initially contains only:

- shared types
- shared contracts
- i18n keys

Additional shared concerns such as design tokens or broader utilities can be added later if they become genuinely cross-boundary.

## 5. Frontend Shell

### 5.1 Single workspace shell

The product starts with a single workspace shell because the core user experience is centered on one editing workspace:

- left side: project/folder/episode navigation
- top bar: object library
- center: canvas
- right side: contextual detail panel
- bottom area: temporary drawer
- node-local interactions: keyword cloud popovers and node controls

### 5.2 Initial routes

Initial routing is intentionally minimal:

- main workspace route
- auth callback route

Other concerns such as settings, help, and secondary management flows should initially be handled as overlays, panels, or modals instead of separate full-page routes.

## 6. Persistence and Auth Policy

### 6.1 Guest mode vs logged-in mode

Guest mode and logged-in mode must be separated at the persistence level.

#### Guest mode

- the product is usable without login
- working data is stored locally only
- no cloud persistence is performed by the app
- the user can still use recommendation features
- recommendation requests may still send necessary context to an external LLM provider

#### Logged-in mode

- cloud persistence becomes available
- cloud persistence is account-based
- cloud persistence is the canonical long-term store
- a local working cache is still maintained for responsiveness and recovery

### 6.2 Local-only means persistence scope, not LLM isolation

“Local-only” refers to where project data is stored by the application. It does **not** mean recommendation requests are executed locally. Recommendation calls may send the required context to an external LLM provider. The persistence policy and the recommendation provider boundary must remain conceptually separate.

### 6.3 Login import policy

When a guest user logs in, local work should be imported into the account-backed cloud workspace.

Initial import policy:

- if a local project has never been linked before, create a cloud-backed linked project
- if the local project has already been linked, reconnect to the existing cloud project
- duplicate import should be prevented by local linkage metadata
- the system should favor continuity of the same project over repeated duplication

### 6.4 Auth boundary

Auth should be abstracted enough that app logic does not become directly coupled to a specific provider implementation. Initial login support may start with Google sign-in, but application logic should depend on an auth boundary rather than a provider SDK spread across the codebase.

Minimum auth abstraction responsibilities should include:

- `signIn`
- `signOut`
- `getCurrentSession`
- `onAuthStateChange`
- guest-to-account import trigger coordination

### 6.5 Logged-in mode with local working cache

Logged-in mode uses cloud persistence as the canonical store, while keeping a local working cache for responsiveness and recovery.

This means:

- editing remains fast even if cloud sync is slower
- short network issues do not immediately destroy active work
- recovery after refresh is easier
- local cache is a working layer, not the long-term source of truth

## 7. Data and Persistence Policy

### 7.1 Persisted entities

The initial persisted entity set includes:

- `project`
- `episode`
- `object`
- `node`
- `temporary_drawer`

### 7.2 Stable IDs

Use client-generated stable IDs for all major entities from the beginning.

Stable IDs should apply to:

- projects
- episodes
- objects
- nodes
- temporary drawer items

This reduces the complexity of guest-to-cloud import and cross-layer references because the same identity can survive before and after login.

### 7.3 Structural importance order

Structural importance is defined as:

`project > episode > object > node > temporary_drawer`

This expresses hierarchy and conceptual ownership, not write frequency.

### 7.4 Flush priority order

Default cloud flush priority is defined as:

`node > object > temporary_drawer > episode > project`

This reflects frequency of change and perceived loss severity.

### 7.5 Dependency override

Dependency override always wins over the default flush priority.

Examples:

- a new project must exist before a new episode can be flushed
- a new episode must exist before dependent nodes can be flushed
- a referenced object may need to exist before a node that references it can be flushed

The system should therefore use:

- default priority for ordinary dirty-queue ordering
- dependency override when parent/reference prerequisites are missing

### 7.6 Local linkage metadata

Initial local linkage metadata should be minimal and explicit. Because stable IDs are shared across local and cloud representations, the linkage layer can stay small.

Recommended minimum fields:

- `entityId` or project-level stable ID
- `cloudLinked`
- `linkedAccountId`
- `lastImportedAt`
- `lastSyncedAt`

Additional sync state fields can be added later if needed.

### 7.7 Lightweight global registry

In addition to project-level metadata, the scaffold may keep a lightweight global registry for fast local project discovery and recovery-oriented indexing.

This registry should remain intentionally thin. It should not duplicate full project content. It should only help the app quickly answer questions such as:

- which local projects exist
- which project title or summary should appear in the sidebar
- which projects are linked to cloud persistence
- which projects were opened most recently

Project-level metadata remains the source of truth for per-project linkage state. The global registry is only an index for discovery, recovery, and navigation.

### 7.8 Temporary drawer persistence

Temporary drawer data is persisted too.

- guest mode: local only
- logged-in mode: local cache + cloud persistence

## 8. Save and Sync Triggers

### 8.1 Two-layer write model

Save behavior should be modeled as two layers:

- local working cache updates
- cloud flush updates

### 8.2 Local working cache triggers

Local working cache should update immediately on meaningful user changes, including:

- node content changes
- node move / reorder / connection changes
- object updates
- episode or project metadata updates
- temporary drawer changes

### 8.3 Cloud flush triggers

Cloud flush should use a queue with default priority plus dependency override.

Recommended behavior:

- text/property edits: short debounce
- structural edits (create / delete / move / reconnect): short debounce plus dependency-aware queueing
- lifecycle events: force or attempt a flush when appropriate

### 8.4 Lifecycle flush events

Lifecycle-related flush attempts should be considered for:

- successful login import
- tab hide / unload-related lifecycle hooks
- idle boundaries
- other clearly defined session boundaries

### 8.5 Link-state finalization

A local project should not be treated as fully cloud-linked merely because a remote project shell was created. Link-state finalization should happen only after:

- the remote project record exists successfully
- the currently active episode shell exists successfully
- the minimum project-to-episode structural linkage has been flushed

This keeps import/link state from being marked complete too early.

### 8.6 Entity-specific save behavior

The scaffold should support the following broad behavior model:

- `node`: immediate local update, fast debounced cloud flush
- `object`: immediate local update, debounced cloud flush
- `temporary_drawer`: immediate local update, slightly less urgent debounced cloud flush
- `episode`: immediate local update, cloud flush after meaningful episode-level stability points
- `project`: immediate local update, cloud flush on project metadata or structural project changes

Exact debounce durations are implementation details and can remain adjustable.

## 9. Recommendation Boundary

### 9.1 Service-like module

Recommendation should be implemented with a service-like boundary from the beginning.

This means the scaffold should preserve a clean separation between:

- recommendation context assembly
- recommendation request/response contracts
- recommendation provider integration
- application orchestration

### 9.2 Recommendation context and provider separation

The recommendation layer should not be treated as raw UI logic or raw persistence logic. It should sit behind a contract boundary that makes future provider changes or recommendation policy changes easier.

## 10. Environment and Secrets Policy

### 10.1 Environment depth

Use a medium environment depth from the beginning:

- `local`
- `dev`
- `staging-like`

This introduces useful separation without forcing full production operations too early.

### 10.2 `.env` discipline

Configuration should not be hardcoded into application code. Environment-dependent settings should be provided through environment variables or equivalent configuration channels.

### 10.3 Secrets touch prohibition

Agents must not directly create, rotate, reveal, or replace real secrets or production-sensitive credentials. Secret values and production secret operations are outside normal autonomous edit scope.

Agents may work with:

- secret names
- config contracts
- environment variable expectations

Agents must not autonomously operate on:

- actual secret values
- production credential rotation
- deployment-managed secret stores
- payment/auth/production-sensitive secret operations

### 10.4 Production-aware configuration discipline

The scaffold should be safe to evolve toward production later by keeping:

- environment separation
- secret/config separation
- provider-specific values out of code
- room for deployment-safe configuration later

## 11. Quality Gates and Development Workflow

### 11.1 Full quality-gate family

The scaffold should include all six quality-gate categories from the beginning:

- lint
- typecheck
- unit smoke
- integration
- build smoke
- e2e smoke

### 11.2 Always-run gates

The following should run on every relevant implementation completion path:

- lint
- typecheck
- unit smoke
- build smoke

### 11.3 Relevant-run gates

The following should run when the change actually affects their scope:

- integration
- e2e smoke

Representative examples:

#### Integration-related changes
- persistence flow changes
- auth flow changes
- recommendation orchestration changes

#### E2E-related changes
- workspace shell changes
- critical editor workflows
- guest/login/import flows

## 12. Version-Control-Sensitive Scaffold Changes

The Version Control Agent should engage when any one of the following is touched:

- root scaffold structure change
- shared contract or shared type change
- cross-cutting module boundary change
- rollback-sensitive refactor
- schema or migration change
- framework / runtime / build-tool change

When Version Control Agent engagement is triggered, rollback planning is required.

## 13. Deferred Scaffold Decisions

The scaffold intentionally defers the following decisions:

- billing
- collaboration
- advanced permissions
- advanced observability
- production deployment operations
- final cloud persistence vendor choice
- final LLM provider choice
- later shared-package splitting strategy
- deeper route expansion beyond the initial workspace/auth shape

## 14. Technical Appendix

The appendix may record technical candidates and provisional implementation notes that do not change the scaffold structure itself.

Examples:

- persistence provider choice (TBD)
- recommendation provider choice (TBD)
- framework/runtime choice (TBD)
- implementation notes for debounce tuning
- future package split candidates inside shared

The appendix should not override the structural decisions in the body of this document.