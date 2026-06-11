import { AUTHORITY_DISCLAIMER } from "./fixtures";
import type {
  CompiledCodePayloadMetadata,
  ComputedEffectiveProvision,
  JurisdictionAmendmentEvent,
  ModelCodeProvision,
} from "./types";

type ComputeOptions = {
  jurisdictionId?: string;
  generatedAt?: string;
};

function createMetadata(
  provision: ModelCodeProvision,
  jurisdictionId: string,
  computedStatus: ComputedEffectiveProvision["status"],
  generatedAt: string,
): CompiledCodePayloadMetadata {
  return {
    generatedAt,
    disclaimer: AUTHORITY_DISCLAIMER,
    computedStatus,
    jurisdictionId,
    provisionId: provision.id,
  };
}

export function computeEffectiveProvision(
  baseProvision: ModelCodeProvision,
  amendmentEvent?: JurisdictionAmendmentEvent,
  options: ComputeOptions = {},
): ComputedEffectiveProvision {
  const jurisdictionId = amendmentEvent?.jurisdictionId ?? options.jurisdictionId ?? "unknown-jurisdiction";
  const generatedAt = options.generatedAt ?? amendmentEvent?.submittedAt ?? new Date().toISOString();

  if (!amendmentEvent || amendmentEvent.action === "INHERIT_BASE") {
    return {
      jurisdictionId,
      provisionId: baseProvision.id,
      codeFamily: baseProvision.codeFamily,
      codeYear: baseProvision.codeYear,
      sectionNumber: baseProvision.sectionNumber,
      title: baseProvision.title,
      baseText: baseProvision.baseText,
      amendedText: null,
      displayText: baseProvision.baseText,
      status: "BASE_CODE",
      ordinanceReference: amendmentEvent?.ordinanceReference ?? null,
      effectiveDate: amendmentEvent?.effectiveDate ?? null,
      eventId: amendmentEvent?.id ?? null,
      previousHash: amendmentEvent?.previousHash ?? null,
      payloadHash: amendmentEvent?.payloadHash ?? null,
      metadata: createMetadata(baseProvision, jurisdictionId, "BASE_CODE", generatedAt),
    };
  }

  if (amendmentEvent.action === "DELETE") {
    return {
      jurisdictionId,
      provisionId: baseProvision.id,
      codeFamily: baseProvision.codeFamily,
      codeYear: baseProvision.codeYear,
      sectionNumber: baseProvision.sectionNumber,
      title: baseProvision.title,
      baseText: baseProvision.baseText,
      amendedText: null,
      displayText: null,
      status: "LOCALLY_DELETED",
      ordinanceReference: amendmentEvent.ordinanceReference ?? null,
      effectiveDate: amendmentEvent.effectiveDate,
      eventId: amendmentEvent.id,
      previousHash: amendmentEvent.previousHash ?? null,
      payloadHash: amendmentEvent.payloadHash,
      metadata: createMetadata(baseProvision, jurisdictionId, "LOCALLY_DELETED", generatedAt),
    };
  }

  return {
    jurisdictionId,
    provisionId: baseProvision.id,
    codeFamily: baseProvision.codeFamily,
    codeYear: baseProvision.codeYear,
    sectionNumber: baseProvision.sectionNumber,
    title: baseProvision.title,
    baseText: baseProvision.baseText,
    amendedText: amendmentEvent.amendedText ?? null,
    displayText: amendmentEvent.amendedText ?? null,
    status: "LOCALLY_AMENDED",
    ordinanceReference: amendmentEvent.ordinanceReference ?? null,
    effectiveDate: amendmentEvent.effectiveDate,
    eventId: amendmentEvent.id,
    previousHash: amendmentEvent.previousHash ?? null,
    payloadHash: amendmentEvent.payloadHash,
    metadata: createMetadata(baseProvision, jurisdictionId, "LOCALLY_AMENDED", generatedAt),
  };
}

export function computeEffectiveProvisionFromEvents(
  baseProvision: ModelCodeProvision,
  amendmentEvents: JurisdictionAmendmentEvent[],
  asOfDate?: string,
  options: ComputeOptions = {},
): ComputedEffectiveProvision {
  const eligibleEvents = amendmentEvents
    .filter((event) => event.modelProvisionId === baseProvision.id)
    .filter((event) => event.status !== "REJECTED" && event.status !== "SUPERSEDED")
    .filter((event) => !asOfDate || event.effectiveDate <= asOfDate)
    .sort((left, right) => {
      const effectiveDateCompare = right.effectiveDate.localeCompare(left.effectiveDate);
      if (effectiveDateCompare !== 0) {
        return effectiveDateCompare;
      }

      return right.submittedAt.localeCompare(left.submittedAt);
    });

  return computeEffectiveProvision(baseProvision, eligibleEvents[0], options);
}
