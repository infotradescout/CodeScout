import { describe, expect, it } from "vitest";
import {
  AHJ_DISCLAIMER,
  EvidenceStatus,
  SourceType,
  SupersessionStatus,
  assertAuditAttribution,
  assertEvidenceCompleteness,
  computeEffectiveProvision,
  serializeComputedEffectiveProvision,
  type EvidenceRecord,
  type LocalAmendment,
  type ModelCodeProvision,
} from "../src/codescout/immutableLocalAmendmentFoundation";

function createEvidence(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: "evidence-1",
    title: "Municipal ordinance excerpt",
    sourceType: SourceType.ordinance,
    url: "https://example.gov/ordinance-2026-18",
    quoteOrSummary: "The municipality replaces the base wind text with a stricter local requirement.",
    actorId: "actor-1",
    timestamp: "2026-06-11T12:00:00.000Z",
    supportsFieldPaths: ["amendmentText"],
    evidenceStatus: EvidenceStatus.source_backed,
    ...overrides,
  };
}

function createBaseProvision(overrides: Partial<ModelCodeProvision> = {}): ModelCodeProvision {
  return {
    id: "irc-2021-r301-2-1",
    jurisdictionScope: "model_code",
    codeFamily: "IRC",
    edition: "2021",
    section: "R301.2.1",
    title: "Wind Design Criteria",
    text: "Base model code text.",
    evidence: [createEvidence({ id: "base-evidence", sourceType: SourceType.model_code, supportsFieldPaths: ["text"] })],
    ...overrides,
  };
}

function createAmendment(overrides: Partial<LocalAmendment> = {}): LocalAmendment {
  return {
    id: "amendment-1",
    jurisdiction: {
      state: "FL",
      municipality: "Pensacola",
      authorityType: "city",
    },
    affectedBaseProvisionId: "irc-2021-r301-2-1",
    title: "Local Wind Replacement",
    amendmentText: "Local text replaces the base provision.",
    effect: "replaces",
    actorId: "actor-2",
    timestamp: "2026-06-12T12:00:00.000Z",
    evidence: [createEvidence({ id: "amendment-evidence", supportsFieldPaths: ["amendmentText", "effect"] })],
    ...overrides,
  };
}

