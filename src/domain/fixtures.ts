import type {
  ComputedEffectiveProvision,
  Jurisdiction,
  JurisdictionAmendmentEvent,
  JurisdictionalCodeMutationRequest,
  ModelCodeProvision,
} from "./types";

export const AUTHORITY_DISCLAIMER =
  "CodeScout compiles municipality-submitted code amendment data for reference. The local Authority Having Jurisdiction remains the final authority for code interpretation, permitting, inspection, and compliance.";

export const sampleJurisdiction: Jurisdiction = {
  id: "us-fl-pensacola",
  name: "Pensacola",
  stateOrProvince: "Florida",
};

export const defaultOverrideText =
  "Within the municipal limits of Pensacola, the minimum ultimate design wind speed shall be 150 mph for Risk Category II structures unless site-specific engineering establishes a higher requirement. Permit applications must identify exposure category and applicable wind-borne debris region.";

export const modelCodeProvisions: ModelCodeProvision[] = [
  {
    id: "irc-2021-r301-2-1",
    codeFamily: "IRC",
    codeYear: "2021",
    sectionNumber: "R301.2.1",
    title: "Wind Design Criteria",
    baseText:
      "Buildings and portions thereof shall be constructed in accordance with the wind provisions of this code. The basic design wind speed, V, shall be determined in accordance with Figure R301.2(2) and local climatic and geographic design criteria.",
  },
  {
    id: "irc-2021-r302-5-1",
    codeFamily: "IRC",
    codeYear: "2021",
    sectionNumber: "R302.5.1",
    title: "Opening Protection",
    baseText:
      "Openings from a private garage directly into a room used for sleeping purposes shall not be permitted. Other openings between the garage and residence shall be equipped with solid wood doors, solid or honeycomb-core steel doors, or 20-minute fire-rated doors.",
  },
  {
    id: "fbc-2023-1609-3",
    codeFamily: "FBC",
    codeYear: "2023",
    sectionNumber: "1609.3",
    title: "Basic Design Wind Speed",
    baseText:
      "The basic design wind speed in miles per hour shall be determined from the wind speed maps in accordance with ASCE 7. Wind exposure, risk category, and site-specific topographic effects shall be documented for permit review.",
  },
];

export function createMutationRequest(
  overrides: Partial<JurisdictionalCodeMutationRequest> = {},
): JurisdictionalCodeMutationRequest {
  const baseProvision = modelCodeProvisions[0];
  return {
    mutationType: "JURISDICTIONAL_CODE_MUTATION",
    jurisdictionId: sampleJurisdiction.id,
    codeFamily: baseProvision.codeFamily,
    codeYear: baseProvision.codeYear,
    sectionNumber: baseProvision.sectionNumber,
    action: "AMEND",
    amendedText: defaultOverrideText,
    ordinanceReference: "Ord. 2026-18, adopted 2026-05-28",
    effectiveDate: "2026-07-01",
    sourceSystem: "CodeScout Municipal Amendment Portal",
    externalMutationId: "pensacola-mut-0001",
    submittedBy: {
      name: "Pensacola Clerk Office",
      email: "clerk.office@pensacola.example.gov",
      role: "Municipal Code Administrator",
      subjectId: "auth0|pensacola-clerk-1842",
    },
    source: "PORTAL",
    ...overrides,
  };
}

export function createEventFixture(
  overrides: Partial<JurisdictionAmendmentEvent> = {},
): JurisdictionAmendmentEvent {
  return {
    id: "event-0001",
    jurisdictionId: sampleJurisdiction.id,
    modelProvisionId: modelCodeProvisions[0].id,
    codeFamily: modelCodeProvisions[0].codeFamily,
    codeYear: modelCodeProvisions[0].codeYear,
    sectionNumber: modelCodeProvisions[0].sectionNumber,
    action: "AMEND",
    amendedText: defaultOverrideText,
    ordinanceReference: "Ord. 2026-18, adopted 2026-05-28",
    effectiveDate: "2026-07-01",
    submittedBy: {
      subjectId: "auth0|pensacola-clerk-1842",
      name: "Pensacola Clerk Office",
      email: "clerk.office@pensacola.example.gov",
      role: "Municipal Code Administrator",
    },
    submittedAt: "2026-06-11T12:00:00.000Z",
    payloadHash: "codescout-hash-seed",
    status: "SUBMITTED",
    source: "PORTAL",
    externalMutationId: "pensacola-mut-0001",
    idempotencyKey: "idem-0001",
    ...overrides,
  };
}

export function createComputedProvisionFixture(
  overrides: Partial<ComputedEffectiveProvision> = {},
): ComputedEffectiveProvision {
  const provision = modelCodeProvisions[0];
  return {
    jurisdictionId: sampleJurisdiction.id,
    provisionId: provision.id,
    codeFamily: provision.codeFamily,
    codeYear: provision.codeYear,
    sectionNumber: provision.sectionNumber,
    title: provision.title,
    baseText: provision.baseText,
    amendedText: defaultOverrideText,
    displayText: defaultOverrideText,
    status: "LOCALLY_AMENDED",
    ordinanceReference: "Ord. 2026-18, adopted 2026-05-28",
    effectiveDate: "2026-07-01",
    eventId: "event-0001",
    previousHash: "codescout-hash-prev",
    payloadHash: "codescout-hash-current",
    metadata: {
      generatedAt: "2026-06-11T12:00:00.000Z",
      disclaimer: AUTHORITY_DISCLAIMER,
      computedStatus: "LOCALLY_AMENDED",
      jurisdictionId: sampleJurisdiction.id,
      provisionId: provision.id,
    },
    ...overrides,
  };
}
