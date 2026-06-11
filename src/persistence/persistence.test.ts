import { describe, expect, it } from "vitest";
import {
  AUTHORITY_DISCLAIMER,
  createAuditEvent,
  createComputedProvisionFixture,
  createEventFixture,
  createFailedMutationAttempt,
  modelCodeProvisions,
  sampleJurisdiction,
} from "../domain";
import { createInMemoryPersistenceBoundary, rebuildEffectiveCodeProjection, verifyHashChain } from "./index";

describe("persistence contracts", () => {
  it("supports append/get/list for amendment events", async () => {
    const boundary = createInMemoryPersistenceBoundary();
    const event = createEventFixture();

    await boundary.amendmentEvents.append(event);

    expect(await boundary.amendmentEvents.getById(event.id)).toEqual(event);
    expect(
      await boundary.amendmentEvents.listByJurisdictionProvision({
        jurisdictionId: sampleJurisdiction.id,
        modelProvisionId: event.modelProvisionId,
      }),
    ).toHaveLength(1);
  });

  it("supports append/list for audit events", async () => {
    const boundary = createInMemoryPersistenceBoundary();
    const auditEvent = createAuditEvent({
      auditEventId: "audit-0001",
      occurredAt: "2026-06-11T12:00:00.000Z",
      mutationEvent: createEventFixture(),
      beforeState: createComputedProvisionFixture({ status: "BASE_CODE", displayText: "Base text", amendedText: null }),
      afterState: createComputedProvisionFixture(),
      previousHash: "genesis",
    });

    await boundary.auditEvents.append(auditEvent);

    expect(await boundary.auditEvents.listByMutationEventId(auditEvent.mutationEventId)).toHaveLength(1);
  });

  it("supports append/list for failed mutation attempts", async () => {
    const boundary = createInMemoryPersistenceBoundary();
    const attempt = createFailedMutationAttempt({
      id: "failed-0001",
      source: "API",
      receivedAt: "2026-06-11T12:00:00.000Z",
      validationErrors: ["boom"],
      rawPayload: { any: "thing" },
      jurisdictionId: sampleJurisdiction.id,
    });

    await boundary.failedMutationAttempts.append(attempt);

    expect(await boundary.failedMutationAttempts.listByJurisdiction(sampleJurisdiction.id)).toHaveLength(1);
  });

  it("does not expose mutable-history methods on canonical stores", () => {
    const boundary = createInMemoryPersistenceBoundary();
    const forbiddenMethods = ["update", "delete", "overwrite", "mutate", "replace", "patch", "saveCurrent"];

    for (const method of forbiddenMethods) {
      expect(method in boundary.amendmentEvents).toBe(false);
      expect(method in boundary.auditEvents).toBe(false);
      expect(method in boundary.failedMutationAttempts).toBe(false);
    }
  });
});

describe("immutability and idempotency", () => {
  it("caller mutation after append does not alter stored event", async () => {
    const boundary = createInMemoryPersistenceBoundary();
    const event = createEventFixture();

    await boundary.amendmentEvents.append(event);
    event.amendedText = "changed after append";

    const stored = await boundary.amendmentEvents.getById("event-0001");
    expect(stored?.amendedText).not.toBe("changed after append");
  });

  it("mutating a retrieved event does not alter stored event", async () => {
    const boundary = createInMemoryPersistenceBoundary();
    const event = createEventFixture();

    await boundary.amendmentEvents.append(event);
    const retrieved = await boundary.amendmentEvents.getById(event.id);
    if (!retrieved) {
      throw new Error("expected stored event");
    }

    retrieved.amendedText = "retrieved mutation";
    const storedAgain = await boundary.amendmentEvents.getById(event.id);

    expect(storedAgain?.amendedText).not.toBe("retrieved mutation");
  });

  it("mutating a listed event does not alter stored history", async () => {
    const boundary = createInMemoryPersistenceBoundary();
    const event = createEventFixture();

    await boundary.amendmentEvents.append(event);
    const listed = await boundary.amendmentEvents.listByJurisdictionProvision({
      jurisdictionId: sampleJurisdiction.id,
    });

    listed[0].amendedText = "listed mutation";
    const storedAgain = await boundary.amendmentEvents.getById(event.id);

    expect(storedAgain?.amendedText).not.toBe("listed mutation");
  });

  it("rejects duplicate event ids", async () => {
    const boundary = createInMemoryPersistenceBoundary();
    const event = createEventFixture();

    await boundary.amendmentEvents.append(event);

    await expect(boundary.amendmentEvents.append(createEventFixture())).rejects.toThrow(/duplicate amendment event id/i);
  });

  it("appends superseding event and preserves old event", async () => {
    const boundary = createInMemoryPersistenceBoundary();
    const original = createEventFixture();
    const superseding = createEventFixture({
      id: "event-0002",
      amendedText: "new text",
      previousHash: original.payloadHash,
      supersedesEventId: original.id,
      idempotencyKey: "idem-0002",
    });

    await boundary.amendmentEvents.append(original);
    await boundary.amendmentEvents.append(superseding);

    const events = await boundary.amendmentEvents.listByJurisdictionProvision({
      jurisdictionId: sampleJurisdiction.id,
      modelProvisionId: original.modelProvisionId,
    });

    expect(events).toHaveLength(2);
    expect(events.find((event) => event.id === original.id)).toBeTruthy();
    expect(events.find((event) => event.id === superseding.id)?.previousHash).toBe(original.payloadHash);
  });

  it("detects duplicate idempotency key for same jurisdiction and source", async () => {
    const boundary = createInMemoryPersistenceBoundary();
    await boundary.amendmentEvents.append(createEventFixture());

    await expect(
      boundary.amendmentEvents.append(
        createEventFixture({
          id: "event-0002",
          idempotencyKey: "idem-0001",
        }),
      ),
    ).rejects.toThrow(/duplicate idempotency key/i);
  });

  it("does not overwrite when same idempotency key is used for different jurisdiction", async () => {
    const boundary = createInMemoryPersistenceBoundary();
    await boundary.amendmentEvents.append(createEventFixture());
    await boundary.amendmentEvents.append(
      createEventFixture({
        id: "event-0002",
        jurisdictionId: "us-fl-elsewhere",
        idempotencyKey: "idem-0001",
      }),
    );

    expect(await boundary.amendmentEvents.getById("event-0001")).toBeTruthy();
    expect(await boundary.amendmentEvents.getById("event-0002")).toBeTruthy();
  });

  it("does not overwrite when same idempotency key is used for different source", async () => {
    const boundary = createInMemoryPersistenceBoundary();
    await boundary.amendmentEvents.append(createEventFixture());
    await boundary.amendmentEvents.append(
      createEventFixture({
        id: "event-0002",
        source: "API",
        idempotencyKey: "idem-0001",
      }),
    );

    expect(await boundary.amendmentEvents.getById("event-0001")).toBeTruthy();
    expect(await boundary.amendmentEvents.getById("event-0002")).toBeTruthy();
  });
});

