# AGENTS.md

---
**Code Commenting Guideline**

For all source files, classes, and functions in this project, please add a short and simple Korean comment as follows:

- At the top of each file: one-line description of the file's purpose (in Korean)
- For each class/function: one-line description of its role (in Korean)
- Keep comments concise and focused; avoid unnecessary details

Example:
```ts
// 이 파일은 사용자 인증 관련 기능을 담당합니다.

// 사용자 정보를 저장하는 클래스
class UserStore {
	// 사용자 추가 함수
	addUser(user) { ... }
}
```

This guideline is for code readability and maintainability. Please follow it throughout the project.
---

**Code Style and Comment Rules**

- When modifying or creating code, strictly follow the existing project style (including Prettier and current formatting conventions).
- For comments:
  - Never use emojis.
  - Keep comment text as concise as possible.
  - Use conventions such as `TODO`, `!`, and `?` proactively when they improve readability.
---

## Purpose
This is the repo-level operating map for Codex. Keep it short. Use it to orient execution, not to replace the source design documents.

## Read order and document precedence
Read these in order before any non-trivial work:
1. `DISCOVERY.md`
2. `SPEC.md`
3. `AGENT_SYSTEM.md`
4. `SCAFFOLD.md`
5. `PLANS.md`

Document precedence is strict:
- `DISCOVERY.md` and `SPEC.md` are the immutable, human-authored source of truth.
- `AGENT_SYSTEM.md` and `SCAFFOLD.md` define the operating and scaffold rules.
- `PLANS.md` is the mutable execution plan.
- `AGENTS.md` is only the concise execution map.

## Document mutability policy
### Immutable
- `DISCOVERY.md`
- `SPEC.md`

### Human approval required before applying structural changes
- `AGENT_SYSTEM.md`
- `SCAFFOLD.md`
- `AGENTS.md`
- structural changes to `PLANS.md`

### Freely updated during execution
- routine `PLANS.md` updates such as status changes, task progress, and work-loop logs
- execution reports and other runtime-derived notes created during work

Do not silently edit immutable documents. Do not silently apply structural changes to approval-required documents.

## Orchestrator-first operating model
- Use a central orchestration model.
- Specialist work is routed by the Orchestrator.
- Direct specialist-to-specialist delegation is not the default.
- Cross-domain implementation must be routed back through the Orchestrator.

## Agent roster
- `Orchestrator`: planning, routing, approval flow, consolidation, escalation
- `Frontend`: canvas UI, interactions, visual states, local UX behavior
- `Backend`: persistence, data models, server/API concerns
- `Recommendation`: AI context assembly, keyword cloud logic, recommendation behavior
- `Test`: validation strategy, test execution, regression checks, failure analysis
- `Version Control`: large-change gating, rollback-aware structural review, change-risk control

## Planning rule
Use `PLANS.md` for any multi-step, multi-file, long-running, ambiguous, cross-agent, or milestone-bearing task.
Update `PLANS.md` at the end of every work loop.

## Hard stops
The following always require human approval before implementation:
1. Any change that alters product meaning or conflicts with `DISCOVERY.md` / `SPEC.md`
2. Any auth, permissions, payment, secrets, deployment, or security-sensitive change
3. Any attempt to weaken, bypass, or silently skip the required test policy

See `AGENT_SYSTEM.md` for the full approval, retry, blocking, and escalation semantics.

## Version-control gate
Route through `Version Control` before implementation when a task touches any of the following:
- root scaffold structure changes
- shared contract or shared type changes
- cross-cutting module-boundary changes
- rollback-sensitive refactors
- schema or migration changes
- framework, runtime, or build-tool changes

## Validation and completion rule
Run relevant validation before claiming completion.
At minimum, completion reporting must include:
- changed scope
- tests run
- result
- risks / follow-up
- optionally, one extra task-specific note if it materially helps review

## Validation categories
Use the relevant categories defined by the scaffold/project:
- lint
- typecheck
- unit smoke
- integration
- build smoke
- e2e smoke

## Deferred decisions rule
Do not silently resolve deferred decisions. Route them through the current plan and, when required, through a human-approved proposal.

## Default operating posture
- Keep canonical product and UI copy in English unless the task is explicitly about localization.
- Prefer the smallest change that satisfies the current plan.
- Do not expand scope on your own.
- If meaning is ambiguous, preserve intent and escalate rather than improvising.
- Do not claim completion without running relevant validation and reporting the result.