describe("codescout immutable local amendment foundation", () => {
  it("local amendment with effect replaces explicitly supersedes base provision text", () => {
    const provision = computeEffectiveProvision(createBaseProvision(), [createAmendment()], {
      computedAt: "2026-06-13T12:00:00.000Z",
      computedByActorId: "actor-3",
    });

    expect(provision.supersessionStatus).toBe(SupersessionStatus.local_amendment_supersedes);
    expect(provision.effectiveText).toBe("Local text replaces the base provision.");
  });

  it("local amendment remains structurally separate from base provision", () => {
    const baseProvision = createBaseProvision();
    const amendment = createAmendment();
    const provision = computeEffectiveProvision(baseProvision, [amendment], {
      computedAt: "2026-06-13T12:00:00.000Z",
      computedByActorId: "actor-3",
    });

    expect(provision.baseProvision.text).toBe("Base model code text.");
    expect(provision.localAmendments[0].amendmentText).toBe("Local text replaces the base provision.");
    expect(provision.baseProvision).not.toBe(provision.localAmendments[0] as never);
  });

  it("empty base evidence produces incomplete or unverified evidence status", () => {
    const result = assertEvidenceCompleteness({
      baseProvision: createBaseProvision({ evidence: [] }),
      localAmendments: [],
    });

    expect(result.evidenceCompleteness).toBe("missing");
    expect(result.evidenceStatus).toBe(EvidenceStatus.incomplete);
    expect(result.missingFieldPaths).toEqual(["baseProvision.evidence"]);
    expect(result.missingEvidenceDetails).toEqual([
      {
        fieldPath: "baseProvision.evidence",
        entityType: "baseProvision",
        entityId: "irc-2021-r301-2-1",
        reason: "missing_evidence",
        message: "Base provision irc-2021-r301-2-1 has no evidence records.",
      },
    ]);
  });

  it("empty amendment evidence produces incomplete or unverified evidence status", () => {
    const result = assertEvidenceCompleteness({
      baseProvision: createBaseProvision(),
      localAmendments: [createAmendment({ evidence: [] })],
    });

    expect(result.evidenceCompleteness).toBe("missing");
    expect(result.evidenceStatus).toBe(EvidenceStatus.incomplete);
    expect(result.missingFieldPaths).toEqual(["localAmendments.amendment-1.evidence"]);
    expect(result.missingEvidenceDetails).toEqual([
      {
        fieldPath: "localAmendments.amendment-1.evidence",
        entityType: "localAmendment",
        entityId: "amendment-1",
        reason: "missing_evidence",
        message: "Local amendment amendment-1 has no evidence records.",
      },
    ]);
  });

  it("incomplete evidence records produce structured readable missing evidence details", () => {
    const result = assertEvidenceCompleteness({
      baseProvision: createBaseProvision({
        evidence: [createEvidence({ id: "base-incomplete", evidenceStatus: EvidenceStatus.incomplete })],
      }),
      localAmendments: [
        createAmendment({
          evidence: [createEvidence({ id: "amendment-incomplete", evidenceStatus: EvidenceStatus.incomplete })],
        }),
      ],
    });

    expect(result.evidenceCompleteness).toBe("missing");
    expect(result.evidenceStatus).toBe(EvidenceStatus.incomplete);
    expect(result.missingFieldPaths).toEqual([
      "baseProvision.evidence.base-incomplete",
      "localAmendments.amendment-1.evidence.amendment-incomplete",
    ]);
    expect(result.missingEvidenceDetails).toEqual([
      {
        fieldPath: "baseProvision.evidence.base-incomplete",
        entityType: "evidenceRecord",
        entityId: "base-incomplete",
        reason: "incomplete_evidence",
        message: "Evidence record base-incomplete for base provision irc-2021-r301-2-1 is marked incomplete.",
      },
      {
        fieldPath: "localAmendments.amendment-1.evidence.amendment-incomplete",
        entityType: "evidenceRecord",
        entityId: "amendment-incomplete",
        reason: "incomplete_evidence",
        message: "Evidence record amendment-incomplete for local amendment amendment-1 is marked incomplete.",
      },
    ]);
  });

  it("any LocalAmendment without actorId is rejected", () => {
    expect(() => assertAuditAttribution(createAmendment({ actorId: "" }))).toThrow(/actorId is required/i);
  });

  it("any LocalAmendment without timestamp is rejected", () => {
    expect(() => assertAuditAttribution(createAmendment({ timestamp: "" }))).toThrow(/timestamp is required/i);
  });

  it("any EvidenceRecord without actorId is rejected", () => {
    expect(() => assertAuditAttribution(createEvidence({ actorId: "" }))).toThrow(/actorId is required/i);
  });

  it("any EvidenceRecord without timestamp is rejected", () => {
    expect(() => assertAuditAttribution(createEvidence({ timestamp: "" }))).toThrow(/timestamp is required/i);
  });

  it("serialized output always includes AHJ_DISCLAIMER", () => {
    const serialized = serializeComputedEffectiveProvision(
      computeEffectiveProvision(createBaseProvision(), [createAmendment()], {
        computedAt: "2026-06-13T12:00:00.000Z",
        computedByActorId: "actor-3",
      }),
    );

    expect(serialized.disclaimer).toBe(AHJ_DISCLAIMER);
  });

  it("serialized output is stable and JSON serializable", () => {
    const provision = computeEffectiveProvision(createBaseProvision(), [createAmendment()], {
      computedAt: "2026-06-13T12:00:00.000Z",
      computedByActorId: "actor-3",
    });

    const left = JSON.stringify(serializeComputedEffectiveProvision(provision));
    const right = JSON.stringify(serializeComputedEffectiveProvision(provision));

    expect(left).toBe(right);
    expect(JSON.parse(left).computedAt).toBe("2026-06-13T12:00:00.000Z");
  });

  it("computeEffectiveProvision rejects missing computedAt", () => {
    expect(() =>
      computeEffectiveProvision(createBaseProvision(), [createAmendment()], {
        computedAt: "" as never,
        computedByActorId: "actor-3",
      }),
    ).toThrow(/computedAt is required/i);
  });

  it("computeEffectiveProvision rejects missing computedByActorId", () => {
    expect(() =>
      computeEffectiveProvision(createBaseProvision(), [createAmendment()], {
        computedAt: "2026-06-13T12:00:00.000Z",
        computedByActorId: "",
      }),
    ).toThrow(/computedByActorId is required/i);
  });

  it("computeEffectiveProvision does not default computedAt to epoch", () => {
    expect(() =>
      computeEffectiveProvision(createBaseProvision(), [createAmendment()], {
        computedAt: undefined as never,
        computedByActorId: "actor-3",
      }),
    ).toThrow(/computedAt is required/i);
  });

  it("computeEffectiveProvision does not use Date.now or generated runtime timestamps", () => {
    const provision = computeEffectiveProvision(createBaseProvision(), [createAmendment()], {
      computedAt: "2024-01-02T03:04:05.678Z",
      computedByActorId: "actor-3",
    });

    expect(provision.computedAt).toBe("2024-01-02T03:04:05.678Z");
  });

  it("banned authority terms are not present in exported field names or serialized status values", () => {
    const serialized = serializeComputedEffectiveProvision(
      computeEffectiveProvision(createBaseProvision(), [createAmendment()], {
        computedAt: "2026-06-13T12:00:00.000Z",
        computedByActorId: "actor-3",
      }),
    );
    const bannedTerms = ["readiness", "compliance", "compliant", "legal", "approved", "guaranteed", "risk"];
    const fieldNames = [
      ...Object.keys(serialized),
      ...Object.keys(serialized.baseProvision),
      ...Object.keys(serialized.localAmendments[0]),
    ];
    const statusValues = [serialized.supersessionStatus, serialized.evidenceCompleteness];

    for (const term of bannedTerms) {
      expect(fieldNames.some((fieldName) => fieldName.includes(term))).toBe(false);
      expect(statusValues.some((statusValue) => String(statusValue).includes(term))).toBe(false);
    }
  });

  it("ambiguous amendment effect produces supersessionStatus ambiguous", () => {
    const provision = computeEffectiveProvision(createBaseProvision(), [createAmendment({ effect: "ambiguous" })], {
      computedAt: "2026-06-13T12:00:00.000Z",
      computedByActorId: "actor-3",
    });

    expect(provision.supersessionStatus).toBe(SupersessionStatus.ambiguous);
  });

  it("no amendment produces supersessionStatus no_local_change", () => {
    const provision = computeEffectiveProvision(createBaseProvision(), [], {
      computedAt: "2026-06-13T12:00:00.000Z",
      computedByActorId: "actor-3",
    });

    expect(provision.supersessionStatus).toBe(SupersessionStatus.no_local_change);
  });

  it("source_backed amendment evidence contributes to complete only when base and amendment evidence are complete", () => {
    const result = assertEvidenceCompleteness({
      baseProvision: createBaseProvision(),
      localAmendments: [createAmendment()],
    });

    expect(result.evidenceCompleteness).toBe("complete");
    expect(result.evidenceStatus).toBe(EvidenceStatus.source_backed);
  });

  it("computed output never claims AHJ acceptance, permit approval, legal compliance, or guaranteed correctness", () => {
    const serializedText = JSON.stringify(
      serializeComputedEffectiveProvision(
        computeEffectiveProvision(createBaseProvision(), [createAmendment()], {
          computedAt: "2026-06-13T12:00:00.000Z",
          computedByActorId: "actor-3",
        }),
      ),
    ).toLowerCase();

    for (const term of ["permit approval", "accepted by ahj", "legal compliance", "guaranteed correctness"]) {
      expect(serializedText.includes(term)).toBe(false);
    }
  });
});
