# CodeScout API Boundary

## Purpose

This document defines the simulated API handler boundary for CodeScout P3. The goal is to lock the request lifecycle around validation, authorization simulation, append-only persistence, audit custody, projection rebuilds, and typed response envelopes before any real backend or database is introduced.

## Simulated handler boundary

The P3 handler is a pure service-style orchestration function. It accepts path parameters, headers, body payload, a persistence boundary, a base provision resolver, and an authenticated subject model. It is intentionally not a live HTTP server and not an infrastructure choice.

## Accepted mutation lifecycle

Accepted mutation flow is:

1. validate path, headers, and body
2. check simulated authenticated subject access
3. resolve the base model provision
4. create a new immutable `jurisdiction_amendment_events` record
5. append the amendment event
6. rebuild the effective local code projection from canonical events
7. create and append an `audit_events` record
8. return a typed `202 ACCEPTED` payload with projection and metadata

## Rejected mutation lifecycle

Validation failures create a `failed_mutation_attempts` record and return a typed `400` response. Validation rejection does not append amendment history and does not append an audit event in this slice.

## Authorization simulation

The handler accepts a lightweight authenticated subject input model with identity fields plus `authorizedJurisdictionIds`. Missing or malformed subject input returns `401`. A subject without access to the requested jurisdiction returns `403`.

## Idempotency behavior

The simulated API requires `Idempotency-Key`. Duplicate jurisdiction/source/key submissions are rejected with `409`, preserving append-only history without rewriting an existing event.

## Base provision resolution

The handler uses a typed base provision resolver keyed by code family, code year, and section number. If the referenced base provision cannot be resolved, the handler returns `422`.

## Append-only persistence interaction

Canonical truth remains append-only:

- `jurisdiction_amendment_events`
- `audit_events`
- `failed_mutation_attempts`

The handler may read canonical events to compute before-state and after-state, but it does not update or delete prior records.

## Projection rebuild behavior

`effective_code_projections` remain derived and rebuildable. The accepted mutation path rebuilds the projection from relevant amendment events after a successful append and stores the rebuilt projection through the persistence boundary.

## OpenAPI alignment

`openapi.yaml` documents the same simulated handler response shapes used by the orchestration layer, including `202`, `400`, `401`, `403`, `409`, and `422`, along with `generatedAt` and disclaimer metadata in response bodies.

## AHJ authority

CodeScout is a structured, auditable reference and distribution layer. It does not replace AHJ or legal authority. The local Authority Having Jurisdiction remains the final authority for code interpretation, permitting, inspection, and compliance.

## Non-goals

- No real backend server in this slice.
- No real authentication provider.
- No live Accela/Tyler integration.
- No real database or migrations.
- No TradeScout integration.
- No production readiness claim.
- No database-level immutability claim.
