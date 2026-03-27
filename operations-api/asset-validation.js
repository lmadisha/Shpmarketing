const MAX_ORGANISATION_ASSET_VALIDATION_LENGTHS = Object.freeze({
  serial: 32,
  mac: 64,
  c_number: 32,
});

const DEFAULT_ORGANISATION_ASSET_VALIDATION_RULES = Object.freeze({
  serial_min_length: 12,
  serial_max_length: 12,
  mac_min_length: 12,
  mac_max_length: 12,
  c_number_min_length: 10,
  c_number_max_length: 10,
});

function normalizeHexIdentifier(value) {
  return String(value ?? "")
    .replace(/[^a-fA-F0-9]/g, "")
    .toUpperCase();
}

function normalizeCNumber(value) {
  return String(value ?? "").trim().toUpperCase();
}

function buildLengthMessage(label, min, max) {
  return min === max
    ? `${label} must be exactly ${min} characters.`
    : `${label} must be between ${min} and ${max} characters.`;
}

function validateLengthRange(value, label, min, max) {
  if (!value) {
    return null;
  }
  if (value.length < min || value.length > max) {
    return buildLengthMessage(label, min, max);
  }
  return null;
}

function validateAssetIdentifiers(values, rules, options = {}) {
  const { requireSerial = false } = options;
  const errors = {};

  const serial = String(values?.fridge_serial_number ?? "");
  const mac = String(values?.mac_address ?? "");
  const cNumber = String(values?.c_number ?? "");

  if (requireSerial && !serial) {
    errors.fridge_serial_number = "Serial number is required.";
  } else {
    const serialError = validateLengthRange(
      serial,
      "Serial number",
      rules.serial_min_length,
      rules.serial_max_length,
    );
    if (serialError) {
      errors.fridge_serial_number = serialError;
    }
  }

  const macError = validateLengthRange(
    mac,
    "MAC address",
    rules.mac_min_length,
    rules.mac_max_length,
  );
  if (macError) {
    errors.mac_address = macError;
  }

  const cNumberError = validateLengthRange(
    cNumber,
    "C-number",
    rules.c_number_min_length,
    rules.c_number_max_length,
  );
  if (cNumberError) {
    errors.c_number = cNumberError;
  }

  return errors;
}

function parsePositiveInteger(value) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  const parsed = Number(String(value ?? "").trim());
  return Number.isInteger(parsed) ? parsed : null;
}

function validateOrganisationAssetValidationPayload(payload) {
  const values = {
    serial_min_length: parsePositiveInteger(payload?.serial_min_length),
    serial_max_length: parsePositiveInteger(payload?.serial_max_length),
    mac_min_length: parsePositiveInteger(payload?.mac_min_length),
    mac_max_length: parsePositiveInteger(payload?.mac_max_length),
    c_number_min_length: parsePositiveInteger(payload?.c_number_min_length),
    c_number_max_length: parsePositiveInteger(payload?.c_number_max_length),
  };

  const errors = {};

  const fieldConfig = [
    ["serial_min_length", "Serial minimum length", MAX_ORGANISATION_ASSET_VALIDATION_LENGTHS.serial],
    ["serial_max_length", "Serial maximum length", MAX_ORGANISATION_ASSET_VALIDATION_LENGTHS.serial],
    ["mac_min_length", "MAC minimum length", MAX_ORGANISATION_ASSET_VALIDATION_LENGTHS.mac],
    ["mac_max_length", "MAC maximum length", MAX_ORGANISATION_ASSET_VALIDATION_LENGTHS.mac],
    ["c_number_min_length", "C-number minimum length", MAX_ORGANISATION_ASSET_VALIDATION_LENGTHS.c_number],
    ["c_number_max_length", "C-number maximum length", MAX_ORGANISATION_ASSET_VALIDATION_LENGTHS.c_number],
  ];

  fieldConfig.forEach(([field, label, maxValue]) => {
    const numericValue = values[field];
    if (numericValue == null || numericValue <= 0) {
      errors[field] = `${label} must be a positive integer.`;
      return;
    }
    if (numericValue > maxValue) {
      errors[field] = `${label} cannot exceed ${maxValue}.`;
    }
  });

  if (
    values.serial_min_length != null &&
    values.serial_max_length != null &&
    values.serial_min_length > values.serial_max_length
  ) {
    errors.serial_max_length = "Serial maximum length must be greater than or equal to the minimum length.";
  }

  if (
    values.mac_min_length != null &&
    values.mac_max_length != null &&
    values.mac_min_length > values.mac_max_length
  ) {
    errors.mac_max_length = "MAC maximum length must be greater than or equal to the minimum length.";
  }

  if (
    values.c_number_min_length != null &&
    values.c_number_max_length != null &&
    values.c_number_min_length > values.c_number_max_length
  ) {
    errors.c_number_max_length = "C-number maximum length must be greater than or equal to the minimum length.";
  }

  return {
    values,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}

module.exports = {
  DEFAULT_ORGANISATION_ASSET_VALIDATION_RULES,
  MAX_ORGANISATION_ASSET_VALIDATION_LENGTHS,
  normalizeHexIdentifier,
  normalizeCNumber,
  validateAssetIdentifiers,
  validateOrganisationAssetValidationPayload,
};
