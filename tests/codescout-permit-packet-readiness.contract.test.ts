import { describe, expect, it } from "vitest";
import {
  EffectiveDateBasis,
  EvidenceStatus,
  MunicipalDocumentType,
  MunicipalIntakeReviewStatus,
  SourceAcquisitionMethod,
  SourceType,
  type EvidenceRecord,
  type MunicipalIntakeEvidence,
} from "../src/codescout/immutableLocalAmendmentFoundation";
import {
  PROJECT_REQUIREMENT_MATRIX_DISCLAIMERS,
  ProjectRequirementActionType,
  ProjectRequirementCategory,
  ProjectRequirementSeverity,
  ProjectRequirementStatus,
  ResponsibleProjectParty,
  buildProjectRequirementMatrix,
  type BuildProjectRequirementMatrixInput,
  type ProjectRequirementItem,
  type ProjectRequirementMatrix,
  type ProjectScopeInput,
} from "../src/codescout/projectRequirementMatrix";
import {
  PERMIT_PACKET_READINESS_DISCLAIMERS,
  PermitPacketReadinessState,
  PermitPacketSeverity,
  assertPermitPacketReadinessCompleteness,
  buildPermitPacketReadiness,
  type BuildPermitPacketReadinessInput,
  type PermitPacketReadiness,
} from "../src/codescout/permitPacketReadiness";

function createMunicipalIntakeEvidence(overrides: Partial<MunicipalIntakeEvidence> = {}): MunicipalIntakeEvidence {
  return {
    sourceDocumentId: "permit-packet-source-1",
    sourceDocumentTitle: "Pensacola permit packet source",
    sourceLocator: "https://example.gov/permit-packet-source",
    publicationDate: "2026-06-15",
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
    title: "Wind design evidence",
    sourceType: SourceType.ordinance,
    url: "https://example.gov/permit-packet-source",
    quoteOrSummary: "Wind design criteria must be shown on the permit packet drawings.",
    actorId: "operator-1",
    timestamp: "2026-06-15T12:00:00.000Z",
    supportsFieldPaths: ["requirementItems.wind-design.evidenceReferences"],
    evidenceStatus: EvidenceStatus.source_backed,
    municipalIntakeEvidence: createMunicipalIntakeEvidence(),
    ...overrides,
  };
}

function createScope(overrides: Partial<ProjectScopeInput> = {}): ProjectScopeInput {
  return {
    projectType: "residential-addition",
    addressOrJurisdictionReference: "Pensacola, FL",
    workCategory: "addition",
    occupancyUse: "single-family-residential",
    structureType: "wood-frame",
    declaredAssumptions: [
      {
        assumptionId: "wind-design-assumption",
        statement: "The permit packet will include wind design details.",
        supportedByEvidenceIds: ["evidence-1"],
      },
    ],
    missingScopeFields: [],
    ...overrides,
  };
}

function createRequirement(overrides: Partial<ProjectRequirementItem> = {}): ProjectRequirementItem {
  return {
    requirementId: "wind-design-note",
    title: "Include wind design criteria note on permit drawings",
    category: ProjectRequirementCategory.structural,
    actionType: ProjectRequirementActionType.draw,
    responsibleParty: ResponsibleProjectParty.engineer,
    evidenceReferences: [
      {
        evidenceId: "evidence-1",
        sourceDocumentId: "permit-packet-source-1",
        fieldPath: "municipalIntakeEvidence.sectionOrProvisionCitation",
      },
    ],
    status: ProjectRequirementStatus.satisfied,
    severity: ProjectRequirementSeverity.verify_before_submission,
    missingEvidenceDetails: [],
    ...overrides,
  };
}

function createMatrixInput(overrides: Partial<BuildProjectRequirementMatrixInput> = {}): BuildProjectRequirementMatrixInput {
  return {
    projectRequirementMatrixId: "matrix-1",
    computedAt: "2026-06-16T12:00:00.000Z",
    computedByActorId: "operator-2",
    projectScope: createScope(),
    sourceEvidence: [createEvidence()],
    requirementItems: [createRequirement()],
    ...overrides,
  };
}

function createMatrix(overrides: Partial<BuildProjectRequirementMatrixInput> = {}): ProjectRequirementMatrix {
  return buildProjectRequirementMatrix(createMatrixInput(overrides));
}

function createReadinessInput(
  overrides: Partial<BuildPermitPacketReadinessInput> = {},
): BuildPermitPacketReadinessInput {
  return {
    permitPacketReadinessId: "packet-1",
    sourceProjectRequirementMatrix: createMatrix(),
    sourceEvidence: [createEvidence()],
    targetPermitPacketType: "building-permit",
    computedAt: "2026-06-17T12:00:00.000Z",
    computedByActorId: "operator-3",
    ...overrides,
  };
}

