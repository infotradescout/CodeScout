import { describe, expect, it } from "vitest";
import {
  AHJ_DISCLAIMER,
  EffectiveDateBasis,
  EvidenceStatus,
  MunicipalDocumentType,
  MunicipalIntakeReviewStatus,
  SourceType,
  SourceAcquisitionMethod,
  SupersessionStatus,
  assertAuditAttribution,
  assertEvidenceCompleteness,
  computeEffectiveProvision,
  serializeComputedEffectiveProvision,
  type EvidenceRecord,
  type LocalAmendment,
  type ModelCodeProvision,
  type MunicipalIntakeEvidence,
} from "../src/codescout/immutableLocalAmendmentFoundation";

function createMunicipalIntakeEvidence(overrides: Partial<MunicipalIntakeEvidence> = {}): MunicipalIntakeEvidence {
  return {
    sourceDocumentId: "pensacola-ordinance-2026-18",
    sourceDocumentTitle: "Pensacola Ordinance 2026-18",
    sourceLocator: "https://example.gov/ordinance-2026-18",
    publicationDate: "2026-06-10",
    jurisdiction: {
      name: "Pensacola",
      state: "FL",
      county: "Escambia",
      geopoliticalCode: "1255925",
    },
    documentType: MunicipalDocumentType.ordinance,
    acquisitionMethod: SourceAcquisitionMethod.official_site_pull,
    effectiveDateBasis: EffectiveDateBasis.stated_effective_date,
    adoptionOrAmendmentReference: {
      referenceType: "ordinance_number",
      value: "2026-18",
    },
    sectionOrProvisionCitation: "R301.2.1",
    extractionActorId: "operator-1",
    reviewStatus: MunicipalIntakeReviewStatus.operator_verified,
    ...overrides,
  };
}

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
    municipalIntakeEvidence: createMunicipalIntakeEvidence(),
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

