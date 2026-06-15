import type { EvidenceRecord } from "./immutableLocalAmendmentFoundation";
import type {
  ProjectDeclaredAssumption,
  ProjectRequirementCategory,
  ProjectRequirementEvidenceReference,
  ProjectRequirementItem,
  ProjectRequirementMatrix,
  ProjectRequirementMissingEvidenceDetail,
  ProjectRequirementStatus,
  ProjectRequirementActionType,
  ResponsibleProjectParty,
  ProjectScopeInput,
} from "./projectRequirementMatrix";
import {
  ProjectRequirementActionType as ProjectRequirementActionTypes,
  ProjectRequirementSeverity as ProjectRequirementSeverities,
  ProjectRequirementStatus as ProjectRequirementStatuses,
  ResponsibleProjectParty as ResponsibleProjectParties,
} from "./projectRequirementMatrix";

export const PermitPacketOverallStatus = {
  ready_for_review: "ready-for-review",
  missing_required_items: "missing-required-items",
  blocked: "blocked",
  requires_AHJ_verification: "requires-AHJ-verification",
  conflict: "conflict",
  insufficient_evidence: "insufficient-evidence",
} as const;

export const PermitPacketReadinessState = {
  ready: "ready",
  missing: "missing",
  blocked: "blocked",
  uncertain: "uncertain",
  conflict: "conflict",
  pending_verification: "pending-verification",
  not_applicable: "not-applicable",
} as const;

export const PermitPacketNextAction = {
  draw: "draw",
  specify: "specify",
  attach: "attach",
  verify: "verify",
  calculate: "calculate",
  ask_AHJ: "ask-AHJ",
  inspect: "inspect",
  decide: "decide",
  reconcile: "reconcile",
  provide_document: "provide-document",
} as const;

export const PermitPacketSeverity = {
  informational: "informational",
  verify_before_submission: "verify-before-submission",
  likely_review_comment: "likely-review-comment",
  likely_permit_blocker: "likely-permit-blocker",
} as const;

export const PERMIT_PACKET_READINESS_DISCLAIMERS = {
  referenceOnlyDisclaimer:
    "CodeScout permit packet readiness is a reference-only coordination artifact for pre-submittal planning.",
  noLegalAuthorityDisclaimer:
    "CodeScout does not provide legal authority or replace the Authority Having Jurisdiction.",
  noPermitApprovalDisclaimer:
    "CodeScout does not approve permits or predict permit approval outcomes.",
  noCodeComplianceCertificationDisclaimer:
    "CodeScout does not certify code compliance or professional design correctness.",
  noAHJApprovalDisclaimer:
    "CodeScout does not provide AHJ approval or official readiness clearance.",
} as const;

export type PermitPacketOverallStatus =
  (typeof PermitPacketOverallStatus)[keyof typeof PermitPacketOverallStatus];
export type PermitPacketReadinessState =
  (typeof PermitPacketReadinessState)[keyof typeof PermitPacketReadinessState];
export type PermitPacketNextAction = (typeof PermitPacketNextAction)[keyof typeof PermitPacketNextAction];
export type PermitPacketSeverity = (typeof PermitPacketSeverity)[keyof typeof PermitPacketSeverity];
export type PermitPacketReadinessDisclaimers = typeof PERMIT_PACKET_READINESS_DISCLAIMERS;

export type PermitPacketReadinessItem = {
  packetItemId: string;
  title: string;
  sourceRequirementId: string;
  sourceRequirementStatus: ProjectRequirementStatus;
  category: ProjectRequirementCategory;
  readinessState: PermitPacketReadinessState;
  responsibleParty: ResponsibleProjectParty;
  nextAction: PermitPacketNextAction;
  evidenceReferences: ProjectRequirementEvidenceReference[];
  missingEvidenceDetails: ProjectRequirementMissingEvidenceDetail[];
  severity: PermitPacketSeverity;
};

export type PermitPacketEvidenceGap = {
  packetItemId: string;
  sourceRequirementId: string;
  missingEvidenceDetails: ProjectRequirementMissingEvidenceDetail[];
};

export type PermitPacketRoleActionSummary = {
  responsibleParty: ResponsibleProjectParty;
  totalItems: number;
  readyItems: number;
  blockedItems: number;
  pendingVerificationItems: number;
  nextActions: PermitPacketNextAction[];
};