describe("codescout permit packet readiness contract", () => {
  it("complete P5 matrix and P4 evidence can produce a Permit Packet Readiness packet", () => {
    const packet = buildPermitPacketReadiness(createReadinessInput());

    expect(packet.permitPacketReadinessId).toBe("packet-1");
    expect(packet.overallStatus).toBe("ready-for-review");
    expect(packet.readinessItems[0].readinessState).toBe("ready");
  });

  it("missing source Project Requirement Matrix fails closed", () => {
    expect(() =>
      buildPermitPacketReadiness(createReadinessInput({ sourceProjectRequirementMatrix: null as never })),
    ).toThrow(/sourceProjectRequirementMatrix is required/i);
  });

  it("missing computedAt fails closed", () => {
    expect(() => buildPermitPacketReadiness(createReadinessInput({ computedAt: "" }))).toThrow(/computedAt is required/i);
  });

  it("missing computedByActorId fails closed", () => {
    expect(() => buildPermitPacketReadiness(createReadinessInput({ computedByActorId: "" }))).toThrow(
      /computedByActorId is required/i,
    );
  });

  it("ready packet items require linked sourceRequirementId and evidence references", () => {
    const packet = buildPermitPacketReadiness(createReadinessInput());

    expect(() =>
      assertPermitPacketReadinessCompleteness({
        ...packet,
        readinessItems: [
          {
            ...packet.readinessItems[0],
            sourceRequirementId: "",
            evidenceReferences: [],
          },
        ],
      }),
    ).toThrow(/MISSING_REQUIREMENT_EVIDENCE/i);
  });

  it("P5 missing items cannot become ready in P6", () => {
    const packet = buildPermitPacketReadiness(
      createReadinessInput({
        sourceProjectRequirementMatrix: createMatrix({
          requirementItems: [
            createRequirement({
              status: ProjectRequirementStatus.missing,
              evidenceReferences: [],
              missingEvidenceDetails: [
                {
                  fieldPath: "requirementItems.wind-design-note.evidenceReferences",
                  entityType: "requirementItem",
                  entityId: "wind-design-note",
                  reason: "missing_requirement_evidence",
                  code: "MISSING_REQUIREMENT_EVIDENCE",
                  severity: "blocking",
                  message: "Wind design evidence is missing.",
                },
              ],
            }),
          ],
        }),
      }),
    );

    expect(packet.readinessItems[0].readinessState).toBe(PermitPacketReadinessState.missing);
  });

  it("P5 blocked items cannot become ready in P6", () => {
    const packet = buildPermitPacketReadiness(
      createReadinessInput({
        sourceProjectRequirementMatrix: createMatrix({
          requirementItems: [
            createRequirement({
              status: ProjectRequirementStatus.blocked,
              evidenceReferences: [],
              missingEvidenceDetails: [
                {
                  fieldPath: "requirementItems.wind-design-note.evidenceReferences",
                  entityType: "requirementItem",
                  entityId: "wind-design-note",
                  reason: "missing_requirement_evidence",
                  code: "MISSING_REQUIREMENT_EVIDENCE",
                  severity: "blocking",
                  message: "Wind design evidence is missing.",
                },
              ],
            }),
          ],
        }),
      }),
    );

    expect(packet.readinessItems[0].readinessState).toBe(PermitPacketReadinessState.blocked);
  });

  it("P5 uncertain items cannot become ready in P6", () => {
    const packet = buildPermitPacketReadiness(
      createReadinessInput({
        sourceProjectRequirementMatrix: createMatrix({
          requirementItems: [createRequirement({ status: ProjectRequirementStatus.uncertain, evidenceReferences: [] })],
        }),
      }),
    );

    expect(packet.readinessItems[0].readinessState).toBe(PermitPacketReadinessState.uncertain);
  });

  it("P5 conflict items cannot become ready in P6", () => {
    const packet = buildPermitPacketReadiness(
      createReadinessInput({
        sourceProjectRequirementMatrix: createMatrix({
          requirementItems: [createRequirement({ status: ProjectRequirementStatus.conflict, evidenceReferences: [] })],
        }),
      }),
    );

    expect(packet.readinessItems[0].readinessState).toBe(PermitPacketReadinessState.conflict);
    expect(packet.overallStatus).toBe("conflict");
  });

  it("missing evidence produces structured missingEvidenceDetails", () => {
    const packet = buildPermitPacketReadiness(
      createReadinessInput({
        sourceEvidence: [],
      }),
    );

    expect(packet.readinessItems[0].readinessState).toBe(PermitPacketReadinessState.blocked);
    expect(packet.missingEvidenceDetails).toEqual([
      expect.objectContaining({
        fieldPath: "readinessItems.packet:wind-design-note.evidenceReferences",
        code: "MISSING_REQUIREMENT_EVIDENCE",
        severity: "blocking",
      }),
    ]);
  });

  it("AHJ verification items become pending-verification, not ready", () => {
    const packet = buildPermitPacketReadiness(
      createReadinessInput({
        sourceProjectRequirementMatrix: createMatrix({
          requirementItems: [
            createRequirement({
              requirementId: "ahj-floodplain-question",
              title: "Ask AHJ whether floodplain review applies",
              category: ProjectRequirementCategory.floodplain,
              actionType: ProjectRequirementActionType.ask_AHJ,
              responsibleParty: ResponsibleProjectParty.AHJ,
              evidenceReferences: [
                {
                  evidenceId: "evidence-1",
                  sourceDocumentId: "permit-packet-source-1",
                },
              ],
            }),
          ],
        }),
      }),
    );

    expect(packet.readinessItems[0].readinessState).toBe(PermitPacketReadinessState.pending_verification);
  });

  it("AHJ verification needs are grouped under ahjVerificationNeeds", () => {
    const packet = buildPermitPacketReadiness(
      createReadinessInput({
        sourceProjectRequirementMatrix: createMatrix({
          requirementItems: [
            createRequirement({
              requirementId: "ahj-floodplain-question",
              title: "Ask AHJ whether floodplain review applies",
              category: ProjectRequirementCategory.floodplain,
              actionType: ProjectRequirementActionType.ask_AHJ,
              responsibleParty: ResponsibleProjectParty.AHJ,
              evidenceReferences: [
                {
                  evidenceId: "evidence-1",
                  sourceDocumentId: "permit-packet-source-1",
                },
              ],
            }),
          ],
        }),
      }),
    );

    expect(packet.ahjVerificationNeeds).toHaveLength(1);
    expect(packet.ahjVerificationNeeds[0].packetItemId).toBe("packet:ahj-floodplain-question");
    expect(packet.overallStatus).toBe("requires-AHJ-verification");
  });

  it("unsupported assumptions are preserved", () => {
    const packet = buildPermitPacketReadiness(
      createReadinessInput({
        sourceProjectRequirementMatrix: createMatrix({
          projectScope: createScope({
            declaredAssumptions: [
              {
                assumptionId: "unsupported-zoning-assumption",
                statement: "Zoning clearance is already resolved.",
              },
            ],
          }),
        }),
      }),
    );

    expect(packet.unsupportedAssumptions).toEqual([
      expect.objectContaining({ assumptionId: "unsupported-zoning-assumption" }),
    ]);
    expect(packet.overallStatus).toBe("insufficient-evidence");
  });

  it("role action summary is generated deterministically", () => {
    const packet = buildPermitPacketReadiness(
      createReadinessInput({
        sourceProjectRequirementMatrix: createMatrix({
          requirementItems: [
            createRequirement(),
            createRequirement({
              requirementId: "document-attachment",
              title: "Attach site plan",
              category: ProjectRequirementCategory.document,
              actionType: ProjectRequirementActionType.attach,
              responsibleParty: ResponsibleProjectParty.permit_expediter,
              status: ProjectRequirementStatus.satisfied,
              severity: ProjectRequirementSeverity.verify_before_submission,
            }),
          ],
        }),
      }),
    );

    expect(packet.roleActionSummary).toEqual([
      {
        responsibleParty: "engineer",
        totalItems: 1,
        readyItems: 1,
        blockedItems: 0,
        pendingVerificationItems: 0,
        nextActions: ["draw"],
      },
      {
        responsibleParty: "permit-expediter",
        totalItems: 1,
        readyItems: 1,
        blockedItems: 0,
        pendingVerificationItems: 0,
        nextActions: ["provide-document"],
      },
    ]);
  });

  it("required disclaimer object fields exist on the returned packet", () => {
    const packet = buildPermitPacketReadiness(createReadinessInput());

    expect(packet.disclaimers).toEqual(PERMIT_PACKET_READINESS_DISCLAIMERS);
    expect(packet.disclaimers.referenceOnlyDisclaimer).toBeTruthy();
    expect(packet.disclaimers.noLegalAuthorityDisclaimer).toBeTruthy();
    expect(packet.disclaimers.noPermitApprovalDisclaimer).toBeTruthy();
    expect(packet.disclaimers.noCodeComplianceCertificationDisclaimer).toBeTruthy();
    expect(packet.disclaimers.noAHJApprovalDisclaimer).toBeTruthy();
  });

  it("validation fails if required disclaimer fields are missing", () => {
    const packet = buildPermitPacketReadiness(createReadinessInput());

    expect(() =>
      assertPermitPacketReadinessCompleteness({
        ...packet,
        disclaimers: {
          ...packet.disclaimers,
          noAHJApprovalDisclaimer: "",
        },
      } as PermitPacketReadiness),
    ).toThrow(/MALFORMED_DISCLAIMER/i);
  });

  it("validation fails if a readiness item marked ready has no evidence", () => {
    const packet = buildPermitPacketReadiness(createReadinessInput());

    expect(() =>
      assertPermitPacketReadinessCompleteness({
        ...packet,
        readinessItems: [
          {
            ...packet.readinessItems[0],
            readinessState: PermitPacketReadinessState.ready,
            evidenceReferences: [],
          },
        ],
      }),
    ).toThrow(/MISSING_REQUIREMENT_EVIDENCE/i);
  });

  it("no legal authority, permit approval, AHJ approval, production-validity, or code compliance certification claim is emitted", () => {
    const serializedText = JSON.stringify(buildPermitPacketReadiness(createReadinessInput())).toLowerCase();

    for (const term of [
      "grants legal authority",
      "permit approved",
      "ahj approved",
      "production valid",
      "production-ready",
      "code compliance certified",
      "official readiness granted",
    ]) {
      expect(serializedText.includes(term)).toBe(false);
    }
  });
});
