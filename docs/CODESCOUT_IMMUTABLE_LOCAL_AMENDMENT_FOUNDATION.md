# CodeScout Immutable Local Amendment Foundation

## Purpose

This document defines CodeScout's first doctrine-safe primitive: `ComputedEffectiveProvision`.

The purpose of this slice is narrow:

- represent a base/model code provision
- represent jurisdiction-specific local amendments separately
- attach evidence and audit attribution
- compute deterministic effective text
- surface ambiguity and evidence completeness
- attach an Authority Having Jurisdiction disclaimer

## Product boundary

This slice does not model:

- permit applications
- permit document requirements
- fee schedules
- inspection workflows
- plan review
- contractor marketplace behavior
- AI API calls
- scraping
- databases
- runtime APIs
- UI

## Authority boundary

CodeScout does not replace the Authority Having Jurisdiction, building department, inspector, attorney, engineer, architect, or licensed contractor.

This slice exists to answer:

- what does the effective local rule say
- what evidence supports that statement

This slice does not answer:

- what should be submitted
- whether something will be accepted
- whether a submission is likely to succeed

## Structural doctrine

The base provision and local amendments must remain structurally separate.

If a local amendment changes the governing text, the computed output must mark the amendment as superseding the affected base provision text.

Evidence is mandatory for trustworthy interpretation. Empty evidence never upgrades a provision to source-backed certainty.

## Attribution doctrine

Every `LocalAmendment` requires:

- `actorId`
- `timestamp`
- `evidence`

Every `EvidenceRecord` requires:

- `actorId`
- `timestamp`
- `source URL` or explicit `source identifier`
- `source type`

Missing attribution is invalid and should be rejected deterministically.

## Evidence doctrine

Evidence may be classified as:

- `source_backed`
- `unverified`
- `ambiguous`
- `incomplete`

Computed evidence completeness may be:

- `complete`
- `partial`
- `missing`
- `ambiguous`

Governance in later slices may review this material, but this foundational slice grants no execution authority and no approval semantics.

## Supersession doctrine

Supersession may be:

- `no_local_change`
- `local_amendment_supersedes`
- `ambiguous`
- `unverified`

`replaces`, `modifies`, `adds`, and `deletes` all represent local change. `ambiguous` remains ambiguous in the computed output.

## Gemini block incorporation

Gemini's block on the broader P1 lane is incorporated here. This foundation intentionally excludes readiness language, submission scoring, fee logic, inspection workflow logic, and any conclusion that would imply acceptance or authority.
