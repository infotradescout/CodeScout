import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const docs = readFileSync(resolve(process.cwd(), "docs", "CODESCOUT_PERSISTENCE_BOUNDARY.md"), "utf8");

describe("persistence docs boundary", () => {
  it("states no shared database or deployment with TradeScout", () => {
    expect(docs).toContain("CodeScout does not share a database with TradeScout.");
    expect(docs).toContain("CodeScout does not share a deployment pipeline with TradeScout.");
  });

  it("states application-level immutability only and derived projections", () => {
    expect(docs).toContain("application-level immutability only");
    expect(docs).toContain("not canonical truth");
  });

  it("does not claim CodeScout replaces AHJ or legal authority", () => {
    expect(docs).toContain("CodeScout does not replace AHJ or legal authority.");
  });
});
