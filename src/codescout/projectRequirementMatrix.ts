import type { EvidenceRecord } from "./immutableLocalAmendmentFoundation";

export const ProjectRequirementStatus = {
  satisfied: "satisfied",
  missing: "missing",
  blocked: "blocked",
  uncertain: "uncertain",
  conflict: "conflict",
  not_applicable: "not-applicable",
} as const;

export const ProjectRequirementCategory = {
  plan: "plan",
  permit: "permit",
  zoning: "zoning",
  fire: "fire",
  structural: "structural",
  accessibility: "accessibility",
  floodplain: "floodplain",
  utility: "utility",
  inspection: "inspection",
  document: "document",
  fee: "fee",
  other: "other",
} as const;

export const ProjectRequirementActionType = {
  draw: "draw",
  specify: "specify",
  attach: "attach",
  verify: "verify",
  calculate: "calculate",
  ask_AHJ: "ask-AHJ",
  inspect: "inspect",
  decide: "decide",
  reconcile: "reconcile",
} as const;

export const ResponsibleProjectParty = {
  owner: "owner",
  designer: "designer",
  architect: "architect",
  engineer: "engineer",
  contractor: "contractor",
  permit_expediter: "permit-expediter",
  AHJ: "AHJ",
  unknown: "unknown",
} as const;

export const ProjectRequirementSeverity = {
  informational: "informational",
  verify_before_quote: "verify-before-quote",
  verify_before_design: "verify-before-design",
  verify_before_submission: "verify-before-submission",
  likely_permit_blocker: "likely-permit-blocker",
} as const;

export const PROJECT_REQUIREMENT_MATRIX_DISCLAIMERS = {
  referenceOnlyDisclaimer:
    "CodeScout project requirement matrices are reference-only coordination artifacts for project planning.",
  noLegalAuthorityDisclaimer:
    "CodeScout does not replace the Authority Having Jurisdiction or provide legal authority.",
  noPermitApprovalDisclaimer:
    "CodeScout does not approve permits or predict permit approval.",
  noCodeComplianceCertificationDisclaimer:
    "CodeScout does not certify code compliance or professional design correctness.",
} as const;

export type ProjectRequirementStatus =
  (typeof ProjectRequirementStatus)[keyof typeof ProjectRequirementStatus];
export type ProjectRequirementCategory =
  (typeof ProjectRequirementCategory)[keyof typeof ProjectRequirementCategory];
export type ProjectRequirementActionType =
  (typeof ProjectRequirementActionType)[keyof typeof ProjectRequirementActionType];
export type ResponsibleProjectParty = (typeof ResponsibleProjectParty)[keyof typeof ResponsibleProjectParty];
export type ProjectRequirementSeverity =
  (typeof ProjectRequirementSeverity)[keyof typeof ProjectRequirementSeverity];

export type ProjectRequirementMatrixDisclaimers = typeof PROJECT_REQUIREMENT_MATRIX_DISCLAIMERS;

export type ProjectScopeInput = {
  projectType: string;
  addressOrJurisdictionReference?: string;
  workCategory: string;
  occupancyUse?: string;
  structureType?: string;
  declaredAssumptions: ProjectDeclaredAssumption[];
  missingScopeFields: string[];
};

export type ProjectDeclaredAssumption = {
  assumptionId: string;
  statement: string;
  supportedByEvidenceIds?: string[];
};

export type ProjectRequirementEvidenceReference = {
  evidenceId: string;
  sourceDocumentId?: string;
  fieldPath?: string;
};

export type ProjectRequirementMissingEvidenceDetail = {
  fieldPath: string;
  entityType: "projectScope" | "requirementItem" | "matrixDisclaimer" | "projectAssumption";
  entityId: string;
  reason:
    | "missing_scope_field"
    | "missing_requirement_evidence"
    | "unsupported_assumption"
    | "missing_disclaimer"
    | "malformed_disclaimer";
  code:
    | "MISSING_SCOPE_FIELD"
    | "MISSING_REQUIREMENT_EVIDENCE"
    | "UNSUPPORTED_ASSUMPTION"
    | "MISSING_DISCLAIMER"
    | "MALFORMED_DISCLAIMER";
  severity: "blocking" | "review_required";
  message: string;
};

