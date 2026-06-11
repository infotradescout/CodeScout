export const amendmentActions = ["INHERIT_BASE", "AMEND", "DELETE"] as const;
export const eventStatuses = ["SUBMITTED", "APPROVED", "REJECTED", "SUPERSEDED"] as const;
export const auditSources = ["PORTAL", "API"] as const;
export const effectiveProvisionStatuses = ["BASE_CODE", "LOCALLY_AMENDED", "LOCALLY_DELETED"] as const;

export type AmendmentAction = (typeof amendmentActions)[number];
export type EventStatus = (typeof eventStatuses)[number];
export type AuditSource = (typeof auditSources)[number];
export type EffectiveProvisionStatus = (typeof effectiveProvisionStatuses)[number];

export type ModelCodeProvision = {
  id: string;
  codeFamily: string;
  codeYear: string;
  sectionNumber: string;
  title: string;
  baseText: string;
};

export type Jurisdiction = {
  id: string;
  name: string;
  stateOrProvince: string;
};

export type AuthenticatedSubject = {
  subjectId: string;
  name: string;
  email: string;
  role: string;
  authorizedJurisdictionIds?: string[];
};

export type JurisdictionAmendmentEvent = {
  id: string;
  jurisdictionId: string;
  modelProvisionId: string;
  codeFamily: string;
  codeYear: string;
  sectionNumber: string;
  action: AmendmentAction;
  amendedText?: string;
  ordinanceReference?: string;
  sourceDocumentUrl?: string;
  effectiveDate: string;
  submittedBy: AuthenticatedSubject;
  submittedAt: string;
  supersedesEventId?: string;
  previousHash?: string;
  payloadHash: string;
  status: EventStatus;
  source: AuditSource;
  externalMutationId?: string;
  idempotencyKey?: string;
};

export type CompiledCodePayloadMetadata = {
  generatedAt: string;
  disclaimer: string;
  computedStatus: EffectiveProvisionStatus;
  jurisdictionId: string;
  provisionId: string;
};

export type ComputedEffectiveProvision = {
  jurisdictionId: string;
  provisionId: string;
  codeFamily: string;
  codeYear: string;
  sectionNumber: string;
  title: string;
  baseText: string;
  amendedText: string | null;
  displayText: string | null;
  status: EffectiveProvisionStatus;
  ordinanceReference: string | null;
  effectiveDate: string | null;
  eventId: string | null;
  previousHash: string | null;
  payloadHash: string | null;
  metadata: CompiledCodePayloadMetadata;
};

export type JurisdictionalCodeMutationRequest = {
  mutationType: "JURISDICTIONAL_CODE_MUTATION";
  jurisdictionId: string;
  codeFamily: string;
  codeYear: string;
  sectionNumber: string;
  action: AmendmentAction;
  amendedText?: string;
  ordinanceReference?: string;
  effectiveDate?: string;
  sourceSystem: string;
  externalMutationId: string;
  submittedBy: {
    name: string;
    email: string;
    role?: string;
    subjectId?: string;
  };
  source?: AuditSource;
  sourceDocumentUrl?: string;
  supersedesEventId?: string;
};

export type JurisdictionalCodeMutationResponse = {
  mutationAccepted: true;
  event: JurisdictionAmendmentEvent;
  auditEvent: AuditEvent;
  compiledProvision: ComputedEffectiveProvision;
  metadata: CompiledCodePayloadMetadata;
};

export type AuditEvent = {
  id: string;
  eventType: "JURISDICTION_CODE_MUTATION_SUBMITTED";
  occurredAt: string;
  authenticatedSubject: AuthenticatedSubject;
  beforeState: ComputedEffectiveProvision;
  afterState: ComputedEffectiveProvision;
  previousHash: string;
  eventHash: string;
  source: AuditSource;
  mutationEventId: string;
};

export type FailedMutationAttempt = {
  id: string;
  jurisdictionId?: string;
  source: AuditSource;
  receivedAt: string;
  externalMutationId?: string;
  idempotencyKey?: string;
  validationErrors: string[];
  rawPayloadHash: string;
  submittedBy?: {
    name?: string;
    email?: string;
  };
};

export type ValidationResult =
  | {
      success: true;
      data: JurisdictionalCodeMutationRequest;
      idempotencyKey: string;
    }
  | {
      success: false;
      errors: string[];
    };
