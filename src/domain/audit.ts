import { createPayloadHash } from "./hash";
import type { AuditEvent, ComputedEffectiveProvision, JurisdictionAmendmentEvent } from "./types";

type CreateAuditEventInput = {
  auditEventId: string;
  occurredAt: string;
  mutationEvent: JurisdictionAmendmentEvent;
  beforeState: ComputedEffectiveProvision;
  afterState: ComputedEffectiveProvision;
  previousHash?: string;
};

export function createAuditEvent(input: CreateAuditEventInput): AuditEvent {
  const previousHash = input.previousHash ?? "genesis";
  const eventHash = createPayloadHash({
    previousHash,
    occurredAt: input.occurredAt,
    mutationEventId: input.mutationEvent.id,
    actor: input.mutationEvent.submittedBy,
    beforeState: input.beforeState,
    afterState: input.afterState,
  });

  return {
    id: input.auditEventId,
    eventType: "JURISDICTION_CODE_MUTATION_SUBMITTED",
    occurredAt: input.occurredAt,
    authenticatedSubject: { ...input.mutationEvent.submittedBy },
    beforeState: structuredClone(input.beforeState),
    afterState: structuredClone(input.afterState),
    previousHash,
    eventHash,
    source: input.mutationEvent.source,
    mutationEventId: input.mutationEvent.id,
  };
}
