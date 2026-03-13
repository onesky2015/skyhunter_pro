---
name: cross-platform-refactor
description: Plan and implement refactors for shared iOS, Android, and Web SaaS codebases built with Expo, React Native Web, and FastAPI. Use when restructuring old projects, migrating partially completed features, redefining module boundaries, or deciding what should be shared versus platform-specific.
---

# Cross Platform Refactor

## Quick Start

Use this skill when the user is refactoring a multi-platform product that targets:

- iOS App Store
- Android
- Web SaaS
- Shared backend services

Default stack assumptions for this project:

- Frontend: Expo SDK 54 + `expo-router` + React Native Web
- Backend: FastAPI
- Contract source: `manifests/system_manifest.json`

Before proposing code changes:

1. Read `manifests/system_manifest.json` and summarize the relevant contract.
2. Identify whether the request affects shared UI, platform-specific UI, backend contract, or release configuration.
3. Prefer extending the current structure over rewriting completed modules.
4. Keep existing auth, cache, and route contracts stable unless the user explicitly asks to change them.

## Refactor Decision Rules

Use these defaults:

- Put business rules, validation, API typing assumptions, and state orchestration in shared modules.
- Put native capability handling, store-review constraints, deep links, permissions, and device-only UI in platform-specific boundaries.
- Put SEO needs, marketing pages, admin console behavior, and browser-only integrations in web-specific boundaries.
- Keep backend response fields aligned with the manifest instead of inferring new fields from UI needs.

If a feature is only partially migrated, choose one of these paths:

1. Wrap old logic behind a stable adapter.
2. Move read-only logic first, then mutation logic.
3. Migrate screens after contracts and data models are stable.

Do not recommend broad rewrites by default.

## Required Workflow

Follow this order:

1. Inventory current implementation.
2. Mark each concern as `shared`, `mobile-only`, `web-only`, or `backend-only`.
3. Check whether the manifest already defines the required fields and endpoints.
4. Propose the smallest safe refactor slice.
5. Implement one vertical slice at a time.
6. Validate navigation, auth flow, and API compatibility after each slice.

## Output Format

When the user asks for a refactor plan, respond with:

```markdown
## Refactor Goal
[one sentence]

## Current State
- [existing completed part]
- [legacy part still coupled]

## Proposed Boundaries
- shared:
- mobile-only:
- web-only:
- backend-only:

## Migration Order
1. [smallest safe step]
2. [next step]
3. [validation step]

## Risks
- [main regression risk]
```

## Project Guardrails

- Treat `manifests/system_manifest.json` as the source of truth for API fields, enums, and persistence models.
- Prefer keeping `frontend/app` route behavior stable when refactoring internals.
- Avoid introducing duplicate business constants when they already exist in the manifest.
- If a requested change exceeds the manifest, ask for manifest approval before editing app logic.

## Examples

Example triggers:

- “帮我重构旧的 Expo 项目，兼容 iOS/Android/Web”
- “这个页面已经改了一半，继续拆成共享模块”
- “哪些逻辑该放 shared，哪些该放 web-only？”
- “把老项目逐步迁移到当前 SaaS 架构”