export type ProjectRequirementItem = {
  requirementId: string;
  title: string;
  category: ProjectRequirementCategory;
  actionType: ProjectRequirementActionType;
  responsibleParty: ResponsibleProjectParty;
  evidenceReferences: ProjectRequirementEvidenceReference[];
  status: ProjectRequirementStatus;
  severity: ProjectRequirementSeverity;
  missingEvidenceDetails: ProjectRequirementMissingEvidenceDetail[];
};

export type SourceEvidenceSummary = {
  evidenceId: string;
  title: string;
  sourceDocumentId?: string;
  sourceLocator?: string;
};

export type ProjectRequirementMatrix = {
  projectRequirementMatrixId: string;
  computedAt: string;
  computedByActorId: string;
  projectScopeSummary: ProjectScopeInput;
  requirementItems: ProjectRequirementItem[];
  unsupportedAssumptions: ProjectDeclaredAssumption[];
  sourceEvidenceSummary: SourceEvidenceSummary[];
  disclaimers: ProjectRequirementMatrixDisclaimers;
  missingEvidenceDetails: ProjectRequirementMissingEvidenceDetail[];
};

export type BuildProjectRequirementMatrixInput = {
  projectRequirementMatrixId: string;
  computedAt: string;
  computedByActorId: string;
  projectScope: ProjectScopeInput;
  sourceEvidence: EvidenceRecord[];
  requirementItems: ProjectRequirementItem[];
};

