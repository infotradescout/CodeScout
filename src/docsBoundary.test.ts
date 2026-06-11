import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AUTHORITY_DISCLAIMER } from "./domain";

const appSource = readFileSync(resolve(process.cwd(), "src", "App.tsx"), "utf8");
const docs = readFileSync(resolve(process.cwd(), "docs", "CODESCOUT_FOUNDATION.md"), "utf8");

describe("ui and docs boundary", () => {
  it("places the persistent AHJ disclaimer in the app source", () => {
    expect(appSource).toContain("AUTHORITY_DISCLAIMER");
    expect(appSource).toContain("authority-banner");
    expect(AUTHORITY_DISCLAIMER).toContain("Authority Having Jurisdiction");
  });

  it("docs preserve municipal authority and separation boundary", () => {
    expect(docs).toContain("does not replace official municipal code");
    expect(docs).toContain("No shared database");
    expect(docs).toContain("No shared deployment pipeline");
  });
});
