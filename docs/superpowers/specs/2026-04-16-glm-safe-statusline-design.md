# GLM Safe StatusLine Design

Date: 2026-04-16
Project: `glm_code_plan_status_plugs`
Status: Approved for planning draft

## Summary

Build a new Claude Code `statusLine` integration for GLM usage visibility with a strict local bridge security boundary and a `Telemetry Rail` presentation model.

The first version will:

- support GLM only
- render a `Telemetry Rail` terminal layout
- split responsibilities into a local `renderer` and a local `bridge`
- ensure the renderer never reads or stores the upstream API key
- use a local read-only bridge as the only component allowed to contact the GLM quota API

The first version will not:

- support multiple providers
- add a web dashboard
- expose a generic proxy
- let the renderer call the upstream quota API directly

## Goals

- Keep the setup compatible with Claude Code `statusLine`
- Preserve fast terminal rendering
- Make the security boundary explicit and auditable
- Make the UI clearly distinct from a linear sentence-style status line
- Keep the first release narrow enough to plan and implement cleanly

## Non-Goals

- No multi-provider abstraction in v1
- No browser-based operational dashboard in v1
- No auto-discovery of arbitrary upstream endpoints
- No cross-user shared bridge
- No complex process orchestration or cluster-style self-healing

## Chosen Product Direction

The approved design decisions for v1 are:

- Visual direction: `Telemetry Rail`
- Security boundary: `bridge` owns secrets, renderer never touches them
- Product shape: Claude Code `statusLine` command only
- Provider scope: GLM only
- Runtime pattern: local read-only `bridge daemon` plus local `renderer`

## Architecture

### High-Level Components

#### 1. Renderer

The `renderer` is the process configured as Claude Code's `statusLine` command.

Responsibilities:

- parse Claude Code `stdin`
- derive model, context usage, output speed, workspace name, and branch
- request a sanitized quota snapshot from the local bridge
- render terminal output using the approved `Telemetry Rail` layout
- degrade safely when the bridge is unavailable

Constraints:

- must not read API keys
- must not call the upstream GLM quota endpoint
- must not store raw upstream responses
- must not expose a management interface

#### 2. Bridge

The `bridge` is a local long-running process that owns quota collection.

Responsibilities:

- read local secret material
- call the fixed GLM quota endpoint
- cache sanitized quota state
- expose a small local read-only interface to the renderer
- enforce allowlisted upstream host and path checks
- track freshness and failure state

Constraints:

- no generic proxy behavior
- no arbitrary URL forwarding
- no returning raw upstream bodies to the renderer
- no returning secrets in logs or responses

#### 3. Bridgectl

`bridgectl` is a small local operator command.

Responsibilities:

- start the bridge
- stop the bridge
- report bridge status

Constraints:

- no rendering responsibility
- no direct user-facing quota formatting
- no general debugging shell

### Communication Model

Preferred transport:

- Unix domain socket

Fallback transport:

- `127.0.0.1` loopback port only if Unix sockets are not available

Why this choice:

- the bridge is a single-user local service
- Unix sockets give the cleanest local-only boundary
- socket file permissions can be restricted to the current user

### Request Flow

1. Claude Code invokes the renderer
2. Renderer reads runtime context from `stdin`
3. Renderer requests a local sanitized snapshot from the bridge with a short hard timeout
4. Bridge returns the latest sanitized in-memory snapshot
5. Renderer renders either:
   - full `Telemetry Rail` output when bridge data is available
   - reduced fallback output when bridge data is unavailable

### Upstream Flow

1. Bridge loads local secret material
2. Bridge validates the fixed GLM endpoint against an allowlist
3. Bridge requests the GLM quota API
4. Bridge maps the response into a strict sanitized schema
5. Bridge stores only sanitized snapshot data for renderer access

## Configuration and Secret Provisioning

### Secret Source

V1 must keep the GLM credential out of the renderer process environment.

Approved rule:

- bridge receives the GLM credential through bridge-specific startup configuration
- renderer must work without the GLM credential present in its own environment
- Claude Code status line execution must not rely on inheriting the quota credential

V1 may implement bridge secret loading through one of these local-only sources:

- bridge-only environment variable at bridge startup
- local user-private config file loaded by the bridge

V1 must not require:

- the renderer to read the credential
- the renderer to parse a config file containing the credential
- the credential to be present in the Claude Code runtime environment

### Provider Gating

V1 is GLM-only, so the renderer must decide whether quota data is relevant before showing the quota rail.

Approved rule:

- if the current runtime context is GLM, renderer may request and render bridge quota data
- if the current runtime context is not GLM, renderer renders only the basic runtime line and project line
- non-GLM rendering must not be treated as an error state

## Security Model

### Trust Boundaries

- `renderer` is treated as an untrusted presentation layer
- `bridge` is treated as the minimum-privilege collection layer
- only the bridge may read the GLM credential
- only the bridge may contact the GLM quota API

### Default-Deny Rules

- bridge may only access preconfigured allowlisted host and path combinations
- bridge may not accept arbitrary request destinations
- bridge may not expose a generic HTTP forwarding interface
- renderer may not fall back to direct upstream access

### Local Exposure Rules

- prefer Unix socket access restricted to the current user
- if a TCP fallback is necessary, bind only to `127.0.0.1`
- do not accept non-loopback connections

### Secret Handling Rules

- never emit the API key to stdout, stderr, logs, socket responses, or cache files
- never expose `Authorization` headers outside the bridge
- never persist raw upstream response bodies
- debugging output must be disabled by default and redacted when enabled

