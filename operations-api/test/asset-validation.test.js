const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeHexIdentifier,
  normalizeCNumber,
  validateAssetIdentifiers,
  validateOrganisationAssetValidationPayload,
} = require("../asset-validation");

test("normalizeHexIdentifier strips non-hex characters and uppercases", () => {
  assert.equal(normalizeHexIdentifier("aa-bb cc"), "AABBCC");
});

test("normalizeCNumber trims and uppercases", () => {
  assert.equal(normalizeCNumber(" c10x "), "C10X");
});

test("validateAssetIdentifiers applies min/max range rules", () => {
  const errors = validateAssetIdentifiers(
    {
      fridge_serial_number: "ABC123",
      mac_address: "AA11",
      c_number: "C1",
    },
    {
      serial_min_length: 4,
      serial_max_length: 8,
      mac_min_length: 6,
      mac_max_length: 12,
      c_number_min_length: 2,
      c_number_max_length: 10,
    },
    { requireSerial: true },
  );

  assert.equal(errors.fridge_serial_number, undefined);
  assert.match(errors.mac_address, /between 6 and 12/);
  assert.equal(errors.c_number, undefined);
});

test("validateOrganisationAssetValidationPayload rejects invalid ranges", () => {
  const result = validateOrganisationAssetValidationPayload({
    serial_min_length: 10,
    serial_max_length: 8,
    mac_min_length: 12,
    mac_max_length: 12,
    c_number_min_length: 3,
    c_number_max_length: 10,
  });

  assert.equal(result.isValid, false);
  assert.match(result.errors.serial_max_length, /greater than or equal/);
});
