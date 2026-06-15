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
  assertProjectRequirementMatrixCompleteness,
  buildProjectRequirementMatrix,
  type BuildProjectRequirementMatrixInput,
  type ProjectRequirementItem,
  type ProjectRequirementMatrix,
  type ProjectScopeInput,
} from "../src/codescout/projectRequirementMatrix";

function createMunicipalIntakeEvidence(overrides: Partial<MunicipalIntakeEvidence> = {}): MunicipalIntakeEvidence {
  return {
    sourceDocumentId: "pensacola-building-code-source",
    sourceDocumentTitle: "Pensacola Building Code Amendment Packet",
    sourceLocator: "https://example.gov/pensacola/building-code",
    publicationDate: "2026-06-10",
    jurisdiction: {
      name: "Pensacola",
      state: "FL",
      county: "Escambia",
      geopoliticalCode: "1255925",
    },
    documentType: MunicipalDocumentType.local_amendment,
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
    id: "evidence-plan-1",
    title: "Wind design amendment evidence",
    sourceType: SourceType.local_amendment,
    url: "https://example.gov/pensacola/building-code",
    quoteOrSummary: "Local amendment requires wind design criteria to appear on drawings.",
    actorId: "operator-1",
    timestamp: "2026-06-11T12:00:00.000Z",
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
        assumptionId: "assumption-wind",
        statement: "Wind design criteria apply to the addition drawings.",
        supportedByEvidenceIds: ["evidence-plan-1"],
      },
    ],
    missingScopeFields: [],
    ...overrides,
  };
}

function createRequirement(overrides: Partial<ProjectRequirementItem> = {}): ProjectRequirementItem {
  return {
    requirementId: "wind-design-drawing-note",
    title: "Show wind design criteria on structural drawings",
    category: ProjectRequirementCategory.structural,
    actionType: ProjectRequirementActionType.draw,
    responsibleParty: ResponsibleProjectParty.engineer,
    evidenceReferences: [
      {
        evidenceId: "evidence-plan-1",
        sourceDocumentId: "pensacola-building-code-source",
        fieldPath: "municipalIntakeEvidence.sectionOrProvisionCitation",
      },
    ],
    status: ProjectRequirementStatus.satisfied,
    severity: ProjectRequirementSeverity.verify_before_submission,
    missingEvidenceDetails: [],
    ...overrides,
  };
}

function createInput(overrides: Partial<BuildProjectRequirementMatrixInput> = {}): BuildProjectRequirementMatrixInput {
  return {
    projectRequirementMatrixId: "matrix-1",
    computedAt: "2026-06-15T12:00:00.000Z",
    computedByActorId: "operator-2",
    projectScope: createScope(),
    sourceEvidence: [createEvidence()],
    requirementItems: [createRequirement()],
    ...overrides,
  };
}