function evaluateBaseEvidence(evidence: EvidenceRecord) {
  return assertEvidenceCompleteness({
    baseProvision: createBaseProvision({ evidence: [evidence] }),
    localAmendments: [],
  });
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
        code: "MISSING_EVIDENCE",
        severity: "blocking",
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
        code: "MISSING_EVIDENCE",
        severity: "blocking",
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
        code: "INCOMPLETE_EVIDENCE",
        severity: "blocking",
        message: "Evidence record base-incomplete for base provision irc-2021-r301-2-1 is marked incomplete.",
      },
      {
        fieldPath: "localAmendments.amendment-1.evidence.amendment-incomplete",
        entityType: "evidenceRecord",
        entityId: "amendment-incomplete",
        reason: "incomplete_evidence",
        code: "INCOMPLETE_EVIDENCE",
        severity: "blocking",
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

  it("computed provision with complete municipal intake source evidence passes", () => {
    const provision = computeEffectiveProvision(createBaseProvision(), [createAmendment()], {
      computedAt: "2026-06-13T12:00:00.000Z",
      computedByActorId: "actor-3",
    });

    expect(provision.evidenceCompleteness).toBe("complete");
    expect(provision.baseProvision.evidence[0].municipalIntakeEvidence?.sourceDocumentId).toBe(
      "pensacola-ordinance-2026-18",
    );
    expect(provision.localAmendments[0].evidence[0].municipalIntakeEvidence?.reviewStatus).toBe(
      MunicipalIntakeReviewStatus.operator_verified,
    );
  });

  it("missing source document identity fails closed with structured missingEvidenceDetails", () => {
    const result = evaluateBaseEvidence(
      createEvidence({
        municipalIntakeEvidence: createMunicipalIntakeEvidence({ sourceDocumentId: "" }),
      }),
    );

    expect(result.evidenceCompleteness).toBe("missing");
    expect(result.missingEvidenceDetails).toEqual([
      expect.objectContaining({
        fieldPath: "baseProvision.evidence.evidence-1.municipalIntakeEvidence.sourceDocumentId",
        reason: "missing_municipal_intake_evidence",
        code: "MISSING_MUNICIPAL_INTAKE_EVIDENCE",
        severity: "blocking",
      }),
    ]);
    expect(typeof result.missingEvidenceDetails[0]).toBe("object");
  });

  it("missing jurisdiction identity fails closed with structured missingEvidenceDetails", () => {
    const result = evaluateBaseEvidence(
      createEvidence({
        municipalIntakeEvidence: createMunicipalIntakeEvidence({
          jurisdiction: { name: "", state: "", county: "Escambia", geopoliticalCode: "1255925" },
        }),
      }),
    );

    expect(result.evidenceCompleteness).toBe("missing");
    expect(result.missingEvidenceDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldPath: "baseProvision.evidence.evidence-1.municipalIntakeEvidence.jurisdiction.name",
          severity: "blocking",
        }),
        expect.objectContaining({
          fieldPath: "baseProvision.evidence.evidence-1.municipalIntakeEvidence.jurisdiction.state",
          severity: "blocking",
        }),
      ]),
    );
  });

  it("missing document type fails closed", () => {
    const result = evaluateBaseEvidence(
      createEvidence({
        municipalIntakeEvidence: createMunicipalIntakeEvidence({ documentType: "" as MunicipalDocumentType }),
      }),
    );

    expect(result.evidenceCompleteness).toBe("missing");
    expect(result.missingFieldPaths).toContain("baseProvision.evidence.evidence-1.municipalIntakeEvidence.documentType");
  });

  it("missing source acquisition method fails closed", () => {
    const result = evaluateBaseEvidence(
      createEvidence({
        municipalIntakeEvidence: createMunicipalIntakeEvidence({
          acquisitionMethod: "" as SourceAcquisitionMethod,
        }),
      }),
    );

    expect(result.evidenceCompleteness).toBe("missing");
    expect(result.missingFieldPaths).toContain(
      "baseProvision.evidence.evidence-1.municipalIntakeEvidence.acquisitionMethod",
    );
  });

  it("missing section or provision citation fails closed", () => {
    const result = evaluateBaseEvidence(
      createEvidence({
        municipalIntakeEvidence: createMunicipalIntakeEvidence({ sectionOrProvisionCitation: "" }),
      }),
    );

    expect(result.evidenceCompleteness).toBe("missing");
    expect(result.missingFieldPaths).toContain(
      "baseProvision.evidence.evidence-1.municipalIntakeEvidence.sectionOrProvisionCitation",
    );
  });

  it("missing extraction or computation actor fails closed", () => {
    const result = evaluateBaseEvidence(
      createEvidence({
        municipalIntakeEvidence: createMunicipalIntakeEvidence({ extractionActorId: "" }),
      }),
    );

    expect(result.evidenceCompleteness).toBe("missing");
    expect(result.missingFieldPaths).toContain(
      "baseProvision.evidence.evidence-1.municipalIntakeEvidence.extractionActorId",
    );
  });

  it("missing review status fails closed", () => {
    const result = evaluateBaseEvidence(
      createEvidence({
        municipalIntakeEvidence: createMunicipalIntakeEvidence({
          reviewStatus: "" as MunicipalIntakeReviewStatus,
        }),
      }),
    );

    expect(result.evidenceCompleteness).toBe("missing");
    expect(result.missingFieldPaths).toContain("baseProvision.evidence.evidence-1.municipalIntakeEvidence.reviewStatus");
  });

  it("unknown effective date basis does not create an authority or completion claim", () => {
    const result = evaluateBaseEvidence(
      createEvidence({
        municipalIntakeEvidence: createMunicipalIntakeEvidence({
          effectiveDateBasis: EffectiveDateBasis.unknown,
        }),
      }),
    );

    expect(result.evidenceCompleteness).toBe("partial");
    expect(result.evidenceStatus).toBe(EvidenceStatus.unverified);
    expect(result.missingEvidenceDetails).toEqual([
      expect.objectContaining({
        fieldPath: "baseProvision.evidence.evidence-1.municipalIntakeEvidence.effectiveDateBasis",
        reason: "uncertain_municipal_intake_evidence",
        code: "UNCERTAIN_MUNICIPAL_INTAKE_EVIDENCE",
        severity: "review_required",
      }),
    ]);
  });

  it("adoption or amendment reference absence is structured instead of fake data", () => {
    const result = evaluateBaseEvidence(
      createEvidence({
        municipalIntakeEvidence: createMunicipalIntakeEvidence({
          adoptionOrAmendmentReference: undefined,
        }),
      }),
    );

    expect(result.evidenceCompleteness).toBe("partial");
    expect(result.missingEvidenceDetails).toEqual([
      expect.objectContaining({
        fieldPath: "baseProvision.evidence.evidence-1.municipalIntakeEvidence.adoptionOrAmendmentReference",
        severity: "review_required",
      }),
    ]);
    expect(JSON.stringify(result).toLowerCase()).not.toContain("fake");
  });

  it("adoption or amendment reference can be explicitly not applicable without inventing data", () => {
    const result = evaluateBaseEvidence(
      createEvidence({
        municipalIntakeEvidence: createMunicipalIntakeEvidence({
          adoptionOrAmendmentReference: {
            referenceType: "not_applicable",
            notApplicableReason: "Base model code evidence does not have a local adoption reference.",
          },
        }),
      }),
    );

    expect(result.evidenceCompleteness).toBe("complete");
    expect(result.missingEvidenceDetails).toEqual([]);
  });

  it("missingEvidenceDetails remains structured objects, not string-only details", () => {
    const result = evaluateBaseEvidence(
      createEvidence({
        municipalIntakeEvidence: createMunicipalIntakeEvidence({ sourceDocumentId: "" }),
      }),
    );

    expect(result.missingEvidenceDetails.length).toBeGreaterThan(0);
    expect(result.missingEvidenceDetails.every((detail) => typeof detail === "object")).toBe(true);
    expect(result.missingEvidenceDetails.every((detail) => "fieldPath" in detail && "code" in detail)).toBe(true);
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

  it("computed output never claims production validity", () => {
    const serializedText = JSON.stringify(
      serializeComputedEffectiveProvision(
        computeEffectiveProvision(createBaseProvision(), [createAmendment()], {
          computedAt: "2026-06-13T12:00:00.000Z",
          computedByActorId: "actor-3",
        }),
      ),
    ).toLowerCase();

    for (const term of ["production valid", "production-ready", "authoritative", "legally binding"]) {
      expect(serializedText.includes(term)).toBe(false);
    }
  });
});
