import { useState } from "react";
import {
  BadgeCheck,
  BookOpen,
  Braces,
  Building2,
  ChevronRight,
  Clock3,
  Code2,
  FileDiff,
  FileText,
  LockKeyhole,
  RefreshCcw,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import openApiContract from "../openapi.yaml?raw";
import {
  AUTHORITY_DISCLAIMER,
  amendmentActions,
  computeEffectiveProvision,
  createAuditEvent,
  createJurisdictionAmendmentEvent,
  createMutationRequest,
  modelCodeProvisions,
  sampleJurisdiction,
  validateMutationRequest,
  type AmendmentAction,
  type AuditEvent,
  type JurisdictionalCodeMutationResponse,
} from "./domain";
import "./styles.css";

function actionLabel(action: AmendmentAction) {
  return action.replace("_", " ");
}

export function App() {
  const [selectedProvisionId, setSelectedProvisionId] = useState(modelCodeProvisions[0].id);
  const [action, setAction] = useState<AmendmentAction>("AMEND");
  const [overrideText, setOverrideText] = useState(createMutationRequest().amendedText ?? "");
  const [ordinanceReference, setOrdinanceReference] = useState("Ord. 2026-18, adopted 2026-05-28");
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [lastResponse, setLastResponse] = useState<JurisdictionalCodeMutationResponse | null>(null);

  const provision = modelCodeProvisions.find((candidate) => candidate.id === selectedProvisionId) ?? modelCodeProvisions[0];
  const previewRequest = createMutationRequest({
    codeFamily: provision.codeFamily,
    codeYear: provision.codeYear,
    sectionNumber: provision.sectionNumber,
    action,
    amendedText: action === "AMEND" ? overrideText.trim() : undefined,
    ordinanceReference,
    sourceSystem: "CodeScout Municipal Amendment Portal",
  });

  const validation = validateMutationRequest({
    pathJurisdictionId: sampleJurisdiction.id,
    headers: {
      "Idempotency-Key": `portal-${provision.id}-${auditEvents.length + 1}`,
    },
    body: previewRequest,
  });

  const previewEvent =
    validation.success
      ? createJurisdictionAmendmentEvent({
          eventId: `event-${String(auditEvents.length + 1).padStart(4, "0")}`,
          request: validation.data,
          jurisdiction: sampleJurisdiction,
          provisionId: provision.id,
          submittedAt: "2026-06-11T12:00:00.000Z",
          source: "PORTAL",
          previousHash: auditEvents[0]?.eventHash ?? "genesis",
          idempotencyKey: validation.idempotencyKey,
        })
      : null;

  const effectiveProvision = computeEffectiveProvision(
    provision,
    previewEvent ?? undefined,
    {
      jurisdictionId: sampleJurisdiction.id,
      generatedAt: "2026-06-11T12:00:00.000Z",
    },
  );

  function selectProvision(provisionId: string) {
    setSelectedProvisionId(provisionId);
    setAction("AMEND");
    setOverrideText(createMutationRequest().amendedText ?? "");
  }

  function submitMutation() {
    const occurredAt = new Date().toISOString();
    const liveValidation = validateMutationRequest({
      pathJurisdictionId: sampleJurisdiction.id,
      headers: {
        "Idempotency-Key": `portal-${provision.id}-${auditEvents.length + 1}`,
      },
      body: createMutationRequest({
        codeFamily: provision.codeFamily,
        codeYear: provision.codeYear,
        sectionNumber: provision.sectionNumber,
        action,
        amendedText: action === "AMEND" ? overrideText.trim() : undefined,
        ordinanceReference,
        sourceSystem: "CodeScout Municipal Amendment Portal",
      }),
    });

    if (!liveValidation.success) {
      return;
    }

    const event = createJurisdictionAmendmentEvent({
      eventId: `event-${String(auditEvents.length + 1).padStart(4, "0")}`,
      request: liveValidation.data,
      jurisdiction: sampleJurisdiction,
      provisionId: provision.id,
      submittedAt: occurredAt,
      source: "PORTAL",
      previousHash: auditEvents[0]?.eventHash ?? "genesis",
      idempotencyKey: liveValidation.idempotencyKey,
    });

    const beforeState = computeEffectiveProvision(provision, undefined, {
      jurisdictionId: sampleJurisdiction.id,
      generatedAt: occurredAt,
    });
    const afterState = computeEffectiveProvision(provision, event, {
      jurisdictionId: sampleJurisdiction.id,
      generatedAt: occurredAt,
    });

    const auditEvent = createAuditEvent({
      auditEventId: `audit-${String(auditEvents.length + 1).padStart(4, "0")}`,
      occurredAt,
      mutationEvent: event,
      beforeState,
      afterState,
      previousHash: auditEvents[0]?.eventHash ?? "genesis",
    });

    setAuditEvents((current) => [auditEvent, ...current]);
    setLastResponse({
      mutationAccepted: true,
      event,
      auditEvent,
      compiledProvision: afterState,
      metadata: afterState.metadata,
    });
  }

  const payloadPreview = JSON.stringify(
    lastResponse ?? {
      mutationAccepted: validation.success,
      request: previewRequest,
      previewEvent,
      compiledProvision: effectiveProvision,
    },
    null,
    2,
  );

  return (
    <div className="page-shell">
      <main className="app-shell">
        <aside className="sidebar" aria-label="Model provisions">
          <div className="brand-row">
            <div className="brand-mark">
              <Building2 size={22} />
            </div>
            <div>
              <p className="eyebrow">CodeScout</p>
              <h1>Municipal Amendment Portal</h1>
            </div>
          </div>

          <section className="section-list">
            <p className="section-label">Target Provision</p>
            {modelCodeProvisions.map((candidate) => (
              <button
                className={`provision-button ${candidate.id === provision.id ? "active" : ""}`}
                key={candidate.id}
                onClick={() => selectProvision(candidate.id)}
                type="button"
              >
                <span>
                  <strong>{candidate.codeYear} {candidate.codeFamily}</strong>
                  <small>
                    {candidate.sectionNumber} · {candidate.title}
                  </small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </section>

          <section className="status-block">
            <ShieldCheck size={18} />
            <span>Authenticated as Pensacola Clerk Office</span>
          </section>
        </aside>

        <section className="workbench">
          <header className="topbar">
            <div>
              <p className="eyebrow">
                {provision.codeYear} {provision.codeFamily}
              </p>
              <h2>
                Section {provision.sectionNumber}: {provision.title}
              </h2>
            </div>
            <button className="secondary-button" type="button" onClick={() => setAuditEvents([])}>
              <RefreshCcw size={17} />
              Reset Audit
            </button>
          </header>

          <div className="action-strip" aria-label="Amendment action">
            {amendmentActions.map((candidate) => (
              <button
                className={candidate === action ? "selected" : ""}
                key={candidate}
                onClick={() => setAction(candidate)}
                type="button"
              >
                {candidate === "INHERIT_BASE" && <BookOpen size={17} />}
                {candidate === "AMEND" && <FileDiff size={17} />}
                {candidate === "DELETE" && <Trash2 size={17} />}
                {actionLabel(candidate)}
              </button>
            ))}
          </div>

          <section className="diff-grid" aria-label="Side-by-side code comparison">
            <article className="pane">
              <div className="pane-header">
                <FileText size={18} />
                <span>Base Model Code</span>
              </div>
              <div className="code-text">{provision.baseText}</div>
            </article>

            <article className={`pane ${action === "DELETE" ? "delete-pane" : ""}`}>
              <div className="pane-header">
                <FileDiff size={18} />
                <span>Local Override</span>
              </div>
              {action === "AMEND" ? (
                <textarea
                  aria-label="Local override text"
                  value={overrideText}
                  onChange={(event) => setOverrideText(event.target.value)}
                />
              ) : (
                <div className="code-text quiet">
                  {action === "DELETE"
                    ? "This provision will be marked as locally deleted."
                    : "No override text required. The jurisdiction inherits the model provision as written."}
                </div>
              )}
            </article>
          </section>

          <section className="effective-row">
            <article className="effective-code">
              <div className="pane-header">
                <BadgeCheck size={18} />
                <span>Computed Effective Local Code</span>
              </div>
              <p>{effectiveProvision.displayText ?? "Deleted locally. No display text is published for this provision."}</p>
            </article>

            <article className="submit-panel">
              <label>
                Ordinance Reference
                <input value={ordinanceReference} onChange={(event) => setOrdinanceReference(event.target.value)} />
              </label>
              <button className="submit-button" type="button" disabled={!validation.success} onClick={submitMutation}>
                <Send size={18} />
                Submit & Sign
              </button>
              <small>
                Captures subject ID, timestamp, before state, after state, and chained audit hash.
              </small>
            </article>
          </section>

          <section className="bottom-grid">
            <article className="api-panel">
              <div className="pane-header">
                <Braces size={18} />
                <span>REST Mutation Payload</span>
              </div>
              <pre>{payloadPreview}</pre>
            </article>

            <article className="api-panel">
              <div className="pane-header">
                <Code2 size={18} />
                <span>OpenAPI Contract</span>
              </div>
              <pre>{openApiContract}</pre>
            </article>

            <article className="audit-panel">
              <div className="pane-header">
                <LockKeyhole size={18} />
                <span>Immutable Audit Events</span>
              </div>
              {auditEvents.length === 0 ? (
                <div className="empty-audit">
                  <Clock3 size={20} />
                  <span>No signed events yet.</span>
                </div>
              ) : (
                <div className="audit-list">
                  {auditEvents.map((event) => (
                    <div className="audit-event" key={event.id}>
                      <div>
                        <strong>{event.id}</strong>
                        <small>{new Date(event.occurredAt).toLocaleString()}</small>
                      </div>
                      <span className="pill">{actionLabel(lastResponse?.event.action ?? action)}</span>
                      <code>{event.eventHash}</code>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </section>
        </section>
      </main>

      <footer className="authority-banner">
        <ShieldCheck size={16} />
        <span>{AUTHORITY_DISCLAIMER}</span>
      </footer>
    </div>
  );
}
