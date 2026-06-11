import { z } from "zod";
import { createPayloadHash } from "./hash";
import type {
  AuthenticatedSubject,
  FailedMutationAttempt,
  Jurisdiction,
  JurisdictionAmendmentEvent,
  JurisdictionalCodeMutationRequest,
  ValidationResult,
} from "./types";

const submittedBySchema = z.object({
  name: z.string().trim().min(1, "submittedBy.name is required"),
  email: z.string().trim().min(1, "submittedBy.email is required").email("submittedBy.email must be a valid email address"),
  role: z.string().trim().optional(),
  subjectId: z.string().trim().optional(),
});

const mutationRequestSchema = z
  .object({
    mutationType: z.literal("JURISDICTIONAL_CODE_MUTATION"),
    jurisdictionId: z.string().trim().min(1, "jurisdictionId is required"),
    codeFamily: z.string().trim().min(1, "codeFamily is required"),
    codeYear: z.string().trim().min(1, "codeYear is required"),
    sectionNumber: z.string().trim().min(1, "sectionNumber is required"),
    action: z.enum(["INHERIT_BASE", "AMEND", "DELETE"]),
    amendedText: z.string().trim().optional(),
    ordinanceReference: z.string().trim().optional(),
    effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "effectiveDate must be a YYYY-MM-DD date").optional(),
    sourceSystem: z.string().trim().min(1, "sourceSystem is required"),
    externalMutationId: z.string().trim().min(1, "externalMutationId is required"),
    submittedBy: submittedBySchema,
    source: z.enum(["PORTAL", "API"]).optional(),
    sourceDocumentUrl: z.string().url().optional(),
    supersedesEventId: z.string().trim().optional(),
  })
  .superRefine((payload, context) => {
    if (payload.action === "AMEND" && !payload.amendedText) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amendedText"],
        message: "amendedText is required when action is AMEND",
      });
    }

    if ((payload.action === "AMEND" || payload.action === "DELETE") && !payload.ordinanceReference) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ordinanceReference"],
        message: "ordinanceReference is required when action is AMEND or DELETE",
      });
    }

    if ((payload.action === "AMEND" || payload.action === "DELETE") && !payload.effectiveDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["effectiveDate"],
        message: "effectiveDate is required when action is AMEND or DELETE",
      });
    }
  });

type ValidationInput = {
  pathJurisdictionId: string;
  headers: Record<string, string | undefined>;
  body: unknown;
};

export function validateMutationRequest(input: ValidationInput): ValidationResult {
  const idempotencyKey = input.headers["Idempotency-Key"] ?? input.headers["idempotency-key"];
  const parsed = mutationRequestSchema.safeParse(input.body);

  if (!parsed.success) {
    const errors = parsed.error.issues.map((issue) => issue.message);
    if (!idempotencyKey) {
      errors.push("Idempotency-Key header is required");
    }

    return {
      success: false,
      errors,
    };
  }

  const errors: string[] = [];

  if (!idempotencyKey) {
    errors.push("Idempotency-Key header is required");
  }

  if (parsed.data.jurisdictionId !== input.pathJurisdictionId) {
    errors.push("path jurisdictionId must match body jurisdictionId");
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: parsed.data,
    idempotencyKey: idempotencyKey!,
  };
}

type CreateEventInput = {
  eventId: string;
  request: JurisdictionalCodeMutationRequest;
  jurisdiction: Jurisdiction;
  provisionId: string;
  submittedAt: string;
  source: JurisdictionAmendmentEvent["source"];
  status?: JurisdictionAmendmentEvent["status"];
  previousHash?: string;
  supersedesEventId?: string;
  idempotencyKey?: string;
};

function toAuthenticatedSubject(request: JurisdictionalCodeMutationRequest): AuthenticatedSubject {
  return {
    subjectId: request.submittedBy.subjectId ?? request.submittedBy.email,
    name: request.submittedBy.name,
    email: request.submittedBy.email,
    role: request.submittedBy.role ?? "Municipal Code Administrator",
  };
}

export function createJurisdictionAmendmentEvent(input: CreateEventInput): JurisdictionAmendmentEvent {
  const submittedBy = toAuthenticatedSubject(input.request);
  const payload = {
    jurisdictionId: input.jurisdiction.id,
    provisionId: input.provisionId,
    codeFamily: input.request.codeFamily,
    codeYear: input.request.codeYear,
    sectionNumber: input.request.sectionNumber,
    action: input.request.action,
    amendedText: input.request.amendedText,
    ordinanceReference: input.request.ordinanceReference,
    sourceDocumentUrl: input.request.sourceDocumentUrl,
    effectiveDate: input.request.effectiveDate,
    submittedBy,
    submittedAt: input.submittedAt,
    supersedesEventId: input.supersedesEventId ?? input.request.supersedesEventId,
    previousHash: input.previousHash,
    status: input.status ?? "SUBMITTED",
    source: input.source,
    externalMutationId: input.request.externalMutationId,
    idempotencyKey: input.idempotencyKey,
  };

  return {
    id: input.eventId,
    jurisdictionId: input.jurisdiction.id,
    modelProvisionId: input.provisionId,
    codeFamily: input.request.codeFamily,
    codeYear: input.request.codeYear,
    sectionNumber: input.request.sectionNumber,
    action: input.request.action,
    amendedText: input.request.amendedText,
    ordinanceReference: input.request.ordinanceReference,
    sourceDocumentUrl: input.request.sourceDocumentUrl,
    effectiveDate: input.request.effectiveDate ?? input.submittedAt.slice(0, 10),
    submittedBy,
    submittedAt: input.submittedAt,
    supersedesEventId: payload.supersedesEventId,
    previousHash: input.previousHash,
    payloadHash: createPayloadHash(payload),
    status: input.status ?? "SUBMITTED",
    source: input.source,
    externalMutationId: input.request.externalMutationId,
    idempotencyKey: input.idempotencyKey,
  };
}

type FailedAttemptInput = {
  id: string;
  source: FailedMutationAttempt["source"];
  receivedAt: string;
  validationErrors: string[];
  rawPayload: unknown;
  jurisdictionId?: string;
  externalMutationId?: string;
  idempotencyKey?: string;
  submittedBy?: {
    name?: string;
    email?: string;
  };
};

export function createFailedMutationAttempt(input: FailedAttemptInput): FailedMutationAttempt {
  return {
    id: input.id,
    jurisdictionId: input.jurisdictionId,
    source: input.source,
    receivedAt: input.receivedAt,
    externalMutationId: input.externalMutationId,
    idempotencyKey: input.idempotencyKey,
    validationErrors: [...input.validationErrors],
    rawPayloadHash: createPayloadHash(input.rawPayload),
    submittedBy: input.submittedBy ? { ...input.submittedBy } : undefined,
  };
}
