---
name: mobile-web-release-readiness
description: Prepare a shared Expo application and related SaaS backend for iOS App Store, Android, and Web release readiness. Use when checking store metadata, environment configuration, production API settings, platform gaps, deep linking, permissions, or release blockers before shipping.
---

# Mobile Web Release Readiness

## Quick Start

Use this skill before shipping or when the user asks whether the current multi-platform implementation is ready for release.

Current project assumptions:

- Expo app serves iOS, Android, and Web
- Backend is deployed separately and consumed through `expo.extra.apiUrl`
- Release quality depends on both client behavior and backend production safety

## Release Review Areas

Check these areas in order:

1. Runtime environment
2. Production API endpoints
3. Authentication behavior
4. Deep link and navigation stability
5. Platform permissions and fallbacks
6. Store-facing metadata and assets
7. Web deployment and browser compatibility

## Platform Rules

For iOS:

- verify icons, splash, scheme, and store-safe user flows
- avoid relying on Android-only interactions
- confirm any external links and auth redirects behave on iPhone

For Android:

- verify adaptive icon, back behavior, and permission prompts
- confirm layouts remain stable across common screen sizes

For Web SaaS:

- verify API base URL is production-safe
- confirm refresh, direct route entry, and auth persistence
- check browser-only UX, empty states, and loading states

## Backend Readiness Checks

- production env values are present
- CORS is explicitly configured
- auth and token expiration are consistent with client flow
- no mock-only assumptions leak into production behavior
- health endpoints and critical business endpoints behave predictably

## Output Format

When asked for a release audit, respond with:

```markdown
## Release Scope
- platforms: iOS / Android / Web

## Ready
- [item]

## Blockers
- [must-fix issue]

## Follow-up
- [recommended but not blocking]
```

## Example Triggers

- “现在这个项目能上架 App Store / Android 吗？”
- “帮我检查 Expo 多端发布前还缺什么”
- “Web SaaS 上线前还有哪些风险”
- “生产环境 API 和客户端配置是否可发布”
