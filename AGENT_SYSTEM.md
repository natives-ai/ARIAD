# AGENT_SYSTEM.md

## 1. Purpose
This document defines how the agentic development system operates for this repository.
It is the execution-governance layer between the human-authored product documents and Codex-based implementation work.

This document governs:
- agent roles and boundaries
- approval rules
- handoff rules
- testing and retry policy
- version-control gating
- planning and reporting conventions

It does **not** override product meaning.

---

## 2. Precedence and Source of Truth
The agent system must follow the document priority below.

### Immutable human-authored source of truth
1. `DISCOVERY.md`
2. `SPEC.md`

These documents define product intent, meaning, scope, and UX direction.
Agents must not rewrite, weaken, or reinterpret them beyond their explicit content.
Any change that may affect product meaning must be escalated to the human.

### Human-approved design/operations documents
3. `AGENT_SYSTEM.md`
4. `SCAFFOLD.md`
5. `AGENTS.md`
6. `PLANS.md`

These documents may be changed only through the derived-document change policy defined below.

---

## 3. Document Mutability Policy
### 3.1 Immutable documents
The following files are immutable unless the human directly edits them:
- `DISCOVERY.md`
- `SPEC.md`

Agents may reference them, quote them, and derive execution behavior from them, but may not modify them.

### 3.2 Human-approved derived documents
The following are controlled documents:
- `AGENT_SYSTEM.md`
- `SCAFFOLD.md`
- `AGENTS.md`
- `PLANS.md`

### 3.3 Structural changes vs routine updates
To avoid slowing execution unnecessarily, derived document changes are divided into two classes.

#### Structural changes
These require:
`proposal -> human approval -> apply`

Examples:
- milestone structure changes
- scaffold boundary changes
- agent role/authority changes
- status model changes
- approval model changes
- hard stop changes
- testing-policy changes
- version-control gate changes

#### Routine operational updates
These do **not** require prior human approval and may be applied directly by the Orchestrator or designated agent.

Examples:
- appending work-loop logs
- updating milestone status values
- recording tests run
- recording blockers, warnings, and escalation state
- filling handoff packets during execution

---

## 4. Operating Model
The system uses a **central Orchestrator model**.

### 4.1 Core workflow
1. The Orchestrator reads the current task context.
2. The Orchestrator checks `DISCOVERY.md`, `SPEC.md`, `AGENT_SYSTEM.md`, `SCAFFOLD.md`, `AGENTS.md`, and `PLANS.md` as needed.
3. The Orchestrator plans work and assigns specialist tasks through a structured handoff packet.
4. Specialists execute only within their role boundaries.
5. Specialists report back to the Orchestrator.
6. The Orchestrator decides whether to:
   - accept the result
   - replan
   - retry
   - escalate to the human

### 4.2 Handoff topology
All specialist handoffs must go **through the Orchestrator**.
Direct specialist-to-specialist workflow is not the default operating mode.

### 4.3 Parallelism policy
- There is **no hard cap** on concurrent specialist branches.
- The default operating preference is **2–3 concurrent specialist branches**.
- More than 3 concurrent specialist branches requires explicit Orchestrator justification.
- That justification should be recorded in the `PLANS.md` work-loop log.

The reason for this limit is coordination and integration stability, not token cost.

---

## 5. Agent Roster
The system starts with six top-level agents.

### 5.1 Orchestrator Agent
Responsible for:
- reading and prioritizing source-of-truth documents
- planning and task decomposition
- issuing handoff packets
- coordinating specialists
- deciding replan / retry / escalate
- final completion judgment
- updating execution state in `PLANS.md`

### 5.2 Frontend Agent
Responsible for:
- UI shell
- canvas interactions
- node interactions
- view-state behavior
- layout implementation
- frontend state and visual behavior

### 5.3 Backend Agent
Responsible for:
- persistence
- APIs
- storage logic
- recommendation request orchestration
- auth integration wiring within approved scope

### 5.4 Recommendation Agent
Responsible for:
- keyword cloud logic
- recommendation contracts
- AI-context assembly
- recommendation-side prompt behavior and recommendation policy implementation

### 5.5 Test Agent
Responsible for:
- validating test coverage relevance
- quality gating
- regression review
- identifying unstable or insufficient validation
- issuing PASS / WARN / BLOCK test judgments

