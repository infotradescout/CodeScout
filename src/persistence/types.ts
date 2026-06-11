import type {
  AuditEvent,
  ComputedEffectiveProvision,
  FailedMutationAttempt,
  JurisdictionAmendmentEvent,
  ModelCodeProvision,
} from "../domain";

export type AmendmentEventQuery = {
  jurisdictionId: string;
  modelProvisionId?: string;
  codeFamily?: string;
  codeYear?: number;
  sectionNumber?: string;
};

export type ProjectionRecord = {
  jurisdictionId: string;
  provisionId: string;
  asOfDate?: string;
  compiledProvision: ComputedEffectiveProvision;
};

export type ProjectionRebuildInput = {
  jurisdictionId: string;
  baseProvision: ModelCodeProvision;
  events: JurisdictionAmendmentEvent[];
  asOfDate?: string;
  generatedAt?: string;
};

export type HashChainVerificationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      errors: string[];
    };

export type PrototypePersistenceNotice = {
  adapter: "IN_MEMORY_EVENT_STORE";
  intendedUse: "PROTOTYPE_AND_TEST_ONLY";
};

export type StoredAuditEventList = AuditEvent[];
export type StoredFailedAttemptList = FailedMutationAttempt[];
