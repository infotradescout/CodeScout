export const AHJ_DISCLAIMER =
  "CodeScout is a reference layer for jurisdiction-specific code text and supporting evidence. The Authority Having Jurisdiction remains the final authority for interpretation, permitting, inspection, and enforcement.";

export const EvidenceStatus = {
  source_backed: "source_backed",
  unverified: "unverified",
  ambiguous: "ambiguous",
  incomplete: "incomplete",
} as const;

export const SourceType = {
  model_code: "model_code",
  local_amendment: "local_amendment",
  ordinance: "ordinance",
  building_department: "building_department",
  official_guidance: "official_guidance",
  other: "other",
} as const;

export const SupersessionStatus = {
  no_local_change: "no_local_change",
  local_amendment_supersedes: "local_amendment_supersedes",
  ambiguous: "ambiguous",
  unverified: "unverified",
} as const;

export type EvidenceStatus = (typeof EvidenceStatus)[keyof typeof EvidenceStatus];
export type SourceType = (typeof SourceType)[keyof typeof SourceType];
export type SupersessionStatus = (typeof SupersessionStatus)[keyof typeof SupersessionStatus];

export type ModelCodeProvision = {
  id: string;
  jurisdictionScope: "state" | "model_code" | "county" | "city" | "special_district" | "unknown";
  codeFamily: string;
  edition: string;
  section: string;
  title: string;
  text: string;
  effectiveDate?: string;
  evidence: EvidenceRecord[];
};

export type LocalAmendment = {
  id: string;
  jurisdiction: {
    state: string;
    county?: string;
    municipality?: string;
    authorityType: "state" | "county" | "city" | "special_district" | "unknown";
  };
  affectedBaseProvisionId: string;
  title: string;
  amendmentText: string;
  effect: "adds" | "modifies" | "replaces" | "deletes" | "ambiguous";
  effectiveDate?: string;
  actorId: string;
  timestamp: string;
  evidence: EvidenceRecord[];
};

export type EvidenceRecord = {
  id: string;
  title: string;
  sourceType: SourceType;
  url?: string;
  sourceIdentifier?: string;
  retrievedAt?: string;
  quoteOrSummary: string;
  actorId: string;
  timestamp: string;
  supportsFieldPaths: string[];
  evidenceStatus: EvidenceStatus;
};

export type ComputedEffectiveProvision = {
  id: string;
  baseProvision: ModelCodeProvision;
  localAmendments: LocalAmendment[];
  effectiveText: string;
  supersessionStatus: SupersessionStatus;
  evidenceCompleteness: "complete" | "partial" | "missing" | "ambiguous";
  ambiguities: string[];
  disclaimer: typeof AHJ_DISCLAIMER;
  computedAt: string;
  computedByActorId: string;
};

export type EvidenceCompletenessResult = {
  evidenceCompleteness: ComputedEffectiveProvision["evidenceCompleteness"];
  ambiguities: string[];
  evidenceStatus: EvidenceStatus;
  missingFieldPaths: string[];
  missingEvidenceDetails: MissingEvidenceDetail[];
};

type ComputeOptions = {
  computedAt: string;
  computedByActorId: string;
};

export type MissingEvidenceDetail = {
  fieldPath: string;
  entityType: "baseProvision" | "localAmendment" | "evidenceRecord";
  entityId: string;
  reason: "missing_evidence" | "incomplete_evidence";
  message: string;
};

