import { describe, expect, it } from "vitest";
import { createAuditEvent } from "./audit";
import { createComputedProvisionFixture, createEventFixture } from "./fixtures";

describe("createAuditEvent", () => {
  it("includes actor, timestamp, beforeState, afterState, and hash", () => {
    const event = createAuditEvent({
      auditEventId: "audit-0001",
      occurredAt: "2026-06-11T12:00:00.000Z",
      mutationEvent: createEventFixture(),
      beforeState: createComputedProvisionFixture({ status: "BASE_CODE", displayText: "Base text", amendedText: null }),
      afterState: createComputedProvisionFixture(),
      previousHash: "genesis",
    });

    expect(event.authenticatedSubject.email).toBe("clerk.office@pensacola.example.gov");
    expect(event.occurredAt).toBe("2026-06-11T12:00:00.000Z");
    expect(event.beforeState).toBeTruthy();
    expect(event.afterState).toBeTruthy();
    expect(event.eventHash).toMatch(/^codescout-hash-/);
  });

  it("produces deterministic hash for identical controlled inputs", () => {
    const input = {
      auditEventId: "audit-0001",
      occurredAt: "2026-06-11T12:00:00.000Z",
      mutationEvent: createEventFixture(),
      beforeState: createComputedProvisionFixture({ status: "BASE_CODE", displayText: "Base text", amendedText: null }),
      afterState: createComputedProvisionFixture(),
      previousHash: "genesis",
    } as const;

    const left = createAuditEvent(input);
    const right = createAuditEvent(input);

    expect(left.eventHash).toBe(right.eventHash);
  });

  it("changes hash when previousHash changes", () => {
    const baseInput = {
      auditEventId: "audit-0001",
      occurredAt: "2026-06-11T12:00:00.000Z",
      mutationEvent: createEventFixture(),
      beforeState: createComputedProvisionFixture({ status: "BASE_CODE", displayText: "Base text", amendedText: null }),
      afterState: createComputedProvisionFixture(),
    };

    const left = createAuditEvent({ ...baseInput, previousHash: "genesis" });
    const right = createAuditEvent({ ...baseInput, previousHash: "different" });

    expect(left.eventHash).not.toBe(right.eventHash);
  });

  it("does not mutate beforeState or afterState", () => {
    const beforeState = createComputedProvisionFixture({ status: "BASE_CODE", displayText: "Base text", amendedText: null });
    const afterState = createComputedProvisionFixture();
    const beforeOriginal = structuredClone(beforeState);
    const afterOriginal = structuredClone(afterState);

    createAuditEvent({
      auditEventId: "audit-0001",
      occurredAt: "2026-06-11T12:00:00.000Z",
      mutationEvent: createEventFixture(),
      beforeState,
      afterState,
      previousHash: "genesis",
    });

    expect(beforeState).toEqual(beforeOriginal);
    expect(afterState).toEqual(afterOriginal);
  });
});
