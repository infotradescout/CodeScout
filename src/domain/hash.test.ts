import { describe, expect, it } from "vitest";
import { createPayloadHash } from "./hash";

describe("createPayloadHash", () => {
  it("returns the same hash for identical controlled inputs", () => {
    expect(createPayloadHash({ a: 1, b: 2 })).toBe(createPayloadHash({ b: 2, a: 1 }));
  });

  it("changes hash when amendedText changes", () => {
    expect(createPayloadHash({ amendedText: "One" })).not.toBe(createPayloadHash({ amendedText: "Two" }));
  });

  it("changes hash when previousHash changes", () => {
    expect(createPayloadHash({ previousHash: "a" })).not.toBe(createPayloadHash({ previousHash: "b" }));
  });
});