function isIsoTimestamp(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function assertNonEmptyString(value: string | undefined, fieldName: string) {
  if (!value || value.trim().length === 0) {
    throw new Error(`${fieldName} is required`);
  }
}

function hasSourceLocator(record: EvidenceRecord): boolean {
  return Boolean((record.url && record.url.trim()) || (record.sourceIdentifier && record.sourceIdentifier.trim()));
}

function sortAmendments(amendments: LocalAmendment[]): LocalAmendment[] {
  return [...amendments].sort((left, right) => {
    const leftDate = left.effectiveDate ?? "";
    const rightDate = right.effectiveDate ?? "";
    const effectiveDateCompare = rightDate.localeCompare(leftDate);
    if (effectiveDateCompare !== 0) {
      return effectiveDateCompare;
    }

    const timestampCompare = right.timestamp.localeCompare(left.timestamp);
    if (timestampCompare !== 0) {
      return timestampCompare;
    }

    return left.id.localeCompare(right.id);
  });
}

export function assertAuditAttribution(input: LocalAmendment | EvidenceRecord): LocalAmendment | EvidenceRecord {
  assertNonEmptyString(input.actorId, "actorId");
  assertNonEmptyString(input.timestamp, "timestamp");
  if (!isIsoTimestamp(input.timestamp)) {
    throw new Error("timestamp must be a valid ISO timestamp");
  }

  return input;
}

export function assertEvidenceCompleteness(
  provision: Pick<ComputedEffectiveProvision, "baseProvision" | "localAmendments">,
): EvidenceCompletenessResult {
  const ambiguities: string[] = [];
  const missingFieldPaths: string[] = [];
  const missingEvidenceDetails: MissingEvidenceDetail[] = [];
  let missingEvidence = false;
  let hasUnverifiedEvidence = false;
  let hasAmbiguousEvidence = false;

  if (provision.baseProvision.evidence.length === 0) {
    missingEvidence = true;
    ambiguities.push("Base provision evidence is missing.");
    missingFieldPaths.push("baseProvision.evidence");
    missingEvidenceDetails.push({
      fieldPath: "baseProvision.evidence",
      entityType: "baseProvision",
      entityId: provision.baseProvision.id,
      reason: "missing_evidence",
      message: `Base provision ${provision.baseProvision.id} has no evidence records.`,
    });
  }

  for (const record of provision.baseProvision.evidence) {
    assertAuditAttribution(record);
    if (!hasSourceLocator(record)) {
      throw new Error(`EvidenceRecord ${record.id} must include a source URL or source identifier`);
    }
    if (record.supportsFieldPaths.length === 0) {
      throw new Error(`EvidenceRecord ${record.id} must support at least one field path`);
    }

    if (record.evidenceStatus === EvidenceStatus.ambiguous) {
      hasAmbiguousEvidence = true;
    } else if (record.evidenceStatus === EvidenceStatus.incomplete) {
      missingEvidence = true;
      const fieldPath = `baseProvision.evidence.${record.id}`;
      missingFieldPaths.push(fieldPath);
      missingEvidenceDetails.push({
        fieldPath,
        entityType: "evidenceRecord",
        entityId: record.id,
        reason: "incomplete_evidence",
        message: `Evidence record ${record.id} for base provision ${provision.baseProvision.id} is marked incomplete.`,
      });
    } else if (record.evidenceStatus === EvidenceStatus.unverified) {
      hasUnverifiedEvidence = true;
    }
  }

  for (const amendment of provision.localAmendments) {
    assertAuditAttribution(amendment);
    if (amendment.evidence.length === 0) {
      missingEvidence = true;
      ambiguities.push(`Local amendment ${amendment.id} evidence is missing.`);
      missingFieldPaths.push(`localAmendments.${amendment.id}.evidence`);
      missingEvidenceDetails.push({
        fieldPath: `localAmendments.${amendment.id}.evidence`,
        entityType: "localAmendment",
        entityId: amendment.id,
        reason: "missing_evidence",
        message: `Local amendment ${amendment.id} has no evidence records.`,
      });
    }

    for (const record of amendment.evidence) {
      assertAuditAttribution(record);
      if (!hasSourceLocator(record)) {
        throw new Error(`EvidenceRecord ${record.id} must include a source URL or source identifier`);
      }
      if (record.supportsFieldPaths.length === 0) {
        throw new Error(`EvidenceRecord ${record.id} must support at least one field path`);
      }

      if (record.evidenceStatus === EvidenceStatus.ambiguous) {
        hasAmbiguousEvidence = true;
      } else if (record.evidenceStatus === EvidenceStatus.incomplete) {
        missingEvidence = true;
        const fieldPath = `localAmendments.${amendment.id}.evidence.${record.id}`;
        missingFieldPaths.push(fieldPath);
        missingEvidenceDetails.push({
          fieldPath,
          entityType: "evidenceRecord",
          entityId: record.id,
          reason: "incomplete_evidence",
          message: `Evidence record ${record.id} for local amendment ${amendment.id} is marked incomplete.`,
        });
      } else if (record.evidenceStatus === EvidenceStatus.unverified) {
        hasUnverifiedEvidence = true;
      }
    }
  }

  if (provision.localAmendments.some((amendment) => amendment.effect === "ambiguous")) {
    hasAmbiguousEvidence = true;
    ambiguities.push("At least one local amendment effect is ambiguous.");
  }

  if (hasAmbiguousEvidence) {
    return {
      evidenceCompleteness: "ambiguous",
      ambiguities,
      evidenceStatus: EvidenceStatus.ambiguous,
      missingFieldPaths,
      missingEvidenceDetails,
    };
  }

  if (missingEvidence) {
    return {
      evidenceCompleteness: "missing",
      ambiguities,
      evidenceStatus: EvidenceStatus.incomplete,
      missingFieldPaths,
      missingEvidenceDetails,
    };
  }

  if (hasUnverifiedEvidence) {
    return {
      evidenceCompleteness: "partial",
      ambiguities,
      evidenceStatus: EvidenceStatus.unverified,
      missingFieldPaths,
      missingEvidenceDetails,
    };
  }

  return {
    evidenceCompleteness: "complete",
    ambiguities,
    evidenceStatus: EvidenceStatus.source_backed,
    missingFieldPaths,
    missingEvidenceDetails,
  };
}

export function computeEffectiveProvision(
  baseCode: ModelCodeProvision,
  amendments: LocalAmendment[],
  options: ComputeOptions,
): ComputedEffectiveProvision {
  assertNonEmptyString(baseCode.id, "baseProvision.id");
  assertNonEmptyString(options.computedAt, "computedAt");
  assertNonEmptyString(options.computedByActorId, "computedByActorId");
  if (!isIsoTimestamp(options.computedAt)) {
    throw new Error("computedAt must be a valid ISO timestamp");
  }

  const scopedAmendments = sortAmendments(amendments.filter((amendment) => amendment.affectedBaseProvisionId === baseCode.id));
  const evidenceResult = assertEvidenceCompleteness({
    baseProvision: baseCode,
    localAmendments: scopedAmendments,
  });

  const latestAmendment = scopedAmendments[0];
  const computedAt = options.computedAt;

  let effectiveText = baseCode.text;
  let supersessionStatus: SupersessionStatus = SupersessionStatus.no_local_change;
  const ambiguities = [...evidenceResult.ambiguities];

  if (!latestAmendment && evidenceResult.evidenceStatus !== EvidenceStatus.source_backed) {
    supersessionStatus = SupersessionStatus.unverified;
  }

  if (latestAmendment) {
    if (latestAmendment.effect === "ambiguous") {
      supersessionStatus = SupersessionStatus.ambiguous;
      ambiguities.push(`Local amendment ${latestAmendment.id} does not resolve a deterministic effect.`);
    } else {
      supersessionStatus = SupersessionStatus.local_amendment_supersedes;
      if (latestAmendment.effect === "deletes") {
        effectiveText = "";
      } else if (latestAmendment.effect === "adds") {
        effectiveText = `${baseCode.text}\n\n[Local Amendment Addition]\n${latestAmendment.amendmentText}`;
      } else {
        effectiveText = latestAmendment.amendmentText;
      }
    }
  }

  return {
    id: `computed-effective-provision:${baseCode.id}`,
    baseProvision: {
      ...baseCode,
      evidence: baseCode.evidence.map((record) => ({ ...record, supportsFieldPaths: [...record.supportsFieldPaths] })),
    },
    localAmendments: scopedAmendments.map((amendment) => ({
      ...amendment,
      jurisdiction: { ...amendment.jurisdiction },
      evidence: amendment.evidence.map((record) => ({ ...record, supportsFieldPaths: [...record.supportsFieldPaths] })),
    })),
    effectiveText,
    supersessionStatus,
    evidenceCompleteness: evidenceResult.evidenceCompleteness,
    ambiguities,
    disclaimer: AHJ_DISCLAIMER,
    computedAt,
    computedByActorId: options.computedByActorId,
  };
}

export function serializeComputedEffectiveProvision(provision: ComputedEffectiveProvision): ComputedEffectiveProvision {
  return {
    id: provision.id,
    baseProvision: {
      ...provision.baseProvision,
      evidence: provision.baseProvision.evidence.map((record) => ({
        ...record,
        supportsFieldPaths: [...record.supportsFieldPaths],
      })),
    },
    localAmendments: provision.localAmendments.map((amendment) => ({
      ...amendment,
      jurisdiction: { ...amendment.jurisdiction },
      evidence: amendment.evidence.map((record) => ({
        ...record,
        supportsFieldPaths: [...record.supportsFieldPaths],
      })),
    })),
    effectiveText: provision.effectiveText,
    supersessionStatus: provision.supersessionStatus,
    evidenceCompleteness: provision.evidenceCompleteness,
    ambiguities: [...provision.ambiguities],
    disclaimer: AHJ_DISCLAIMER,
    computedAt: provision.computedAt,
    computedByActorId: provision.computedByActorId,
  };
}
