import { describe, expect, it } from "vitest";
import { findExactSerialMatch, normalizeSerialCandidate } from "./serial-lookup";

describe("normalizeSerialCandidate", () => {
  it("trims and uppercases serial values", () => {
    expect(normalizeSerialCandidate("  abC-123  ")).toBe("ABC-123");
  });

  it("returns empty string for blank input", () => {
    expect(normalizeSerialCandidate("   ")).toBe("");
  });
});

describe("findExactSerialMatch", () => {
  it("finds exact serial match after normalization", () => {
    const result = findExactSerialMatch(" sn-001 ", [
      { fridge_serial_number: "SN-001" },
      { fridge_serial_number: "SN-002" },
    ]);

    expect(result).toBe("SN-001");
  });

  it("returns null when serial does not exist", () => {
    const result = findExactSerialMatch("SN-999", [
      { fridge_serial_number: "SN-001" },
      { fridge_serial_number: "SN-002" },
    ]);

    expect(result).toBeNull();
  });

  it("returns null when candidate is empty", () => {
    const result = findExactSerialMatch("  ", [{ fridge_serial_number: "SN-001" }]);
    expect(result).toBeNull();
  });
});
