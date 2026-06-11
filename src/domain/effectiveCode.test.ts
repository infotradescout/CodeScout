import { describe, expect, it } from "vitest";
import { computeEffectiveProvision, computeEffectiveProvisionFromEvents } from "./effectiveCode";
import { createEventFixture, modelCodeProvisions, sampleJurisdiction } from "./fixtures";

describe("computeEffectiveProvision", () => {
  it("computes BASE_CODE when event is missing", () => {
    const result = computeEffectiveProvision(modelCodeProvisions[0], undefined, {
      jurisdictionId: sampleJurisdiction.id,
      generatedAt: "2026-06-11T12:00:00.000Z",
    });

    expect(result.status).toBe("BASE_CODE");
  });

  it("computes BASE_CODE for INHERIT_BASE", () => {
    const result = computeEffectiveProvision(
      modelCodeProvisions[0],
      createEventFixture({ action: "INHERIT_BASE", amendedText: undefined }),
      {
        generatedAt: "2026-06-11T12:00:00.000Z",
      },
    );

    expect(result.status).toBe("BASE_CODE");
  });

  it("computes LOCALLY_AMENDED and preserves texts", () => {
    const result = computeEffectiveProvision(modelCodeProvisions[0], createEventFixture());

    expect(result.status).toBe("LOCALLY_AMENDED");
    expect(result.baseText).toBe(modelCodeProvisions[0].baseText);
    expect(result.amendedText).toBe(createEventFixture().amendedText);
    expect(result.metadata.computedStatus).toBe("LOCALLY_AMENDED");
    expect(result.metadata.jurisdictionId).toBe(sampleJurisdiction.id);
    expect(result.metadata.provisionId).toBe(modelCodeProvisions[0].id);
    expect(result.metadata.generatedAt).toBeTruthy();
    expect(result.metadata.disclaimer).toBeTruthy();
  });

  it("computes LOCALLY_DELETED with null displayText", () => {
    const result = computeEffectiveProvision(
      modelCodeProvisions[0],
      createEventFixture({ action: "DELETE", amendedText: undefined }),
    );

    expect(result.status).toBe("LOCALLY_DELETED");
    expect(result.displayText).toBeNull();
  });

  it("does not mutate inputs", () => {
    const provision = structuredClone(modelCodeProvisions[0]);
    const event = createEventFixture();
    const originalProvision = structuredClone(provision);
    const originalEvent = structuredClone(event);

    computeEffectiveProvision(provision, event);

    expect(provision).toEqual(originalProvision);
    expect(event).toEqual(originalEvent);
  });
});

describe("computeEffectiveProvisionFromEvents", () => {
  it("ignores rejected events", () => {
    const result = computeEffectiveProvisionFromEvents(modelCodeProvisions[0], [
      createEventFixture({ id: "rejected", status: "REJECTED", amendedText: "Rejected text" }),
      createEventFixture({ id: "accepted", amendedText: "Accepted text" }),
    ]);

    expect(result.eventId).toBe("accepted");
  });

  it("ignores superseded events", () => {
    const result = computeEffectiveProvisionFromEvents(modelCodeProvisions[0], [
      createEventFixture({ id: "superseded", status: "SUPERSEDED", amendedText: "Old text" }),
      createEventFixture({ id: "current", amendedText: "Current text" }),
    ]);

    expect(result.eventId).toBe("current");
  });

  it("selects latest valid event", () => {
    const result = computeEffectiveProvisionFromEvents(modelCodeProvisions[0], [
      createEventFixture({
        id: "older",
        amendedText: "Older text",
        effectiveDate: "2026-07-01",
        submittedAt: "2026-06-10T12:00:00.000Z",
      }),
      createEventFixture({
        id: "latest",
        amendedText: "Latest text",
        effectiveDate: "2026-08-01",
        submittedAt: "2026-06-11T12:00:00.000Z",
      }),
    ]);

    expect(result.eventId).toBe("latest");
    expect(result.displayText).toBe("Latest text");
  });
});