### 5.6 Version Control Agent
Responsible for:
- detecting structurally sensitive changes
- enforcing version-control gating
- requiring rollback planning when needed
- issuing WARN / BLOCK when version-sensitive boundaries are crossed

---

## 6. Soft Ownership Model
The repository does **not** use hard file locks.
Instead it uses **soft ownership**.

Each responsibility area may define:
- `Primary owner`
- `Secondary owner`

Cross-boundary edits are allowed **only with Orchestrator approval**.

Ownership should be described primarily by **responsibility area**, with example directories or modules optionally listed in parentheses.

Example style:
- Frontend Agent: primary owner for canvas and interaction layer (`app/ui`, `app/canvas`, etc.)
- Backend Agent: primary owner for persistence and API layer (`app/server`, `app/data`, etc.)

Recommendation Agent may propose cross-domain implications, but may not directly implement outside its primary domain.
Cross-domain implementation must be routed through the Orchestrator.

---

## 7. Handoff Protocol
### 7.1 Handoff packet schema
Every specialist task must be issued with a structured handoff packet.
The packet structure is fixed, but the content is filled by the Orchestrator at runtime.

Required fields:
- `goal`
- `scope`
- `constraints`
- `context`
- `done_when`
- `tests_required`
- `report_format`

Optional field:
- `assumptions`

### 7.2 Meaning of the optional field
`assumptions` should be used only when the specialist is acting on an important implementation assumption that is not explicitly guaranteed by the source-of-truth docs.
If there is no meaningful assumption, the field should be omitted.

### 7.3 Handoff packet storage rule
The full handoff packet is maintained in the Orchestrator working context.
`PLANS.md` should only contain a concise execution summary, not the full packet.

---

## 8. Approval Model and Hard Stops
### 8.1 Wide Orchestrator approval model
The Orchestrator has broad authority to coordinate and approve implementation work **within** the approved product meaning and system rules.

### 8.2 Human approval is always required for hard stops
The Orchestrator must escalate to the human before proceeding when work may affect any hard-stop area.

### 8.3 Hard-stop categories
The system must not autonomously approve or complete work that may involve:
1. **Product-meaning changes** relative to `DISCOVERY.md` or `SPEC.md`
2. **Authentication / authorization / payment / secrets / deployment-sensitive security changes** beyond approved scope
3. **Test-policy weakening, bypass, or silent reduction of required validation**

### 8.4 Human escalation request format
When escalation is required, the request should follow this shape:
- `why_blocked`
- `options`
- `recommendation`
- `risk_of_each_option`

---

## 9. WARN / BLOCK / ESCALATE Semantics
### 9.1 WARN
WARN means execution may continue, but caution must be recorded.
Examples:
- first failure with a clear repair path
- tests largely pass but coverage or confidence is weak
- minor ambiguity that does not change product meaning

### 9.2 BLOCK
BLOCK means the task may not be marked complete in its current state.
A BLOCK should be raised when any of the following occurs:
- required tests failed
- the same failure signature repeated twice
- the task cannot be safely completed without leaving approved scope
- spec or contract ambiguity prevents safe implementation
- a Version Control boundary was crossed unexpectedly
- the same repair direction was attempted twice without new evidence

### 9.3 ESCALATE
ESCALATE means human approval or judgment is required before proceeding.
This should happen when:
- a hard stop is touched
- retry budget is exhausted
- product meaning may change
- security-sensitive auth/payment/secrets/deploy concerns are involved
- test-policy bypass or weakening is being considered

### 9.4 Authority boundaries
- Specialists may raise WARN or BLOCK conditions within their domain.
- The Version Control Agent may raise WARN or BLOCK.
- The Test Agent may raise PASS, WARN, or BLOCK.
- Only the Orchestrator escalates to the human.

---

## 10. BLOCK Handling Order
When a task is BLOCKED, the required order is:
1. `replan`
2. `retry`
3. `escalate`

This means:
- the Orchestrator should first reconsider the task plan
- then retry within the approved retry budget
- then escalate if the task remains blocked or approaches a hard stop

Calling another specialist is not the default response unless the Orchestrator determines the actual blocking cause belongs to a different responsibility area.

---

## 11. Test Policy and Retry Budget
### 11.1 Test-before-completion rule
No implementation task may be reported complete until relevant tests have been run and checked.

