import { describe, expect, it } from "vitest";
import {
  normalizeHexIdentifier,
  normalizeCNumber,
  validateAssetIdentifiers,
  validateOrganisationAssetValidationForm,
} from "./organisation-asset-validation";

describe("organisation asset validation helpers", () => {
  it("normalizes hex values without truncating", () => {
    expect(normalizeHexIdentifier("aa-bb-cc-dd-ee-ff-11")).toBe("AABBCCDDEEFF11");
  });

  it("normalizes c-numbers by trimming and uppercasing", () => {
    expect(normalizeCNumber(" c10001 ")).toBe("C10001");
  });

  it("validates serial, mac, and c-number against min/max ranges", () => {
    const errors = validateAssetIdentifiers(
      {
        fridge_serial_number: "A1B2",
        mac_address: "A1",
        c_number: "C10001",
      },
      {
        organisation_id: 1,
        serial_min_length: 4,
        serial_max_length: 8,
        mac_min_length: 4,
        mac_max_length: 12,
        c_number_min_length: 2,
        c_number_max_length: 10,
      },
      { requireSerial: true },
    );

    expect(errors.fridge_serial_number).toBeUndefined();
    expect(errors.mac_address).toMatch(/between 4 and 12/);
    expect(errors.c_number).toBeUndefined();
  });

  it("rejects invalid form ranges", () => {
    const result = validateOrganisationAssetValidationForm({
      serial_min_length: "8",
      serial_max_length: "4",
      mac_min_length: "12",
      mac_max_length: "12",
      c_number_min_length: "1",
      c_number_max_length: "10",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.serial_max_length).toMatch(/greater than or equal/);
  });
});