describe("projection rebuild and chain verification", () => {
  it("rebuilds expected current effective code", () => {
    const projection = rebuildEffectiveCodeProjection(
      [createEventFixture()],
      modelCodeProvisions[0],
      {
        jurisdictionId: sampleJurisdiction.id,
        generatedAt: "2026-06-11T12:00:00.000Z",
      },
    );

    expect(projection.compiledProvision.status).toBe("LOCALLY_AMENDED");
  });

  it("ignores rejected events", () => {
    const projection = rebuildEffectiveCodeProjection(
      [
        createEventFixture({ id: "rejected", status: "REJECTED", amendedText: "bad" }),
        createEventFixture({ id: "current", amendedText: "good" }),
      ],
      modelCodeProvisions[0],
      {
        jurisdictionId: sampleJurisdiction.id,
      },
    );

    expect(projection.compiledProvision.eventId).toBe("current");
  });

  it("ignores superseded events", () => {
    const projection = rebuildEffectiveCodeProjection(
      [
        createEventFixture({ id: "superseded", status: "SUPERSEDED", amendedText: "old" }),
        createEventFixture({ id: "current", amendedText: "new" }),
      ],
      modelCodeProvisions[0],
      {
        jurisdictionId: sampleJurisdiction.id,
      },
    );

    expect(projection.compiledProvision.eventId).toBe("current");
  });

  it("selects the latest valid event", () => {
    const projection = rebuildEffectiveCodeProjection(
      [
        createEventFixture({
          id: "older",
          amendedText: "older",
          effectiveDate: "2026-07-01",
          submittedAt: "2026-06-10T12:00:00.000Z",
        }),
        createEventFixture({
          id: "latest",
          amendedText: "latest",
          effectiveDate: "2026-08-01",
          submittedAt: "2026-06-11T12:00:00.000Z",
        }),
      ],
      modelCodeProvisions[0],
      {
        jurisdictionId: sampleJurisdiction.id,
        generatedAt: "2026-06-11T12:00:00.000Z",
      },
    );

    expect(projection.compiledProvision.displayText).toBe("latest");
  });

  it("includes metadata, disclaimer, and source hash references", () => {
    const projection = rebuildEffectiveCodeProjection(
      [createEventFixture({ previousHash: "codescout-hash-prev", payloadHash: "codescout-hash-next" })],
      modelCodeProvisions[0],
      {
        jurisdictionId: sampleJurisdiction.id,
        generatedAt: "2026-06-11T12:00:00.000Z",
      },
    );

    expect(projection.compiledProvision.metadata.generatedAt).toBe("2026-06-11T12:00:00.000Z");
    expect(projection.compiledProvision.metadata.disclaimer).toBe(AUTHORITY_DISCLAIMER);
    expect(projection.compiledProvision.payloadHash).toBe("codescout-hash-next");
    expect(projection.compiledProvision.previousHash).toBe("codescout-hash-prev");
  });

  it("does not mutate input events", () => {
    const events = [createEventFixture()];
    const original = structuredClone(events);

    rebuildEffectiveCodeProjection(events, modelCodeProvisions[0], {
      jurisdictionId: sampleJurisdiction.id,
    });

    expect(events).toEqual(original);
  });

  it("verifies a valid hash chain", () => {
    const original = createEventFixture();
    const superseding = createEventFixture({
      id: "event-0002",
      supersedesEventId: original.id,
      previousHash: original.payloadHash,
    });

    expect(verifyHashChain([original, superseding])).toEqual({ valid: true });
  });

  it("detects missing previousHash or mismatched chain values", () => {
    const original = createEventFixture();
    const broken = createEventFixture({
      id: "event-0002",
      supersedesEventId: original.id,
      previousHash: "wrong-hash",
    });

    const result = verifyHashChain([original, broken]);
    expect(result.valid).toBe(false);
  });
});
