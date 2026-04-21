# Shared Package Baseline

This boundary is reserved for artifacts that must be shared across the frontend, backend, and recommendation modules.

Current scope:
- shared types
- shared contracts
- shared i18n keys

Deferred in this slice:
- framework or runtime choice
- build tooling or package manifest setup
- concrete type definitions
- concrete contract definitions
- concrete i18n key catalogs
- broader shared-package splitting

Folder intent:
- `types/` holds cross-boundary data shapes once implementation needs them.
- `contracts/` holds shared module-to-module interface agreements.
- `i18n/` holds canonical localization keys with English-first copy.
