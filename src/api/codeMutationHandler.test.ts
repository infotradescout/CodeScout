import { describe, expect, it } from "vitest";
import {
  AUTHORITY_DISCLAIMER,
  createEventFixture,
  createMutationRequest,
  modelCodeProvisions,
  sampleJurisdiction,
  type ModelCodeProvision,
} from "../domain";
import { createInMemoryPersistenceBoundary } from "../persistence";
import { handleJurisdictionCodeMutation, type ApiAuthenticatedSubject, type BaseProvisionResolver } from "./index";

function createSubject(overrides: Partial<ApiAuthenticatedSubject> = {}): ApiAuthenticatedSubject {
  return {
    subjectId: "auth0|pensacola-clerk-1842",
    name: "Pensacola Clerk Office",
    email: "clerk.office@pensacola.example.gov",
    role: "Municipal Code Administrator",
    authorizedJurisdictionIds: [sampleJurisdiction.id],
    ...overrides,
  };
}

function createResolver(provisions: ModelCodeProvision[] = modelCodeProvisions): BaseProvisionResolver {
  return async ({ codeFamily, codeYear, sectionNumber }) =>
    provisions.find(
      (provision) =>
        provision.codeFamily === codeFamily &&
        Number(provision.codeYear) === codeYear &&
        provision.sectionNumber === sectionNumber,
    ) ?? null;
}

function createIdFactory() {
  let index = 1;
  return () => String(index++).padStart(4, "0");
}

function createInput(overrides: Partial<Parameters<typeof handleJurisdictionCodeMutation>[0]> = {}) {
  const persistence = createInMemoryPersistenceBoundary();

  return {
    pathJurisdictionId: sampleJurisdiction.id,
    headers: {
      "Idempotency-Key": "idem-0001",
    },
    body: createMutationRequest(),
    persistence,
    baseProvisionResolver: createResolver(),
    authenticatedSubject: createSubject(),
    now: () => "2026-06-11T12:00:00.000Z",
    idFactory: createIdFactory(),
    ...overrides,
  };
}

describe("handleJurisdictionCodeMutation success flow", () => {
  it("valid AMEND returns 202 and appends immutable events", async () => {
    const input = createInput();
    const response = await handleJurisdictionCodeMutation(input);

    expect(response.statusCode).toBe(202);
    if (response.statusCode !== 202) {
      throw new Error("expected accepted response");
    }

    expect(response.body.status).toBe("ACCEPTED");
    expect(response.body.computedEffectiveStatus).toBe("LOCALLY_AMENDED");
    expect(response.body.metadata.generatedAt).toBe("2026-06-11T12:00:00.000Z");
    expect(response.body.metadata.disclaimer).toBe(AUTHORITY_DISCLAIMER);
    expect(response.body.projection.compiledProvision.displayText).toBe(
      (input.body as ReturnType<typeof createMutationRequest>).amendedText,
    );

    const events = await input.persistence.amendmentEvents.listByJurisdictionProvision({
      jurisdictionId: sampleJurisdiction.id,
      modelProvisionId: modelCodeProvisions[0].id,
    });
    const auditEvents = await input.persistence.auditEvents.listAll();
    const failedAttempts = await input.persistence.failedMutationAttempts.listByJurisdiction(sampleJurisdiction.id);

    expect(events).toHaveLength(1);
    expect(auditEvents).toHaveLength(1);
    expect(failedAttempts).toHaveLength(0);
  });

  it("valid DELETE returns 202 with deleted projection", async () => {
    const input = createInput({
      headers: { "Idempotency-Key": "idem-delete" },
      body: createMutationRequest({
        action: "DELETE",
        amendedText: undefined,
        externalMutationId: "pensacola-mut-0002",
      }),
    });

    const response = await handleJurisdictionCodeMutation(input);

    expect(response.statusCode).toBe(202);
    if (response.statusCode !== 202) {
      throw new Error("expected accepted response");
    }

    expect(response.body.computedEffectiveStatus).toBe("LOCALLY_DELETED");
    expect(response.body.projection.compiledProvision.displayText).toBeNull();
  });

  it("valid INHERIT_BASE returns 202 with base status projection", async () => {
    const input = createInput({
      headers: { "Idempotency-Key": "idem-inherit" },
      body: createMutationRequest({
        action: "INHERIT_BASE",
        amendedText: undefined,
        ordinanceReference: undefined,
        effectiveDate: undefined,
        externalMutationId: "pensacola-mut-0003",
      }),
    });

    const response = await handleJurisdictionCodeMutation(input);

    expect(response.statusCode).toBe(202);
    if (response.statusCode !== 202) {
      throw new Error("expected accepted response");
    }

    expect(response.body.computedEffectiveStatus).toBe("BASE_CODE");
    expect(response.body.projection.compiledProvision.displayText).toBe(modelCodeProvisions[0].baseText);
  });
});

