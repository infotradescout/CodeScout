import {
  AUTHORITY_DISCLAIMER,
  computeEffectiveProvisionFromEvents,
  type ComputedEffectiveProvision,
  type JurisdictionAmendmentEvent,
  type ModelCodeProvision,
} from "../domain";
import type { HashChainVerificationResult, ProjectionRecord } from "./types";

type ProjectionOptions = {
  jurisdictionId: string;
  generatedAt?: string;
  asOfDate?: string;
};

export function rebuildEffectiveCodeProjection(
  events: JurisdictionAmendmentEvent[],
  baseProvision: ModelCodeProvision,
  options: ProjectionOptions,
): ProjectionRecord {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const compiledProvision = computeEffectiveProvisionFromEvents(
    baseProvision,
    events,
    options.asOfDate,
    {
      jurisdictionId: options.jurisdictionId,
      generatedAt,
    },
  );

  const normalized: ComputedEffectiveProvision = {
    ...compiledProvision,
    metadata: {
      ...compiledProvision.metadata,
      generatedAt,
      disclaimer: AUTHORITY_DISCLAIMER,
      jurisdictionId: options.jurisdictionId,
      provisionId: baseProvision.id,
    },
  };

  return {
    jurisdictionId: options.jurisdictionId,
    provisionId: baseProvision.id,
    asOfDate: options.asOfDate,
    compiledProvision: normalized,
  };
}

export function verifyHashChain(events: JurisdictionAmendmentEvent[]): HashChainVerificationResult {
  const byId = new Map(events.map((event) => [event.id, event]));
  const errors: string[] = [];

  for (const event of events) {
    if (!event.supersedesEventId) {
      continue;
    }

    const superseded = byId.get(event.supersedesEventId);
    if (!superseded) {
      errors.push(`missing superseded event for ${event.id}`);
      continue;
    }

    if (!event.previousHash) {
      errors.push(`missing previousHash for superseding event ${event.id}`);
      continue;
    }

    if (event.previousHash !== superseded.payloadHash) {
      errors.push(`previousHash mismatch for superseding event ${event.id}`);
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
