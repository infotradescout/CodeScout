import type {
  AuthenticatedSubject,
  ComputedEffectiveProvision,
  ModelCodeProvision,
} from "../domain";
import type { CodeScoutPersistenceBoundary, ProjectionRecord } from "../persistence";

export type BaseProvisionResolver = (input: {
  codeFamily: string;
  codeYear: number;
  sectionNumber: string;
}) => Promise<ModelCodeProvision | null>;

export type ApiAuthenticatedSubject = AuthenticatedSubject & {
  authorizedJurisdictionIds?: string[];
};

export type CodeMutationResponseMetadata = {
  generatedAt: string;
  disclaimer: string;
};

export type HandlerErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "BASE_PROVISION_NOT_FOUND";

export type CodeMutationErrorBody = {
  status: "REJECTED";
  error: {
    code: HandlerErrorCode;
    message: string;
    issues?: string[];
  };
  failedMutationAttemptId?: string;
  metadata: CodeMutationResponseMetadata;
};

export type CodeMutationAcceptedBody = {
  status: "ACCEPTED";
  mutationId: string;
  jurisdictionAmendmentEventId: string;
  auditEventId: string;
  computedEffectiveStatus: ComputedEffectiveProvision["status"];
  projection: ProjectionRecord;
  metadata: CodeMutationResponseMetadata;
};

export type CodeMutationHandlerResponse =
  | {
      statusCode: 202;
      body: CodeMutationAcceptedBody;
    }
  | {
      statusCode: 400 | 401 | 403 | 409 | 422;
      body: CodeMutationErrorBody;
    };

export type CodeMutationHandlerInput = {
  pathJurisdictionId: string;
  headers: Record<string, string | undefined>;
  body: unknown;
  persistence: CodeScoutPersistenceBoundary;
  baseProvisionResolver: BaseProvisionResolver;
  authenticatedSubject?: ApiAuthenticatedSubject | null;
  now?: () => string;
  idFactory?: () => string;
};
