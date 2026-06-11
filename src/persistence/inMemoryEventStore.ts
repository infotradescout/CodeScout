import type {
  AuditEvent,
  FailedMutationAttempt,
  JurisdictionAmendmentEvent,
} from "../domain";
import type {
  AmendmentEventStore,
  AuditEventStore,
  CodeScoutPersistenceBoundary,
  EffectiveCodeProjectionStore,
  FailedMutationAttemptStore,
} from "./contracts";
import { rebuildEffectiveCodeProjection } from "./projections";
import type {
  AmendmentEventQuery,
  ProjectionRebuildInput,
  ProjectionRecord,
} from "./types";

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function projectionKey(input: { jurisdictionId: string; provisionId: string; asOfDate?: string }) {
  return `${input.jurisdictionId}::${input.provisionId}::${input.asOfDate ?? "current"}`;
}

class InMemoryAmendmentEventStore implements AmendmentEventStore {
  private readonly events = new Map<string, JurisdictionAmendmentEvent>();
  private readonly idempotencyIndex = new Map<string, string>();

  async append(event: JurisdictionAmendmentEvent): Promise<void> {
    if (this.events.has(event.id)) {
      throw new Error(`duplicate amendment event id: ${event.id}`);
    }

    if (event.idempotencyKey) {
      const idempotencyScope = `${event.jurisdictionId}::${event.source}::${event.idempotencyKey}`;
      if (this.idempotencyIndex.has(idempotencyScope)) {
        throw new Error(`duplicate idempotency key for jurisdiction/source: ${event.idempotencyKey}`);
      }

      this.idempotencyIndex.set(idempotencyScope, event.id);
    }

    this.events.set(event.id, cloneValue(event));
  }

  async getById(id: string): Promise<JurisdictionAmendmentEvent | null> {
    const event = this.events.get(id);
    return event ? cloneValue(event) : null;
  }

  async listByJurisdictionProvision(input: AmendmentEventQuery): Promise<JurisdictionAmendmentEvent[]> {
    const filtered = [...this.events.values()].filter((event) => {
      if (event.jurisdictionId !== input.jurisdictionId) {
        return false;
      }

      if (input.modelProvisionId && event.modelProvisionId !== input.modelProvisionId) {
        return false;
      }

      if (input.codeFamily && event.codeFamily !== input.codeFamily) {
        return false;
      }

      if (input.codeYear && Number(event.codeYear) !== input.codeYear) {
        return false;
      }

      if (input.sectionNumber && event.sectionNumber !== input.sectionNumber) {
        return false;
      }

      return true;
    });

    return cloneValue(filtered);
  }
}

class InMemoryAuditEventStore implements AuditEventStore {
  private readonly events: AuditEvent[] = [];

  async append(event: AuditEvent): Promise<void> {
    this.events.push(cloneValue(event));
  }

  async listByMutationEventId(mutationEventId: string): Promise<AuditEvent[]> {
    return cloneValue(this.events.filter((event) => event.mutationEventId === mutationEventId));
  }
}

class InMemoryFailedMutationAttemptStore implements FailedMutationAttemptStore {
  private readonly attempts: FailedMutationAttempt[] = [];

  async append(attempt: FailedMutationAttempt): Promise<void> {
    this.attempts.push(cloneValue(attempt));
  }

  async listByJurisdiction(jurisdictionId?: string): Promise<FailedMutationAttempt[]> {
    const filtered = jurisdictionId
      ? this.attempts.filter((attempt) => attempt.jurisdictionId === jurisdictionId)
      : this.attempts;

    return cloneValue(filtered);
  }
}

class InMemoryEffectiveCodeProjectionStore implements EffectiveCodeProjectionStore {
  private readonly records = new Map<string, ProjectionRecord>();

  async upsert(record: ProjectionRecord): Promise<void> {
    this.records.set(
      projectionKey({
        jurisdictionId: record.jurisdictionId,
        provisionId: record.provisionId,
        asOfDate: record.asOfDate,
      }),
      cloneValue(record),
    );
  }

  async getByJurisdictionProvision(input: {
    jurisdictionId: string;
    provisionId: string;
    asOfDate?: string;
  }): Promise<ProjectionRecord | null> {
    const record = this.records.get(projectionKey(input));
    return record ? cloneValue(record) : null;
  }

  async rebuild(input: ProjectionRebuildInput): Promise<ProjectionRecord> {
    const rebuilt = rebuildEffectiveCodeProjection(input.events, input.baseProvision, {
      jurisdictionId: input.jurisdictionId,
      asOfDate: input.asOfDate,
      generatedAt: input.generatedAt,
    });

    await this.upsert(rebuilt);
    return cloneValue(rebuilt);
  }
}

export function createInMemoryPersistenceBoundary(): CodeScoutPersistenceBoundary {
  return {
    notice: {
      adapter: "IN_MEMORY_EVENT_STORE",
      intendedUse: "PROTOTYPE_AND_TEST_ONLY",
    },
    amendmentEvents: new InMemoryAmendmentEventStore(),
    auditEvents: new InMemoryAuditEventStore(),
    failedMutationAttempts: new InMemoryFailedMutationAttemptStore(),
    effectiveCodeProjections: new InMemoryEffectiveCodeProjectionStore(),
  };
}
