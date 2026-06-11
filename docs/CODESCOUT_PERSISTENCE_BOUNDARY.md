# CodeScout Persistence Boundary

## Purpose

This document defines the storage contracts that preserve CodeScout's event-sourced, append-only doctrine before any production backend is introduced. The goal is to make mutable-history mistakes structurally difficult at the TypeScript interface boundary.

## Review status dependency from P1

This P2 slice builds on the approved P1 baseline at commit `173f4fc53fcea3c2d97155e46f8cd6843e4cb684`. P1 established the immutable event model, audit chain semantics, runtime validation, and AHJ disclaimer boundary that this persistence design must preserve.

## Canonical event stores

Canonical truth in future persistence must be:

- `jurisdiction_amendment_events`
- `audit_events`
- `failed_mutation_attempts`

These ledgers are append-only. They represent historical custody and must never be treated as mutable current-state rows.

## Derived projections

`effective_code_projections` are derived and rebuildable. They are not canonical truth. Their purpose is query speed and publication convenience, not historical authority.

## Mutable operational/configuration data

Mutable operational or configuration data may include:

- `api_clients`
- `municipal_users`
- `jurisdictions`

These records are not the canonical amendment history and may evolve through ordinary administrative workflows.

## What must never be mutable

The following future storage concepts must be insert-only:

- `jurisdiction_amendment_events`
- `audit_events`
- `failed_mutation_attempts`

CodeScout must not support in-place amendment history rewrites such as updating an existing `amendedText` field on a previously accepted amendment event.

## Why projections may be rebuilt

Projections may be rebuilt because they are a view over immutable canonical history. Rebuilding projections is a feature of the design, not a compromise. If the event stream remains intact, the current effective local code can be recalculated deterministically.

## Application-level immutability vs database-level enforcement

The current repository provides application-level immutability only. It does not yet include database migrations, storage policies, grants, or engine-level controls that enforce append-only storage. CodeScout must not claim database-enforced immutability unless those mechanisms are actually implemented later.

## Future database expectations

- CodeScout does not share a database with TradeScout.
- CodeScout does not share a deployment pipeline with TradeScout.
- `jurisdiction_amendment_events` must be insert-only in future persistence.
- `audit_events` must be insert-only in future persistence.
- `failed_mutation_attempts` must be insert-only in future persistence.
- `effective_code_projections` are rebuildable and not canonical truth.
- CodeScout does not replace AHJ or legal authority.

## Recommended SQL/storage constraints

- no `UPDATE` or `DELETE` grants on `jurisdiction_amendment_events`
- no `UPDATE` or `DELETE` grants on `audit_events`
- no `UPDATE` or `DELETE` grants on `failed_mutation_attempts`
- insert-only service role for canonical ledgers
- unique event id
- unique `jurisdiction/source/idempotency key`
- `previous_hash` references prior `payload_hash` where applicable
- `created_at` defaults from database clock
- optional hash-chain verification job
- separate database instance from TradeScout

## Non-goals

- No TradeScout integration in this slice.
- No shared database with TradeScout.
- No shared deployment pipeline with TradeScout.
- No live Accela/Tyler integration in this slice.
- No contractor-facing lookup in this slice.
- No homeowner or requester flow in this slice.
- No claim of production readiness.
- No fake production municipal data.
- No claim that CodeScout replaces AHJ or legal authority.
