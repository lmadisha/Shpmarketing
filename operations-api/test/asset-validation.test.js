const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeHexIdentifier,
  normalizeCNumber,
  parseLocationCoordinates,
  toNullableAssetIdentifier,
  validateAssetIdentifiers,
  validateOrganisationAssetValidationPayload,
} = require("../asset-validation");

test("normalizeHexIdentifier strips non-hex characters and uppercases", () => {
  assert.equal(normalizeHexIdentifier("aa-bb cc"), "AABBCC");
});

test("normalizeCNumber trims and uppercases", () => {
  assert.equal(normalizeCNumber(" c10x "), "C10X");
});

test("toNullableAssetIdentifier converts blank optional identifiers to null", () => {
  assert.equal(toNullableAssetIdentifier(undefined), null);
  assert.equal(toNullableAssetIdentifier(null), null);
  assert.equal(toNullableAssetIdentifier(""), null);
  assert.equal(toNullableAssetIdentifier("   "), null);
  assert.equal(toNullableAssetIdentifier(" AA11 "), "AA11");
});

test("normalized optional identifiers can be safely prepared for nullable persistence", () => {
  const mac = normalizeHexIdentifier("");
  const cNumber = normalizeCNumber("");

  assert.equal(toNullableAssetIdentifier(mac), null);
  assert.equal(toNullableAssetIdentifier(cNumber), null);
  assert.equal(toNullableAssetIdentifier(normalizeHexIdentifier("aa-bb-cc")), "AABBCC");
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

test("validateAssetIdentifiers still allows blank optional MAC and C-number values", () => {
  const errors = validateAssetIdentifiers(
    {
      fridge_serial_number: "ABCDEFGHIJKL",
      mac_address: "",
      c_number: "",
    },
    {
      serial_min_length: 12,
      serial_max_length: 12,
      mac_min_length: 12,
      mac_max_length: 12,
      c_number_min_length: 10,
      c_number_max_length: 10,
    },
    { requireSerial: true },
  );

  assert.deepEqual(errors, {});
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

test("parseLocationCoordinates accepts valid latitude and longitude", () => {
  const result = parseLocationCoordinates({
    latitude: "-25.7461111",
    longitude: 28.1880567,
  });

  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, {});
  assert.equal(result.values.latitude, -25.746111);
  assert.equal(result.values.longitude, 28.188057);
});

test("parseLocationCoordinates rejects partial coordinate pairs", () => {
  const result = parseLocationCoordinates({
    latitude: "-25.7",
  });

  assert.equal(result.isValid, false);
  assert.match(result.errors.longitude, /required when latitude is provided/);
});

test("parseLocationCoordinates rejects out-of-range coordinates", () => {
  const result = parseLocationCoordinates({
    latitude: "-91",
    longitude: "181",
  });

  assert.equal(result.isValid, false);
  assert.match(result.errors.latitude, /between -90 and 90/);
  assert.match(result.errors.longitude, /between -180 and 180/);
});