### 11.2 Retry budget
- Default self-repair budget: **3 attempts**
- Absolute maximum before mandatory escalation: **5 attempts**

### 11.3 Same-failure rule
If the same failure signature repeats twice, the Orchestrator must not continue the same repair path without new evidence.

### 11.4 Completion report minimum fields
Every completion report must include:
- `changed_scope`
- `tests_run`
- `result`
- `risks_or_follow_up`

One additional task-specific field may be added if it materially helps review.

### 11.5 Root-cause report after max retries
When the maximum retry budget is exhausted, a root-cause report is required with:
- `failure_pattern`
- `attempted_fixes`
- `why_unresolved`
- `recommended_next_step`

---

## 12. Version Control Gate
### 12.1 Gate model
The system adopts **Version Control Model B**.
The Version Control Agent engages whenever **any one** of the following boundaries is touched:
- root scaffold structure change
- shared contract or shared type change
- cross-cutting module boundary change
- rollback-sensitive refactor
- schema or migration change
- framework / runtime / build-tool change

A single qualifying boundary is enough to trigger Version Control Agent involvement.

### 12.2 Version Control Agent authority
The Version Control Agent may issue:
- `WARN`
- `BLOCK`

It does **not** escalate directly to the human.
The Orchestrator decides whether to escalate.

### 12.3 Rollback path rule
A formal rollback path is required whenever the Version Control Agent is engaged.
If the Version Control Agent is not engaged, no formal rollback plan is required by default.

---

## 13. Planning and Work-Loop Logging
`PLANS.md` is the live execution document.
It is mutable for operational updates, but structural changes must follow proposal -> human approval -> apply.

### 13.1 Allowed status values
The canonical `PLANS.md` status values are:
- `pending`
- `ready`
- `in_progress`
- `blocked`
- `escalated`
- `done`

`review_ready` is intentionally not used in the current operating model.

### 13.2 Work-loop update policy
A work-loop update should be appended at the end of each loop.

### 13.3 Minimum work-loop log fields
Each loop log should contain:
- `loop_id`
- `date_time`
- `active_milestone`
- `agents_engaged`
- `what_changed`
- `tests_run`
- `result`
- `warnings_or_blockers`
- `next_step`
- `approval_needed`

`approval_needed` should be simple and use values such as:
- `none`
- `hard_stop`

### 13.4 Parallelism justification logging
If more than 3 concurrent specialist branches are used, the Orchestrator must justify that choice in the work-loop log.

---

## 14. Agent-Specific Test Responsibility Split
### 14.1 Frontend Agent
Responsible for relevant:
- component tests
- interaction tests
- UI smoke checks
- visual-state behavior checks when appropriate

### 14.2 Backend Agent
Responsible for relevant:
- domain tests
- persistence tests
- API/integration tests
- storage round-trip checks

### 14.3 Recommendation Agent
Responsible for relevant:
- recommendation contract tests
- context-assembly tests
- deterministic fixture tests where possible
- recommendation I/O shape tests

### 14.4 Test Agent
Responsible for:
- checking that relevant tests were actually run
- evaluating sufficiency of validation
- issuing PASS / WARN / BLOCK
- identifying regression risk or flaky behavior

### 14.5 Orchestrator
Responsible for deciding which tests are relevant for task completion and whether specialist outputs satisfy the current acceptance threshold.

Final completion judgment remains with the Orchestrator.
The Test Agent has blocking authority but not final sign-off authority.

---

## 15. Relationship to AGENTS.md and PLANS.md
- `AGENT_SYSTEM.md` contains the operating system rules.
- `AGENTS.md` is the concise execution map for Codex.
- `PLANS.md` is the mutable milestone and loop-log execution document.

`AGENTS.md` should remain short and reference this file instead of duplicating it in full.

---

## 16. Summary of Canonical Decisions
This repository currently uses:
- immutable human-authored product source of truth
- central Orchestrator workflow
- soft ownership with primary and secondary owners
- broad Orchestrator approval within approved scope
- hard-stop-only human approval model
- fixed WARN / BLOCK / ESCALATE semantics
- mandatory test-before-completion rule
- retry budget of 3, hard max of 5
- Version Control Model B
- six canonical plan states
- derived-document structural changes requiring proposal -> approval -> apply