export type PermitPacketReadiness = {
  permitPacketReadinessId: string;
  sourceProjectRequirementMatrixId: string;
  targetPermitPacketType?: string;
  computedAt: string;
  computedByActorId: string;
  projectScopeSummary: ProjectScopeInput;
  overallStatus: PermitPacketOverallStatus;
  readinessItems: PermitPacketReadinessItem[];
  missingPacketItems: PermitPacketReadinessItem[];
  blockedItems: PermitPacketReadinessItem[];
  ahjVerificationNeeds: PermitPacketReadinessItem[];
  evidenceGaps: PermitPacketEvidenceGap[];
  unsupportedAssumptions: ProjectDeclaredAssumption[];
  roleActionSummary: PermitPacketRoleActionSummary[];
  disclaimers: PermitPacketReadinessDisclaimers;
  missingEvidenceDetails: ProjectRequirementMissingEvidenceDetail[];
};

export type BuildPermitPacketReadinessInput = {
  permitPacketReadinessId: string;
  sourceProjectRequirementMatrix: ProjectRequirementMatrix;
  sourceEvidence: EvidenceRecord[];
  targetPermitPacketType?: string;
  computedAt: string;
  computedByActorId: string;
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

function mapSeverity(
  severity: (typeof ProjectRequirementSeverities)[keyof typeof ProjectRequirementSeverities],
): PermitPacketSeverity {
  switch (severity) {
    case ProjectRequirementSeverities.likely_permit_blocker:
      return PermitPacketSeverity.likely_permit_blocker;
    case ProjectRequirementSeverities.informational:
      return PermitPacketSeverity.informational;
    case ProjectRequirementSeverities.verify_before_submission:
      return PermitPacketSeverity.verify_before_submission;
    default:
      return PermitPacketSeverity.likely_review_comment;
  }
}

function mapNextAction(
  action: ProjectRequirementActionType,
  category: ProjectRequirementCategory,
): PermitPacketNextAction {
  if (action === ProjectRequirementActionTypes.attach && category === "document") {
    return PermitPacketNextAction.provide_document;
  }

  switch (action) {
    case ProjectRequirementActionTypes.draw:
      return PermitPacketNextAction.draw;
    case ProjectRequirementActionTypes.specify:
      return PermitPacketNextAction.specify;
    case ProjectRequirementActionTypes.attach:
      return PermitPacketNextAction.attach;
    case ProjectRequirementActionTypes.verify:
      return PermitPacketNextAction.verify;
    case ProjectRequirementActionTypes.calculate:
      return PermitPacketNextAction.calculate;
    case ProjectRequirementActionTypes.ask_AHJ:
      return PermitPacketNextAction.ask_AHJ;
    case ProjectRequirementActionTypes.inspect:
      return PermitPacketNextAction.inspect;
    case ProjectRequirementActionTypes.decide:
      return PermitPacketNextAction.decide;
    case ProjectRequirementActionTypes.reconcile:
      return PermitPacketNextAction.reconcile;
  }
}

function hasLinkedEvidence(
  evidenceReferences: ProjectRequirementEvidenceReference[],
  evidenceIds: Set<string>,
): boolean {
  return evidenceReferences.some(
    (reference) => isNonEmptyString(reference.evidenceId) && evidenceIds.has(reference.evidenceId),
  );
}

function mapRequirementToReadinessState(
  requirement: ProjectRequirementItem,
  evidenceIds: Set<string>,
): PermitPacketReadinessState {
  if (
    requirement.actionType === ProjectRequirementActionTypes.ask_AHJ ||
    requirement.responsibleParty === ResponsibleProjectParties.AHJ
  ) {
    return PermitPacketReadinessState.pending_verification;
  }

  switch (requirement.status) {
    case ProjectRequirementStatuses.satisfied:
      return hasLinkedEvidence(requirement.evidenceReferences, evidenceIds)
        ? PermitPacketReadinessState.ready
        : PermitPacketReadinessState.blocked;
    case ProjectRequirementStatuses.missing:
      return PermitPacketReadinessState.missing;
    case ProjectRequirementStatuses.blocked:
      return PermitPacketReadinessState.blocked;
    case ProjectRequirementStatuses.uncertain:
      return PermitPacketReadinessState.uncertain;
    case ProjectRequirementStatuses.conflict:
      return PermitPacketReadinessState.conflict;
    case ProjectRequirementStatuses.not_applicable:
      return PermitPacketReadinessState.not_applicable;
  }
}

function createReadinessItem(
  requirement: ProjectRequirementItem,
  evidenceIds: Set<string>,
): PermitPacketReadinessItem {
  const readinessState = mapRequirementToReadinessState(requirement, evidenceIds);
  const missingEvidenceDetails = [...requirement.missingEvidenceDetails];

  if (
    readinessState === PermitPacketReadinessState.blocked &&
    requirement.status === ProjectRequirementStatuses.satisfied &&
    missingEvidenceDetails.length === 0
  ) {
    missingEvidenceDetails.push(
      createMissingDetail(
        `readinessItems.packet:${requirement.requirementId}.evidenceReferences`,
        "requirementItem",
        requirement.requirementId,
        {
          reason: "missing_requirement_evidence",
          code: "MISSING_REQUIREMENT_EVIDENCE",
          severity: "blocking",
          message: `Ready candidate ${requirement.requirementId} is missing linked P4 evidence references.`,
        },
      ),
    );
  }

  if (
    readinessState === PermitPacketReadinessState.pending_verification &&
    missingEvidenceDetails.length === 0 &&
    requirement.actionType === ProjectRequirementActionTypes.ask_AHJ
  ) {
    missingEvidenceDetails.push(
      createMissingDetail(
        `readinessItems.packet:${requirement.requirementId}.ahjVerification`,
        "requirementItem",
        requirement.requirementId,
        {
          reason: "missing_requirement_evidence",
          code: "MISSING_REQUIREMENT_EVIDENCE",
          severity: "review_required",
          message: `Requirement ${requirement.requirementId} requires AHJ verification before packet readiness.`,
        },
      ),
    );
  }

  return {
    packetItemId: `packet:${requirement.requirementId}`,
    title: requirement.title,
    sourceRequirementId: requirement.requirementId,
    sourceRequirementStatus: requirement.status,
    category: requirement.category,
    readinessState,
    responsibleParty: requirement.responsibleParty,
    nextAction: mapNextAction(requirement.actionType, requirement.category),
    evidenceReferences: requirement.evidenceReferences.map((reference) => ({ ...reference })),
    missingEvidenceDetails,
    severity: mapSeverity(requirement.severity),
  };
}

function validateDisclaimers(
  disclaimers: Partial<PermitPacketReadinessDisclaimers> | undefined,
): ProjectRequirementMissingEvidenceDetail[] {
  const details: ProjectRequirementMissingEvidenceDetail[] = [];
  const required = Object.keys(PERMIT_PACKET_READINESS_DISCLAIMERS) as Array<keyof PermitPacketReadinessDisclaimers>;

  for (const fieldName of required) {
    const value = disclaimers?.[fieldName];
    if (value === undefined) {
      details.push(
        createMissingDetail(`disclaimers.${fieldName}`, "matrixDisclaimer", "permitPacketReadiness", {
          reason: "missing_disclaimer",
          code: "MISSING_DISCLAIMER",
          severity: "blocking",
          message: `${fieldName} is required on PermitPacketReadiness.disclaimers.`,
        }),
      );
    } else if (!isNonEmptyString(value)) {
      details.push(
        createMissingDetail(`disclaimers.${fieldName}`, "matrixDisclaimer", "permitPacketReadiness", {
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

function validateReadyItem(
  item: PermitPacketReadinessItem,
  evidenceIds: Set<string>,
): ProjectRequirementMissingEvidenceDetail[] {
  if (item.readinessState !== PermitPacketReadinessState.ready) {
    return [];
  }

  const details: ProjectRequirementMissingEvidenceDetail[] = [];

  if (!isNonEmptyString(item.sourceRequirementId)) {
    details.push(
      createMissingDetail(`readinessItems.${item.packetItemId}.sourceRequirementId`, "requirementItem", item.packetItemId, {
        reason: "missing_requirement_evidence",
        code: "MISSING_REQUIREMENT_EVIDENCE",
        severity: "blocking",
        message: `Ready item ${item.packetItemId} must include sourceRequirementId.`,
      }),
    );
  }

  if (item.sourceRequirementStatus !== ProjectRequirementStatuses.satisfied) {
    details.push(
      createMissingDetail(`readinessItems.${item.packetItemId}.sourceRequirementStatus`, "requirementItem", item.packetItemId, {
        reason: "missing_requirement_evidence",
        code: "MISSING_REQUIREMENT_EVIDENCE",
        severity: "blocking",
        message: `Ready item ${item.packetItemId} must come from a satisfied P5 requirement.`,
      }),
    );
  }

  if (!hasLinkedEvidence(item.evidenceReferences, evidenceIds)) {
    details.push(
      createMissingDetail(`readinessItems.${item.packetItemId}.evidenceReferences`, "requirementItem", item.packetItemId, {
        reason: "missing_requirement_evidence",
        code: "MISSING_REQUIREMENT_EVIDENCE",
        severity: "blocking",
        message: `Ready item ${item.packetItemId} must include linked P4 evidence references.`,
      }),
    );
  }

  if (item.missingEvidenceDetails.length > 0) {
    details.push(
      createMissingDetail(`readinessItems.${item.packetItemId}.missingEvidenceDetails`, "requirementItem", item.packetItemId, {
        reason: "missing_requirement_evidence",
        code: "MISSING_REQUIREMENT_EVIDENCE",
        severity: "blocking",
        message: `Ready item ${item.packetItemId} cannot carry blocking missingEvidenceDetails.`,
      }),
    );
  }

  return details;
}

function validateVerificationItems(items: PermitPacketReadinessItem[]): ProjectRequirementMissingEvidenceDetail[] {
  return items.flatMap((item) => {
    if (item.nextAction !== PermitPacketNextAction.ask_AHJ && item.responsibleParty !== ResponsibleProjectParties.AHJ) {
      return [];
    }
    if (item.readinessState === PermitPacketReadinessState.pending_verification) {
      return [];
    }

    return [
      createMissingDetail(`readinessItems.${item.packetItemId}.readinessState`, "requirementItem", item.packetItemId, {
        reason: "missing_requirement_evidence",
        code: "MISSING_REQUIREMENT_EVIDENCE",
        severity: "blocking",
        message: `AHJ verification item ${item.packetItemId} must remain pending-verification.`,
      }),
    ];
  });
}

function determineOverallStatus(
  readinessItems: PermitPacketReadinessItem[],
  unsupportedAssumptions: ProjectDeclaredAssumption[],
  evidenceGaps: PermitPacketEvidenceGap[],
): PermitPacketOverallStatus {
  if (readinessItems.some((item) => item.readinessState === PermitPacketReadinessState.conflict)) {
    return PermitPacketOverallStatus.conflict;
  }
  if (readinessItems.some((item) => item.readinessState === PermitPacketReadinessState.blocked)) {
    return PermitPacketOverallStatus.blocked;
  }
  if (readinessItems.some((item) => item.readinessState === PermitPacketReadinessState.pending_verification)) {
    return PermitPacketOverallStatus.requires_AHJ_verification;
  }
  if (readinessItems.some((item) => item.readinessState === PermitPacketReadinessState.missing)) {
    return PermitPacketOverallStatus.missing_required_items;
  }
  if (
    readinessItems.some((item) => item.readinessState === PermitPacketReadinessState.uncertain) ||
    unsupportedAssumptions.length > 0 ||
    evidenceGaps.length > 0
  ) {
    return PermitPacketOverallStatus.insufficient_evidence;
  }

  return PermitPacketOverallStatus.ready_for_review;
}

function summarizeRoleActions(items: PermitPacketReadinessItem[]): PermitPacketRoleActionSummary[] {
  const grouped = new Map<ResponsibleProjectParty, PermitPacketRoleActionSummary>();

  for (const item of items) {
    const existing =
      grouped.get(item.responsibleParty) ??
      ({
        responsibleParty: item.responsibleParty,
        totalItems: 0,
        readyItems: 0,
        blockedItems: 0,
        pendingVerificationItems: 0,
        nextActions: [],
      } satisfies PermitPacketRoleActionSummary);

    existing.totalItems += 1;
    if (item.readinessState === PermitPacketReadinessState.ready) {
      existing.readyItems += 1;
    }
    if (item.readinessState === PermitPacketReadinessState.blocked) {
      existing.blockedItems += 1;
    }
    if (item.readinessState === PermitPacketReadinessState.pending_verification) {
      existing.pendingVerificationItems += 1;
    }
    if (!existing.nextActions.includes(item.nextAction)) {
      existing.nextActions.push(item.nextAction);
    }

    grouped.set(item.responsibleParty, existing);
  }

  return [...grouped.values()].sort((left, right) => left.responsibleParty.localeCompare(right.responsibleParty));
}

export function assertPermitPacketReadinessCompleteness(
  packet: PermitPacketReadiness,
): PermitPacketReadiness {
  if (!isNonEmptyString(packet.permitPacketReadinessId)) {
    throw new Error("permitPacketReadinessId is required");
  }
  if (!isNonEmptyString(packet.sourceProjectRequirementMatrixId)) {
    throw new Error("sourceProjectRequirementMatrixId is required");
  }
  if (!isNonEmptyString(packet.computedAt)) {
    throw new Error("computedAt is required");
  }
  if (!isIsoTimestamp(packet.computedAt)) {
    throw new Error("computedAt must be a valid ISO timestamp");
  }
  if (!isNonEmptyString(packet.computedByActorId)) {
    throw new Error("computedByActorId is required");
  }

  const evidenceIds = new Set(packet.readinessItems.flatMap((item) => item.evidenceReferences.map((reference) => reference.evidenceId)));
  const validationDetails = [
    ...validateDisclaimers(packet.disclaimers),
    ...packet.readinessItems.flatMap((item) => validateReadyItem(item, evidenceIds)),
    ...validateVerificationItems(packet.readinessItems),
  ];

  if (validationDetails.length > 0) {
    throw new Error(
      `PermitPacketReadiness is incomplete: ${validationDetails.map((detail) => detail.code).join(", ")}`,
    );
  }

  return packet;
}

export function buildPermitPacketReadiness(
  input: BuildPermitPacketReadinessInput,
): PermitPacketReadiness {
  if (!input.sourceProjectRequirementMatrix) {
    throw new Error("sourceProjectRequirementMatrix is required");
  }
  if (!isNonEmptyString(input.computedAt)) {
    throw new Error("computedAt is required");
  }
  if (!isNonEmptyString(input.computedByActorId)) {
    throw new Error("computedByActorId is required");
  }

  const evidenceIds = new Set(input.sourceEvidence.map((record) => record.id));
  const readinessItems = input.sourceProjectRequirementMatrix.requirementItems.map((requirement) =>
    createReadinessItem(requirement, evidenceIds),
  );
  const missingPacketItems = readinessItems.filter((item) => item.readinessState === PermitPacketReadinessState.missing);
  const blockedItems = readinessItems.filter((item) => item.readinessState === PermitPacketReadinessState.blocked);
  const ahjVerificationNeeds = readinessItems.filter(
    (item) => item.readinessState === PermitPacketReadinessState.pending_verification,
  );
  const evidenceGaps = readinessItems
    .filter((item) => item.missingEvidenceDetails.length > 0)
    .map((item) => ({
      packetItemId: item.packetItemId,
      sourceRequirementId: item.sourceRequirementId,
      missingEvidenceDetails: [...item.missingEvidenceDetails],
    }));
  const missingEvidenceDetails = [
    ...readinessItems.flatMap((item) => item.missingEvidenceDetails),
    ...input.sourceProjectRequirementMatrix.missingEvidenceDetails,
  ];
  const packet: PermitPacketReadiness = {
    permitPacketReadinessId: input.permitPacketReadinessId,
    sourceProjectRequirementMatrixId: input.sourceProjectRequirementMatrix.projectRequirementMatrixId,
    targetPermitPacketType: input.targetPermitPacketType,
    computedAt: input.computedAt,
    computedByActorId: input.computedByActorId,
    projectScopeSummary: {
      ...input.sourceProjectRequirementMatrix.projectScopeSummary,
      declaredAssumptions: input.sourceProjectRequirementMatrix.projectScopeSummary.declaredAssumptions.map((assumption) => ({
        ...assumption,
        supportedByEvidenceIds: assumption.supportedByEvidenceIds
          ? [...assumption.supportedByEvidenceIds]
          : undefined,
      })),
      missingScopeFields: [...input.sourceProjectRequirementMatrix.projectScopeSummary.missingScopeFields],
    },
    overallStatus: determineOverallStatus(
      readinessItems,
      input.sourceProjectRequirementMatrix.unsupportedAssumptions,
      evidenceGaps,
    ),
    readinessItems,
    missingPacketItems,
    blockedItems,
    ahjVerificationNeeds,
    evidenceGaps,
    unsupportedAssumptions: input.sourceProjectRequirementMatrix.unsupportedAssumptions.map((assumption) => ({
      ...assumption,
      supportedByEvidenceIds: assumption.supportedByEvidenceIds ? [...assumption.supportedByEvidenceIds] : undefined,
    })),
    roleActionSummary: summarizeRoleActions(readinessItems),
    disclaimers: PERMIT_PACKET_READINESS_DISCLAIMERS,
    missingEvidenceDetails,
  };

  return assertPermitPacketReadinessCompleteness(packet);
}