function isNonEmptyString(value: string | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

function isIsoTimestamp(value: string | undefined): value is string {
  return Boolean(value && !Number.isNaN(Date.parse(value)));
}

function createMissingDetail(
  fieldPath: string,
  entityType: ProjectRequirementMissingEvidenceDetail["entityType"],
  entityId: string,
  input: Pick<ProjectRequirementMissingEvidenceDetail, "reason" | "code" | "severity" | "message">,
): ProjectRequirementMissingEvidenceDetail {
  return {
    fieldPath,
    entityType,
    entityId,
    reason: input.reason,
    code: input.code,
    severity: input.severity,
    message: input.message,
  };
}

function validateDisclaimers(
  disclaimers: Partial<ProjectRequirementMatrixDisclaimers> | undefined,
): ProjectRequirementMissingEvidenceDetail[] {
  const details: ProjectRequirementMissingEvidenceDetail[] = [];
  const required = Object.keys(PROJECT_REQUIREMENT_MATRIX_DISCLAIMERS) as Array<keyof ProjectRequirementMatrixDisclaimers>;

  for (const fieldName of required) {
    const value = disclaimers?.[fieldName];
    if (value === undefined) {
      details.push(
        createMissingDetail(`disclaimers.${fieldName}`, "matrixDisclaimer", "projectRequirementMatrix", {
          reason: "missing_disclaimer",
          code: "MISSING_DISCLAIMER",
          severity: "blocking",
          message: `${fieldName} is required on ProjectRequirementMatrix.disclaimers.`,
        }),
      );
    } else if (!isNonEmptyString(value)) {
      details.push(
        createMissingDetail(`disclaimers.${fieldName}`, "matrixDisclaimer", "projectRequirementMatrix", {
          reason: "malformed_disclaimer",
          code: "MALFORMED_DISCLAIMER",
          severity: "blocking",
          message: `${fieldName} must be a non-empty disclaimer string.`,
        }),
      );
    }
  }

  return details;
}

function validateSatisfiedRequirementEvidence(
  item: ProjectRequirementItem,
  availableEvidenceIds: Set<string>,
): ProjectRequirementMissingEvidenceDetail[] {
  if (item.status !== ProjectRequirementStatus.satisfied) {
    return [];
  }

  const evidenceReferences = item.evidenceReferences.filter(
    (reference) => isNonEmptyString(reference?.evidenceId) && availableEvidenceIds.has(reference.evidenceId),
  );

  if (evidenceReferences.length > 0) {
    return [];
  }

  return [
    createMissingDetail(`requirementItems.${item.requirementId}.evidenceReferences`, "requirementItem", item.requirementId, {
      reason: "missing_requirement_evidence",
      code: "MISSING_REQUIREMENT_EVIDENCE",
      severity: "blocking",
      message: `Satisfied requirement ${item.requirementId} must reference at least one linked P4 evidence record.`,
    }),
  ];
}

function validateBlockedOrMissingRequirement(item: ProjectRequirementItem): ProjectRequirementMissingEvidenceDetail[] {
  if (item.status !== ProjectRequirementStatus.blocked && item.status !== ProjectRequirementStatus.missing) {
    return [];
  }

  if (item.missingEvidenceDetails.length > 0) {
    return [];
  }

  return [
    createMissingDetail(`requirementItems.${item.requirementId}.missingEvidenceDetails`, "requirementItem", item.requirementId, {
      reason: "missing_requirement_evidence",
      code: "MISSING_REQUIREMENT_EVIDENCE",
      severity: "blocking",
      message: `Requirement ${item.requirementId} is ${item.status} and must include structured missingEvidenceDetails.`,
    }),
  ];
}

function createScopeRequirement(fieldName: string): ProjectRequirementItem {
  const detail = createMissingDetail(`projectScope.${fieldName}`, "projectScope", fieldName, {
    reason: "missing_scope_field",
    code: "MISSING_SCOPE_FIELD",
    severity: "blocking",
    message: `Project scope field ${fieldName} is required before this requirement matrix can be complete.`,
  });

  return {
    requirementId: `scope:${fieldName}`,
    title: `Resolve project scope field: ${fieldName}`,
    category: ProjectRequirementCategory.other,
    actionType: ProjectRequirementActionType.decide,
    responsibleParty: ResponsibleProjectParty.owner,
    evidenceReferences: [],
    status: ProjectRequirementStatus.blocked,
    severity: ProjectRequirementSeverity.verify_before_design,
    missingEvidenceDetails: [detail],
  };
}

function summarizeEvidence(records: EvidenceRecord[]): SourceEvidenceSummary[] {
  return records.map((record) => ({
    evidenceId: record.id,
    title: record.title,
    sourceDocumentId: record.municipalIntakeEvidence?.sourceDocumentId,
    sourceLocator: record.municipalIntakeEvidence?.sourceLocator ?? record.url ?? record.sourceIdentifier,
  }));
}

function findUnsupportedAssumptions(scope: ProjectScopeInput, evidenceIds: Set<string>): ProjectDeclaredAssumption[] {
  return scope.declaredAssumptions.filter((assumption) => {
    const linkedEvidenceIds = assumption.supportedByEvidenceIds ?? [];
    return linkedEvidenceIds.length === 0 || linkedEvidenceIds.some((evidenceId) => !evidenceIds.has(evidenceId));
  });
}

function validateUnsupportedAssumptions(
  assumptions: ProjectDeclaredAssumption[],
): ProjectRequirementMissingEvidenceDetail[] {
  return assumptions.map((assumption) =>
    createMissingDetail(`projectScope.declaredAssumptions.${assumption.assumptionId}`, "projectAssumption", assumption.assumptionId, {
      reason: "unsupported_assumption",
      code: "UNSUPPORTED_ASSUMPTION",
      severity: "review_required",
      message: `Project assumption ${assumption.assumptionId} is not supported by linked P4 evidence.`,
    }),
  );
}

export function assertProjectRequirementMatrixCompleteness(matrix: ProjectRequirementMatrix): ProjectRequirementMatrix {
  if (!isNonEmptyString(matrix.projectRequirementMatrixId)) {
    throw new Error("projectRequirementMatrixId is required");
  }
  if (!isNonEmptyString(matrix.computedAt)) {
    throw new Error("computedAt is required");
  }
  if (!isIsoTimestamp(matrix.computedAt)) {
    throw new Error("computedAt must be a valid ISO timestamp");
  }
  if (!isNonEmptyString(matrix.computedByActorId)) {
    throw new Error("computedByActorId is required");
  }
  if (!isNonEmptyString(matrix.projectScopeSummary.projectType)) {
    throw new Error("projectScope.projectType is required");
  }
  if (!isNonEmptyString(matrix.projectScopeSummary.workCategory)) {
    throw new Error("projectScope.workCategory is required");
  }

  const sourceEvidenceIds = new Set(matrix.sourceEvidenceSummary.map((record) => record.evidenceId));
  const missingDetails = [
    ...validateDisclaimers(matrix.disclaimers),
    ...matrix.requirementItems.flatMap((item) => validateSatisfiedRequirementEvidence(item, sourceEvidenceIds)),
    ...matrix.requirementItems.flatMap((item) => validateBlockedOrMissingRequirement(item)),
  ];

  if (missingDetails.length > 0) {
    throw new Error(`ProjectRequirementMatrix is incomplete: ${missingDetails.map((detail) => detail.code).join(", ")}`);
  }

  return matrix;
}

export function buildProjectRequirementMatrix(input: BuildProjectRequirementMatrixInput): ProjectRequirementMatrix {
  const sourceEvidenceIds = new Set(input.sourceEvidence.map((record) => record.id));

  if (!isNonEmptyString(input.computedAt)) {
    throw new Error("computedAt is required");
  }
  if (!isNonEmptyString(input.computedByActorId)) {
    throw new Error("computedByActorId is required");
  }
  if (!isNonEmptyString(input.projectScope.projectType)) {
    throw new Error("projectScope.projectType is required");
  }

  const scopeRequirements = input.projectScope.missingScopeFields.map(createScopeRequirement);
  const unsupportedAssumptions = findUnsupportedAssumptions(input.projectScope, sourceEvidenceIds);
  const requirementItems = [...input.requirementItems, ...scopeRequirements];
  const missingEvidenceDetails = [
    ...scopeRequirements.flatMap((item) => item.missingEvidenceDetails),
    ...(unsupportedAssumptions.length ? validateUnsupportedAssumptions(unsupportedAssumptions) : []),
    ...requirementItems.flatMap((item) => validateSatisfiedRequirementEvidence(item, sourceEvidenceIds)),
  ];

  const matrix: ProjectRequirementMatrix = {
    projectRequirementMatrixId: input.projectRequirementMatrixId,
    computedAt: input.computedAt,
    computedByActorId: input.computedByActorId,
    projectScopeSummary: {
      ...input.projectScope,
      declaredAssumptions: input.projectScope.declaredAssumptions.map((assumption) => ({
        ...assumption,
        supportedByEvidenceIds: assumption.supportedByEvidenceIds ? [...assumption.supportedByEvidenceIds] : undefined,
      })),
      missingScopeFields: [...input.projectScope.missingScopeFields],
    },
    requirementItems: requirementItems.map((item) => ({
      ...item,
      evidenceReferences: item.evidenceReferences.map((reference) => ({ ...reference })),
      missingEvidenceDetails: [...item.missingEvidenceDetails],
    })),
    unsupportedAssumptions,
    sourceEvidenceSummary: summarizeEvidence(input.sourceEvidence),
    disclaimers: PROJECT_REQUIREMENT_MATRIX_DISCLAIMERS,
    missingEvidenceDetails,
  };

  for (const item of matrix.requirementItems) {
    if (item.status === ProjectRequirementStatus.satisfied) {
      const itemDetails = validateSatisfiedRequirementEvidence(item, sourceEvidenceIds);
      if (itemDetails.length > 0) {
        throw new Error(itemDetails[0].message);
      }
    }
  }

  return assertProjectRequirementMatrixCompleteness(matrix);
}