describe("codescout project requirement matrix contract", () => {
  it("complete P4-linked evidence and valid project scope produces a Project Requirement Matrix", () => {
    const matrix = buildProjectRequirementMatrix(createInput());

    expect(matrix.projectRequirementMatrixId).toBe("matrix-1");
    expect(matrix.requirementItems).toHaveLength(1);
    expect(matrix.requirementItems[0].status).toBe(ProjectRequirementStatus.satisfied);
    expect(matrix.requirementItems[0].evidenceReferences[0].evidenceId).toBe("evidence-plan-1");
    expect(matrix.sourceEvidenceSummary[0].sourceDocumentId).toBe("pensacola-building-code-source");
  });

  it("missing projectType fails closed", () => {
    expect(() =>
      buildProjectRequirementMatrix(
        createInput({
          projectScope: createScope({ projectType: "" }),
        }),
      ),
    ).toThrow(/projectScope\.projectType is required/i);
  });

  it("missing mandatory scope fields generate blocked requirements with structured missingEvidenceDetails", () => {
    const matrix = buildProjectRequirementMatrix(
      createInput({
        projectScope: createScope({ missingScopeFields: ["structureType"] }),
      }),
    );
    const generated = matrix.requirementItems.find((item) => item.requirementId === "scope:structureType");

    expect(generated?.status).toBe(ProjectRequirementStatus.blocked);
    expect(generated?.missingEvidenceDetails).toEqual([
      expect.objectContaining({
        fieldPath: "projectScope.structureType",
        code: "MISSING_SCOPE_FIELD",
        severity: "blocking",
      }),
    ]);
    expect(matrix.missingEvidenceDetails).toEqual([
      expect.objectContaining({
        fieldPath: "projectScope.structureType",
        entityType: "projectScope",
      }),
    ]);
  });

  it("a requirement item cannot be marked satisfied without a linked P4 evidence ID", () => {
    expect(() =>
      buildProjectRequirementMatrix(
        createInput({
          requirementItems: [createRequirement({ evidenceReferences: [] })],
        }),
      ),
    ).toThrow(/must reference at least one linked P4 evidence record/i);
  });

  it("null or undefined evidence reference on a satisfied item fails validation", () => {
    expect(() =>
      buildProjectRequirementMatrix(
        createInput({
          requirementItems: [
            createRequirement({
              evidenceReferences: [{ evidenceId: undefined as never }],
            }),
          ],
        }),
      ),
    ).toThrow(/must reference at least one linked P4 evidence record/i);
  });

  it("missing computedAt fails closed", () => {
    expect(() => buildProjectRequirementMatrix(createInput({ computedAt: "" }))).toThrow(/computedAt is required/i);
  });

  it("missing computedByActorId fails closed", () => {
    expect(() => buildProjectRequirementMatrix(createInput({ computedByActorId: "" }))).toThrow(
      /computedByActorId is required/i,
    );
  });

  it("unsupported assumptions are preserved and surfaced, not silently accepted", () => {
    const matrix = buildProjectRequirementMatrix(
      createInput({
        projectScope: createScope({
          declaredAssumptions: [
            {
              assumptionId: "assumption-unverified-setback",
              statement: "The side setback is already resolved.",
            },
          ],
        }),
      }),
    );

    expect(matrix.unsupportedAssumptions).toEqual([
      expect.objectContaining({ assumptionId: "assumption-unverified-setback" }),
    ]);
    expect(matrix.missingEvidenceDetails).toEqual([
      expect.objectContaining({
        fieldPath: "projectScope.declaredAssumptions.assumption-unverified-setback",
        code: "UNSUPPORTED_ASSUMPTION",
        severity: "review_required",
      }),
    ]);
  });

  it("requirement items retain source evidence references", () => {
    const matrix = buildProjectRequirementMatrix(createInput());

    expect(matrix.requirementItems[0].evidenceReferences).toEqual([
      {
        evidenceId: "evidence-plan-1",
        sourceDocumentId: "pensacola-building-code-source",
        fieldPath: "municipalIntakeEvidence.sectionOrProvisionCitation",
      },
    ]);
  });

  it("AHJ verification items can be ask/verify items without claiming legal authority", () => {
    const matrix = buildProjectRequirementMatrix(
      createInput({
        requirementItems: [
          createRequirement({
            requirementId: "ahj-question-1",
            title: "Ask AHJ whether floodplain review applies",
            category: ProjectRequirementCategory.floodplain,
            actionType: ProjectRequirementActionType.ask_AHJ,
            responsibleParty: ResponsibleProjectParty.AHJ,
            status: ProjectRequirementStatus.uncertain,
            severity: ProjectRequirementSeverity.verify_before_submission,
            evidenceReferences: [],
            missingEvidenceDetails: [],
          }),
        ],
      }),
    );

    expect(matrix.requirementItems[0].actionType).toBe(ProjectRequirementActionType.ask_AHJ);
    expect(JSON.stringify(matrix).toLowerCase()).not.toContain("grants legal authority");
  });

  it("blocked and missing states are explicitly represented", () => {
    const detail = {
      fieldPath: "requirementItems.missing-attachment.evidenceReferences",
      entityType: "requirementItem" as const,
      entityId: "missing-attachment",
      reason: "missing_requirement_evidence" as const,
      code: "MISSING_REQUIREMENT_EVIDENCE" as const,
      severity: "blocking" as const,
      message: "Attachment source evidence is missing.",
    };
    const matrix = buildProjectRequirementMatrix(
      createInput({
        requirementItems: [
          createRequirement({
            requirementId: "missing-attachment",
            status: ProjectRequirementStatus.missing,
            actionType: ProjectRequirementActionType.attach,
            category: ProjectRequirementCategory.document,
            evidenceReferences: [],
            missingEvidenceDetails: [detail],
          }),
        ],
      }),
    );

    expect(matrix.requirementItems[0].status).toBe(ProjectRequirementStatus.missing);
    expect(matrix.requirementItems[0].missingEvidenceDetails[0]).toEqual(detail);
  });

  it("missingEvidenceDetails remain structured objects, not string-only arrays", () => {
    const matrix = buildProjectRequirementMatrix(
      createInput({
        projectScope: createScope({ missingScopeFields: ["occupancyUse"] }),
      }),
    );

    expect(matrix.missingEvidenceDetails.length).toBeGreaterThan(0);
    expect(matrix.missingEvidenceDetails.every((detail) => typeof detail === "object")).toBe(true);
    expect(matrix.missingEvidenceDetails.every((detail) => "fieldPath" in detail && "code" in detail)).toBe(true);
  });

  it("required disclaimer fields exist on the returned matrix object", () => {
    const matrix = buildProjectRequirementMatrix(createInput());

    expect(matrix.disclaimers).toEqual(PROJECT_REQUIREMENT_MATRIX_DISCLAIMERS);
    expect(matrix.disclaimers.referenceOnlyDisclaimer).toBeTruthy();
    expect(matrix.disclaimers.noLegalAuthorityDisclaimer).toBeTruthy();
    expect(matrix.disclaimers.noPermitApprovalDisclaimer).toBeTruthy();
    expect(matrix.disclaimers.noCodeComplianceCertificationDisclaimer).toBeTruthy();
  });

  it("validation fails if required disclaimer fields are missing", () => {
    const matrix = buildProjectRequirementMatrix(createInput());

    expect(() =>
      assertProjectRequirementMatrixCompleteness({
        ...matrix,
        disclaimers: {
          ...matrix.disclaimers,
          noPermitApprovalDisclaimer: "",
        },
      } as ProjectRequirementMatrix),
    ).toThrow(/MALFORMED_DISCLAIMER/i);
  });

  it("no legal authority, permit approval, production-validity, or code compliance certification claim is emitted", () => {
    const serializedText = JSON.stringify(buildProjectRequirementMatrix(createInput())).toLowerCase();

    for (const term of [
      "legal authority granted",
      "permit approved",
      "production valid",
      "production-ready",
      "code compliance certified",
      "official ahj approval",
    ]) {
      expect(serializedText.includes(term)).toBe(false);
    }
  });
});
