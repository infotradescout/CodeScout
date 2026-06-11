import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const docs = readFileSync(resolve(process.cwd(), "docs", "CODESCOUT_API_BOUNDARY.md"), "utf8");

describe("api boundary docs", () => {
  it("states this slice is simulated and not a real backend server", () => {
    expect(docs).toContain("Simulated handler boundary");
    expect(docs).toContain("No real backend server in this slice.");
    expect(docs).toContain("No real authentication provider.");
  });

  it("preserves storage and separation boundaries", () => {
    expect(docs).toContain("append-only");
    expect(docs).toContain("No real database or migrations.");
    expect(docs).toContain("No TradeScout integration.");
  });

  it("preserves AHJ authority language", () => {
    expect(docs).toContain("Authority Having Jurisdiction");
    expect(docs).toContain("does not replace AHJ or legal authority");
  });
});
