# CodeScout Foundation

## What CodeScout is

CodeScout is a municipal code amendment registry, diff portal, API contract, and effective local code computation layer. It captures municipality-submitted amendment events, compiles them into a searchable reference view, and preserves custody metadata for every published change.

## What CodeScout is not

CodeScout is not the legal authority for code interpretation. It does not replace official municipal code, municipal ordinances, permit review, inspection judgment, or local enforcement authority. It is not a chatbot product and it is not a contractor-facing lookup product in this slice.

## Separate-project boundary

CodeScout is a separate project from TradeScout. This slice assumes no shared database, no shared deployment pipeline, and no direct integration work with TradeScout. Future consumers may read CodeScout outputs, but CodeScout owns the municipal amendment workflow and event-sourced publication logic.

## Municipal/AHJ authority boundary

Municipalities and the local Authority Having Jurisdiction remain the final authority for code interpretation, permitting, inspection, and compliance. CodeScout compiles municipality-submitted code amendment data for reference and distribution only.

## Portal workflow

The portal workflow is:

1. Select a model code provision.
2. Choose `INHERIT_BASE`, `AMEND`, or `DELETE`.
3. Enter the local amendment text when applicable.
4. Submit a new immutable amendment event.
5. Compile the current effective local code from the event stream.
6. Record before-state, after-state, actor, timestamp, and hash-linked audit custody.

## API workflow

The API accepts a typed `JURISDICTIONAL_CODE_MUTATION` payload with a required `Idempotency-Key` header. Runtime validation checks request shape, jurisdiction path/body alignment, action-specific requirements, and actor identity fields before the system creates a new immutable event.

Rejected submissions are modeled as append-only failed mutation attempts so validation failures can still be audited without mutating historical code state.

## Event-sourcing doctrine

Canonical history is represented as immutable `JurisdictionAmendmentEvent` records. A municipality does not edit a prior amendment in place. Any correction or replacement is submitted as a new event that may reference `supersedesEventId` and `previousHash`. Historical events remain intact.

## Append-only audit doctrine

Audit events are separate from amendment events. They capture:

- authenticated actor
- timestamp
- compiled before-state
- compiled after-state
- previous hash
- event hash

This project models append-only semantics at the application layer. It does not claim database-level append-only enforcement until persistence exists.

## Hash-chain custody model

Each amendment event and audit event is assigned a deterministic payload hash using canonical serialization. Audit events include the previous hash plus before-state and after-state so a custody chain can be reconstructed without silently rewriting prior historical state.

## Runtime validation

Runtime validation is implemented as strict request-boundary logic. The validator requires:

- `mutationType` of `JURISDICTIONAL_CODE_MUTATION`
- jurisdiction, code family, year, and section identifiers
- action enum alignment
- source system and external mutation identifier
- `submittedBy.name`
- `submittedBy.email`
- action-specific fields for `AMEND` and `DELETE`
- `Idempotency-Key` at the API boundary

## OpenAPI contract alignment

The `openapi.yaml` file mirrors the runtime validation doctrine. It documents bearer authentication, required idempotency headers, event status and source enums, validation failure shape, and compiled payload metadata with disclaimer framing.

## Effective local code computation

Effective local code is derived from the immutable event stream. The compiler ignores rejected and superseded events when calculating the current published state. The latest valid event for a provision and jurisdiction is selected by effective date and submitted timestamp.

## Future consumers

Future consumers may include:

- municipal publication tools
- internal analyst workflows
- downstream read-only code reference products

Any consumer should treat CodeScout as a structured reference layer, not as a replacement for the local AHJ.

## Non-goals

- No TradeScout integration in this slice.
- No shared database with TradeScout.
- No shared deployment pipeline with TradeScout.
- No Accela/Tyler live integration in this slice.
- No contractor-facing lookup in this slice.
- No legal-authority replacement claim.
- No fake production municipal data.
- No claim of database-level append-only enforcement until persistence exists.
