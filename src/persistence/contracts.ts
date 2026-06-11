import type {
  AuditEvent,
  FailedMutationAttempt,
  JurisdictionAmendmentEvent,
} from "../domain";
import type {
  AmendmentEventQuery,
  ProjectionRebuildInput,
  ProjectionRecord,
  PrototypePersistenceNotice,
} from "./types";

export interface AmendmentEventStore {
  append(event: JurisdictionAmendmentEvent): Promise<void>;
  getById(id: string): Promise<JurisdictionAmendmentEvent | null>;
  listByJurisdictionProvision(input: AmendmentEventQuery): Promise<JurisdictionAmendmentEvent[]>;
}

export interface AuditEventStore {
  append(event: AuditEvent): Promise<void>;
  listByMutationEventId(mutationEventId: string): Promise<AuditEvent[]>;
  listAll(): Promise<AuditEvent[]>;
}

export interface FailedMutationAttemptStore {
  append(attempt: FailedMutationAttempt): Promise<void>;
  listByJurisdiction(jurisdictionId?: string): Promise<FailedMutationAttempt[]>;
}

export interface EffectiveCodeProjectionStore {
  upsert(record: ProjectionRecord): Promise<void>;
  getByJurisdictionProvision(input: {
    jurisdictionId: string;
    provisionId: string;
    asOfDate?: string;
  }): Promise<ProjectionRecord | null>;
  rebuild(input: ProjectionRebuildInput): Promise<ProjectionRecord>;
}

export interface CodeScoutPersistenceBoundary {
  notice: PrototypePersistenceNotice;
  amendmentEvents: AmendmentEventStore;
  auditEvents: AuditEventStore;
  failedMutationAttempts: FailedMutationAttemptStore;
  effectiveCodeProjections: EffectiveCodeProjectionStore;
}