describe("handleJurisdictionCodeMutation validation and authorization", () => {
  it("missing subject returns 401 and appends nothing", async () => {
    const input = createInput({
      authenticatedSubject: null,
    });

    const response = await handleJurisdictionCodeMutation(input);

    expect(response.statusCode).toBe(401);
    expect((await input.persistence.auditEvents.listAll())).toHaveLength(0);
    expect(
      await input.persistence.amendmentEvents.listByJurisdictionProvision({
        jurisdictionId: sampleJurisdiction.id,
      }),
    ).toHaveLength(0);
    expect(await input.persistence.failedMutationAttempts.listByJurisdiction(sampleJurisdiction.id)).toHaveLength(0);
  });

  it("unauthorized jurisdiction returns 403 and appends nothing", async () => {
    const input = createInput({
      authenticatedSubject: createSubject({ authorizedJurisdictionIds: ["us-fl-elsewhere"] }),
    });

    const response = await handleJurisdictionCodeMutation(input);

    expect(response.statusCode).toBe(403);
    expect((await input.persistence.auditEvents.listAll())).toHaveLength(0);
    expect(await input.persistence.failedMutationAttempts.listByJurisdiction(sampleJurisdiction.id)).toHaveLength(0);
  });

  it("validation failure returns 400, appends failed attempt, and preserves raw payload", async () => {
    const invalidBody = createMutationRequest({
      amendedText: undefined,
      submittedBy: {
        ...createMutationRequest().submittedBy,
        email: "not-an-email",
      },
    });
    const original = structuredClone(invalidBody);
    const input = createInput({
      headers: {},
      body: invalidBody,
    });

    const response = await handleJurisdictionCodeMutation(input);

    expect(response.statusCode).toBe(400);
    if (response.statusCode !== 400) {
      throw new Error("expected rejected response");
    }

    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(response.body.error.issues).toContain("Idempotency-Key header is required");
    expect(response.body.error.issues).toContain("amendedText is required when action is AMEND");
    expect(response.body.error.issues).toContain("submittedBy.email must be a valid email address");
    expect(response.body.failedMutationAttemptId).toBeTruthy();

    const failedAttempts = await input.persistence.failedMutationAttempts.listByJurisdiction(sampleJurisdiction.id);
    expect(failedAttempts).toHaveLength(1);
    expect(failedAttempts[0].validationErrors).toEqual(response.body.error.issues);
    expect(failedAttempts[0].rawPayloadHash).toMatch(/^codescout-hash-/);
    expect(await input.persistence.auditEvents.listAll()).toHaveLength(0);
    expect(
      await input.persistence.amendmentEvents.listByJurisdictionProvision({
        jurisdictionId: sampleJurisdiction.id,
      }),
    ).toHaveLength(0);
    expect(invalidBody).toEqual(original);
  });
});

describe("handleJurisdictionCodeMutation conflicts and resolution", () => {
  it("duplicate idempotency key returns 409 and does not append second amendment event", async () => {
    const persistence = createInMemoryPersistenceBoundary();
    await persistence.amendmentEvents.append(createEventFixture());

    const input = createInput({
      persistence,
      headers: { "Idempotency-Key": "idem-0001" },
      body: createMutationRequest({
        externalMutationId: "pensacola-mut-0009",
      }),
    });

    const response = await handleJurisdictionCodeMutation(input);
    const events = await persistence.amendmentEvents.listByJurisdictionProvision({
      jurisdictionId: sampleJurisdiction.id,
      modelProvisionId: modelCodeProvisions[0].id,
    });
    const projection = await persistence.effectiveCodeProjections.getByJurisdictionProvision({
      jurisdictionId: sampleJurisdiction.id,
      provisionId: modelCodeProvisions[0].id,
    });

    expect(response.statusCode).toBe(409);
    expect(events).toHaveLength(1);
    expect(projection).toBeNull();
  });

  it("missing base provision returns 422 without appending amendment event", async () => {
    const input = createInput({
      body: createMutationRequest({
        sectionNumber: "R999.9",
      }),
    });

    const response = await handleJurisdictionCodeMutation(input);

    expect(response.statusCode).toBe(422);
    expect(response.body.metadata.generatedAt).toBe("2026-06-11T12:00:00.000Z");
    expect(
      await input.persistence.amendmentEvents.listByJurisdictionProvision({
        jurisdictionId: sampleJurisdiction.id,
      }),
    ).toHaveLength(0);
  });

  it("superseding an existing event creates a new event with previousHash and updates projection", async () => {
    const persistence = createInMemoryPersistenceBoundary();
    const original = createEventFixture({
      id: "event-existing",
      submittedAt: "2026-06-10T12:00:00.000Z",
      effectiveDate: "2026-07-01",
    });
    await persistence.amendmentEvents.append(original);

    const input = createInput({
      persistence,
      headers: { "Idempotency-Key": "idem-0002" },
      now: () => "2026-06-12T12:00:00.000Z",
      body: createMutationRequest({
        amendedText: "Revised local wind text",
        externalMutationId: "pensacola-mut-0010",
        supersedesEventId: original.id,
        effectiveDate: "2026-08-01",
      }),
    });

    const response = await handleJurisdictionCodeMutation(input);
    const events = await persistence.amendmentEvents.listByJurisdictionProvision({
      jurisdictionId: sampleJurisdiction.id,
      modelProvisionId: modelCodeProvisions[0].id,
    });

    expect(response.statusCode).toBe(202);
    if (response.statusCode !== 202) {
      throw new Error("expected accepted response");
    }

    expect(events).toHaveLength(2);
    expect(events.find((event) => event.id === original.id)?.payloadHash).toBe(original.payloadHash);
    const latest = events.find((event) => event.id === response.body.jurisdictionAmendmentEventId);
    expect(latest?.previousHash).toBe(original.payloadHash);
    expect(response.body.projection.compiledProvision.displayText).toBe("Revised local wind text");
  });
});
