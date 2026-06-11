import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { amendmentActions } from "./domain";

const openApi = readFileSync(resolve(process.cwd(), "openapi.yaml"), "utf8");

describe("openapi contract", () => {
  it("contains the mutation endpoint and bearer auth", () => {
    expect(openApi).toContain("openapi: 3.1.0");
    expect(openApi).toContain("/api/v1/jurisdictions/{jurisdictionId}/code-mutations:");
    expect(openApi).toContain("bearerAuth");
  });

  it("requires Idempotency-Key", () => {
    expect(openApi).toContain("name: Idempotency-Key");
    expect(openApi).toContain("required: true");
  });

  it("documents the action enum", () => {
    for (const action of amendmentActions) {
      expect(openApi).toContain(`- ${action}`);
    }
  });

  it("includes response metadata and response codes", () => {
    expect(openApi).toContain("generatedAt");
    expect(openApi).toContain("disclaimer");
    for (const code of ['"202"', '"400"', '"401"', '"403"', '"409"', '"422"']) {
      expect(openApi).toContain(`${code}:`);
    }
  });

  it("aligns validation failure shape", () => {
    expect(openApi).toContain("ValidationFailure");
    expect(openApi).toContain("- errors");
  });
});