## Data Minimization

The bridge may expose only a small sanitized schema to the renderer.

### Approved Snapshot Schema

```json
{
  "status": "fresh | stale | unavailable",
  "plan_level": "lite | pro | max | unknown",
  "token_usage_pct": 62,
  "token_reset_at": 1776304080000,
  "mcp_remaining": 680,
  "mcp_total": 1000,
  "snapshot_age_ms": 14000,
  "fetched_at": 1776297280000
}
```

### Explicitly Disallowed Fields

- API key
- authorization header
- raw response body
- account identifiers not needed for rendering
- reusable upstream request parameters
- implementation-specific diagnostics that reveal upstream internals

### Schema Governance

- future upstream fields must not be passed through automatically
- any new field must be explicitly added to the bridge schema allowlist
- renderer must depend only on the published sanitized schema

## Caching and Refresh Strategy

### Renderer

- renderer does not maintain its own quota cache
- renderer only uses local runtime context plus the current bridge snapshot

### Bridge

- bridge keeps the latest sanitized snapshot in memory
- bridge may optionally persist only sanitized snapshot data if operationally necessary
- bridge must not persist raw upstream responses

### Refresh Policy

Recommended v1 behavior:

- refresh immediately on bridge startup
- refresh periodically in the background
- retain snapshot status and age metadata between refresh attempts

Rationale:

- status line refresh frequency should not drive upstream API traffic
- the bridge should absorb refresh timing and retry policy

## Telemetry Rail Presentation

### Visual Intent

The `Telemetry Rail` layout is meant to feel like a compact operational panel rather than a long joined sentence.

It should be clearly differentiated in three ways:

- stronger information grouping
- a labeled quota rail rather than one continuous text segment
- visible freshness and failure state from the local bridge

### Layout Rules

Top row:

- model badge
- context pressure badge
- token-per-second badge

Quota rail:

- labeled rows rather than inline fragments
- token 5h usage shown as a horizontal rail
- plan and reset grouped together
- MCP remaining and freshness grouped together

Bottom row:

- workspace directory
- git branch

### Fallback Layout

When bridge data is unavailable:

- keep top-row runtime badges
- show a compact non-sensitive status message such as `quota unavailable`
- keep workspace and branch row
- do not print stack traces or network detail

### Freshness

Freshness may be shown as a short local signal, for example `fresh 14s` or `stale 2m`, provided it does not leak raw upstream timing details beyond what is needed for terminal rendering.

## Error Handling

### Renderer Rules

- renderer must never crash the status line because bridge access fails
- renderer must use a short hard timeout for bridge reads
- renderer must not retry on the critical rendering path
- timeout, parse failure, socket failure, or missing bridge all result in a safe fallback render

### Bridge Rules

- bridge must use a hard timeout for upstream requests
- bridge may retry internally with a small bounded policy
- bridge must classify state as:
  - `fresh`
  - `stale`
  - `unavailable`

### State Semantics

- `fresh`: bridge has a newly refreshed snapshot
- `stale`: bridge has an older sanitized snapshot but recent refresh attempts failed
- `unavailable`: bridge has no usable snapshot yet

### Error Message Policy

Allowed output:

- `quota unavailable`
- `stale 2m`

Disallowed output:

- TLS error details
- DNS details
- raw upstream path details
- headers
- body fragments

## Testing Strategy

### Renderer Unit Tests

- ANSI rendering for `Telemetry Rail`
- fallback rendering when bridge is unavailable
- short-timeout path
- missing model, missing tps, missing branch behavior
- formatting of freshness and reset countdown

### Bridge Unit Tests

- allowlisted endpoint enforcement
- schema sanitization
- redaction behavior
- snapshot status transitions
- refresh scheduling behavior

### Contract Tests

- fixed renderer-to-bridge JSON schema
- rejection of unexpected extra fields
- renderer compatibility with `fresh`, `stale`, and `unavailable`

### Integration Tests

- mock successful upstream response
- mock upstream timeout
- mock upstream malformed response
- bridge startup followed by renderer reads
- bridge stale snapshot behavior after refresh failure

### Security Tests

- confirm no secret appears in renderer output
- confirm no secret appears in bridge logs
- confirm no secret appears in cache or state files
- confirm raw upstream body is not persisted

### Manual Validation

- real Claude Code `statusLine` integration
- bridge down before renderer starts
- bridge recovers after failure
- non-git workspace behavior
- non-GLM context behavior if the renderer is invoked outside expected upstream state

## Operational Assumptions

- planning and implementation should assume a local single-user development environment
- bridge startup is manual in v1 rather than being auto-spawned by the renderer

## Implementation Boundaries for the Next Planning Step

The next planning step should produce an implementation plan for exactly these deliverables:

- local bridge daemon
- local bridge control command
- Claude Code status line renderer
- shared sanitized snapshot schema
- tests for renderer, bridge, and contract boundaries

The next planning step should explicitly avoid expanding scope into:

- multi-provider support
- browser dashboard work
- remote synchronization
- generalized observability platform work

## Review Checklist Outcome

This spec is considered ready for implementation planning if the planner can answer all of the following without guessing:

- what runs in the renderer vs bridge
- where secrets are allowed to exist
- what the local data contract is
- what the terminal layout is trying to achieve
- what happens on bridge failure
- what v1 includes and excludes

## Open Notes

- The visual direction has already been validated with the user as `Telemetry Rail`.
