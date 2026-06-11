import { describe, expect, it } from "vitest";
import { createMutationRequest, sampleJurisdiction } from "./fixtures";
import { createFailedMutationAttempt, createJurisdictionAmendmentEvent, validateMutationRequest } from "./mutations";

describe("validateMutationRequest", () => {
  function validate(body = createMutationRequest(), headers: Record<string, string | undefined> = { "Idempotency-Key": "idem-123" }) {
    return validateMutationRequest({
      pathJurisdictionId: sampleJurisdiction.id,
      headers,
      body,
    });
  }

  it("requires amendedText for AMEND", () => {
    const result = validate(createMutationRequest({ amendedText: undefined }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toContain("amendedText is required when action is AMEND");
    }
  });

  it("requires ordinanceReference for AMEND", () => {
    const result = validate(createMutationRequest({ ordinanceReference: undefined }));
    expect(result.success).toBe(false);
  });

  it("requires effectiveDate for AMEND", () => {
    const result = validate(createMutationRequest({ effectiveDate: undefined }));
    expect(result.success).toBe(false);
  });

  it("requires ordinanceReference for DELETE", () => {
    const result = validate(
      createMutationRequest({ action: "DELETE", amendedText: undefined, ordinanceReference: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it("requires effectiveDate for DELETE", () => {
    const result = validate(createMutationRequest({ action: "DELETE", amendedText: undefined, effectiveDate: undefined }));
    expect(result.success).toBe(false);
  });

  it("does not require amendedText for INHERIT_BASE", () => {
    const result = validate(
      createMutationRequest({
        action: "INHERIT_BASE",
        amendedText: undefined,
        ordinanceReference: undefined,
        effectiveDate: undefined,
      }),
    );
    expect(result.success).toBe(true);
  });

  it("fails unknown action", () => {
    const result = validate({
      ...createMutationRequest(),
      action: "SOMETHING_ELSE" as never,
    });
    expect(result.success).toBe(false);
  });

  it("fails path and body jurisdiction mismatch", () => {
    const result = validateMutationRequest({
      pathJurisdictionId: "us-fl-elsewhere",
      headers: { "Idempotency-Key": "idem-123" },
      body: createMutationRequest(),
    });
    expect(result.success).toBe(false);
  });

  it("fails missing submittedBy.name", () => {
    const result = validate(createMutationRequest({ submittedBy: { ...createMutationRequest().submittedBy, name: "" } }));
    expect(result.success).toBe(false);
  });

  it("fails missing submittedBy.email", () => {
    const result = validate(createMutationRequest({ submittedBy: { ...createMutationRequest().submittedBy, email: "" } }));
    expect(result.success).toBe(false);
  });

  it("fails invalid submittedBy.email", () => {
    const result = validate(
      createMutationRequest({ submittedBy: { ...createMutationRequest().submittedBy, email: "not-an-email" } }),
    );
    expect(result.success).toBe(false);
  });

  it("fails missing externalMutationId", () => {
    const result = validate(createMutationRequest({ externalMutationId: "" }));
    expect(result.success).toBe(false);
  });

  it("fails missing sourceSystem", () => {
    const result = validate(createMutationRequest({ sourceSystem: "" }));
    expect(result.success).toBe(false);
  });

  it("fails missing Idempotency-Key", () => {
    const result = validate(createMutationRequest(), {});
    expect(result.success).toBe(false);
  });
});

describe("event sourcing helpers", () => {
  it("creates superseding event with previousHash and preserves prior event", () => {
    const previous = createJurisdictionAmendmentEvent({
      eventId: "event-0001",
      request: createMutationRequest(),
      jurisdiction: sampleJurisdiction,
      provisionId: "irc-2021-r301-2-1",
      submittedAt: "2026-06-11T12:00:00.000Z",
      source: "PORTAL",
      previousHash: "genesis",
      idempotencyKey: "idem-0001",
    });

    const superseding = createJurisdictionAmendmentEvent({
      eventId: "event-0002",
      request: createMutationRequest({ amendedText: "Revised local text" }),
      jurisdiction: sampleJurisdiction,
      provisionId: "irc-2021-r301-2-1",
      submittedAt: "2026-06-12T12:00:00.000Z",
      source: "PORTAL",
      previousHash: previous.payloadHash,
      supersedesEventId: previous.id,
      idempotencyKey: "idem-0002",
    });

    expect(previous.id).toBe("event-0001");
    expect(superseding.supersedesEventId).toBe(previous.id);
    expect(superseding.previousHash).toBe(previous.payloadHash);
  });

  it("creates failed mutation attempts with errors and raw payload hash without mutation", () => {
    const payload = createMutationRequest({ externalMutationId: "" });
    const original = structuredClone(payload);
    const failed = createFailedMutationAttempt({
      id: "failed-0001",
      source: "API",
      receivedAt: "2026-06-11T12:00:00.000Z",
      validationErrors: ["externalMutationId is required"],
      rawPayload: payload,
      jurisdictionId: sampleJurisdiction.id,
      submittedBy: payload.submittedBy,
    });

    expect(failed.validationErrors).toContain("externalMutationId is required");
    expect(failed.rawPayloadHash).toMatch(/^codescout-hash-/);
    expect(payload).toEqual(original);
  });
});
