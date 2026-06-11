import {
  AUTHORITY_DISCLAIMER,
  computeEffectiveProvision,
  createAuditEvent,
  createFailedMutationAttempt,
  createJurisdictionAmendmentEvent,
  type JurisdictionalCodeMutationRequest,
  validateMutationRequest,
} from "../domain";
import { rebuildEffectiveCodeProjection } from "../persistence";
import type {
  ApiAuthenticatedSubject,
  CodeMutationErrorBody,
  CodeMutationHandlerInput,
  CodeMutationHandlerResponse,
  CodeMutationResponseMetadata,
} from "./types";

function createMetadata(generatedAt: string): CodeMutationResponseMetadata {
  return {
    generatedAt,
    disclaimer: AUTHORITY_DISCLAIMER,
  };
}

function isAuthenticatedSubjectValid(subject?: ApiAuthenticatedSubject | null): subject is ApiAuthenticatedSubject {
  return Boolean(subject?.subjectId && subject.name && subject.email);
}

function createErrorResponse(
  statusCode: 400 | 401 | 403 | 409 | 422,
  generatedAt: string,
  error: CodeMutationErrorBody["error"],
  failedMutationAttemptId?: string,
): CodeMutationHandlerResponse {
  return {
    statusCode,
    body: {
      status: "REJECTED",
      error,
      failedMutationAttemptId,
      metadata: createMetadata(generatedAt),
    },
  };
}

function sourceFromBody(body: unknown): "PORTAL" | "API" {
  if (typeof body !== "object" || body === null || !("source" in body)) {
    return "API";
  }

  return body.source === "PORTAL" ? "PORTAL" : "API";
}

function toId(prefix: string, idFactory: () => string) {
  return `${prefix}-${idFactory()}`;
}

export async function handleJurisdictionCodeMutation(
  input: CodeMutationHandlerInput,
): Promise<CodeMutationHandlerResponse> {
  const now = input.now ?? (() => new Date().toISOString());
  const idFactory =
    input.idFactory ??
    (() => Math.random().toString(36).slice(2, 10));
  const generatedAt = now();

  if (!isAuthenticatedSubjectValid(input.authenticatedSubject)) {
    return createErrorResponse(401, generatedAt, {
      code: "UNAUTHENTICATED",
      message: "authenticatedSubject is required",
    });
  }

  if (!input.authenticatedSubject.authorizedJurisdictionIds?.includes(input.pathJurisdictionId)) {
    return createErrorResponse(403, generatedAt, {
      code: "FORBIDDEN",
      message: "authenticatedSubject is not authorized for the target jurisdiction",
    });
  }

  const validation = validateMutationRequest({
    pathJurisdictionId: input.pathJurisdictionId,
    headers: input.headers,
    body: input.body,
  });

  if (!validation.success) {
    const failedMutationAttemptId = toId("failed", idFactory);
    const body = typeof input.body === "object" && input.body !== null ? (input.body as Record<string, unknown>) : {};
    const submittedBy =
      typeof body.submittedBy === "object" && body.submittedBy !== null
        ? (body.submittedBy as Record<string, unknown>)
        : undefined;
    const failedAttempt = createFailedMutationAttempt({
      id: failedMutationAttemptId,
      source: sourceFromBody(input.body),
      receivedAt: generatedAt,
      validationErrors: validation.errors,
      rawPayload: input.body,
      jurisdictionId: typeof body.jurisdictionId === "string" ? body.jurisdictionId : undefined,
      externalMutationId: typeof body.externalMutationId === "string" ? body.externalMutationId : undefined,
      idempotencyKey: input.headers["Idempotency-Key"] ?? input.headers["idempotency-key"],
      submittedBy: submittedBy
        ? {
            name: typeof submittedBy.name === "string" ? submittedBy.name : undefined,
            email: typeof submittedBy.email === "string" ? submittedBy.email : undefined,
          }
        : undefined,
    });

    await input.persistence.failedMutationAttempts.append(failedAttempt);

    return createErrorResponse(
      400,
      generatedAt,
      {
        code: "VALIDATION_FAILED",
        message: "Request validation failed",
        issues: validation.errors,
      },
      failedMutationAttemptId,
    );
  }

  const request: JurisdictionalCodeMutationRequest = {
    ...validation.data,
    submittedBy: {
      name: input.authenticatedSubject.name,
      email: input.authenticatedSubject.email,
      role: input.authenticatedSubject.role,
      subjectId: input.authenticatedSubject.subjectId,
    },
  };

  const codeYear = Number(request.codeYear);
  const baseProvision = await input.baseProvisionResolver({
    codeFamily: request.codeFamily,
    codeYear,
    sectionNumber: request.sectionNumber,
  });

  if (!baseProvision) {
    return createErrorResponse(422, generatedAt, {
      code: "BASE_PROVISION_NOT_FOUND",
      message: "Referenced base provision could not be resolved",
    });
  }

  const existingEvents = await input.persistence.amendmentEvents.listByJurisdictionProvision({
    jurisdictionId: request.jurisdictionId,
    modelProvisionId: baseProvision.id,
  });

  let supersededPayloadHash: string | undefined;
  if (request.supersedesEventId) {
    const supersededEvent =
      existingEvents.find((event) => event.id === request.supersedesEventId) ??
      (await input.persistence.amendmentEvents.getById(request.supersedesEventId));

    if (!supersededEvent) {
      return createErrorResponse(422, generatedAt, {
        code: "BASE_PROVISION_NOT_FOUND",
        message: "Superseded amendment event could not be resolved",
      });
    }

    supersededPayloadHash = supersededEvent.payloadHash;
  }

  const beforeProjection = rebuildEffectiveCodeProjection(existingEvents, baseProvision, {
    jurisdictionId: request.jurisdictionId,
    generatedAt,
  });

  const amendmentEventId = toId("event", idFactory);
  const mutationEvent = createJurisdictionAmendmentEvent({
    eventId: amendmentEventId,
    request,
    jurisdiction: {
      id: request.jurisdictionId,
      name: request.jurisdictionId,
      stateOrProvince: "unknown",
    },
    provisionId: baseProvision.id,
    submittedAt: generatedAt,
    source: request.source ?? "API",
    previousHash: supersededPayloadHash,
    supersedesEventId: request.supersedesEventId,
    idempotencyKey: validation.idempotencyKey,
  });

  try {
    await input.persistence.amendmentEvents.append(mutationEvent);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Conflict while appending amendment event";
    return createErrorResponse(409, generatedAt, {
      code: "CONFLICT",
      message,
    });
  }

  const afterProjection = await input.persistence.effectiveCodeProjections.rebuild({
    jurisdictionId: request.jurisdictionId,
    baseProvision,
    events: [...existingEvents, mutationEvent],
    generatedAt,
  });

  const priorAuditEvents = await input.persistence.auditEvents.listAll();
  const auditEvent = createAuditEvent({
    auditEventId: toId("audit", idFactory),
    occurredAt: generatedAt,
    mutationEvent,
    beforeState: beforeProjection.compiledProvision,
    afterState: afterProjection.compiledProvision,
    previousHash: priorAuditEvents.at(-1)?.eventHash ?? "genesis",
  });

  await input.persistence.auditEvents.append(auditEvent);

  return {
    statusCode: 202,
    body: {
      status: "ACCEPTED",
      mutationId: request.externalMutationId,
      jurisdictionAmendmentEventId: mutationEvent.id,
      auditEventId: auditEvent.id,
      computedEffectiveStatus: afterProjection.compiledProvision.status,
      projection: afterProjection,
      metadata: createMetadata(generatedAt),
    },
  };
}
