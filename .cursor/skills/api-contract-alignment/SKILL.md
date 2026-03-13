---
name: api-contract-alignment
description: Keep Expo frontend, React Native Web views, and FastAPI backend aligned to a single API and data contract. Use when adding fields, wiring screens to backend endpoints, checking manifest consistency, or reviewing whether frontend and backend changes can safely ship together.
---

# API Contract Alignment

## Quick Start

Use this skill when a task touches both frontend and backend, or when the user asks whether a change is safe to continue.

For this project, always check:

- `manifests/system_manifest.json`
- `api_registry`
- `database_schema`
- `business_constants`

## Primary Goal

Prevent drift between:

- frontend form fields
- request/response payloads
- backend models
- database fields
- UI display constants

## Contract Checks

Before editing code, verify:

1. The endpoint already exists in `api_registry`.
2. The field names already exist in the relevant request or schema model.
3. UI labels do not create new enum values or status values not present in the manifest.
4. The frontend does not assume optional fields are always present.
5. The backend does not rename fields without an approved manifest change.

## Safe Change Strategy

Prefer this order:

1. Confirm manifest definition.
2. Update backend parsing and response shape.
3. Update frontend API client and validation.
4. Update screen rendering and empty/error states.
5. Test old and new flows for compatibility.

If the manifest is missing a requested field:

- stop implementation
- report the mismatch clearly
- ask the user to approve a manifest update first

## Review Checklist

- [ ] Endpoint path matches manifest prefix and route definition
- [ ] Field names match manifest exactly
- [ ] Enum/status values are not invented in UI code
- [ ] Optional backend values are handled safely in frontend
- [ ] Error states are surfaced instead of silently ignored

## Output Format

When asked to audit alignment, use:

```markdown
## Contract Status
- endpoint:
- request fields:
- response fields:
- constants/enums:

## Drift Found
- [issue]

## Required Fix
- frontend:
- backend:
- manifest:
```

## Example Triggers

- “前后端这个字段对齐了吗？”
- “这个接口改完前端还能用吗？”
- “帮我检查当前页面和 FastAPI 返回值是否一致”
- “新增监控字段时要改哪些地方”
