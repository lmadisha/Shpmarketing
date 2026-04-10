export type OrganisationAssetValidationRules = {
  organisation_id: number;
  serial_min_length: number;
  serial_max_length: number;
  mac_min_length: number;
  mac_max_length: number;
  c_number_min_length: number;
  c_number_max_length: number;
};

export const MAX_ORGANISATION_ASSET_VALIDATION_LENGTHS = {
  serial: 32,
  mac: 64,
  c_number: 32,
} as const;

export const DEFAULT_ORGANISATION_ASSET_VALIDATION_RULES: Omit<
  OrganisationAssetValidationRules,
  "organisation_id"
> = {
  serial_min_length: 12,
  serial_max_length: 12,
  mac_min_length: 12,
  mac_max_length: 12,
  c_number_min_length: 10,
  c_number_max_length: 10,
};

function normalizeHexIdentifier(value: string) {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function normalizeCNumber(value: string) {
  return String(value ?? "").trim().toUpperCase();
}

function buildLengthMessage(label: string, min: number, max: number) {
  return min === max
    ? `${label} must be exactly ${min} characters.`
    : `${label} must be between ${min} and ${max} characters.`;
}

function validateLengthRange(value: string, label: string, min: number, max: number) {
  if (!value) {
    return "";
  }
  if (value.length < min || value.length > max) {
    return buildLengthMessage(label, min, max);
  }
  return "";
}

export function validateAssetIdentifiers(
  values: {
    fridge_serial_number?: string;
    mac_address?: string;
    c_number?: string;
  },
  rules: Pick<
    OrganisationAssetValidationRules,
    | "serial_min_length"
    | "serial_max_length"
    | "mac_min_length"
    | "mac_max_length"
    | "c_number_min_length"
    | "c_number_max_length"
  >,
  options: { requireSerial?: boolean } = {},
) {
  const { requireSerial = false } = options;
  const errors: Record<string, string> = {};

  const serial = String(values.fridge_serial_number ?? "");
  const mac = String(values.mac_address ?? "");
  const cNumber = String(values.c_number ?? "");

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

export function validateOrganisationAssetValidationForm(payload: {
  serial_min_length: string;
  serial_max_length: string;
  mac_min_length: string;
  mac_max_length: string;
  c_number_min_length: string;
  c_number_max_length: string;
}) {
  const values = {
    serial_min_length: Number(payload.serial_min_length),
    serial_max_length: Number(payload.serial_max_length),
    mac_min_length: Number(payload.mac_min_length),
    mac_max_length: Number(payload.mac_max_length),
    c_number_min_length: Number(payload.c_number_min_length),
    c_number_max_length: Number(payload.c_number_max_length),
  };

  const errors: Record<string, string> = {};
  const fieldConfig = [
    ["serial_min_length", "Serial minimum length", MAX_ORGANISATION_ASSET_VALIDATION_LENGTHS.serial],
    ["serial_max_length", "Serial maximum length", MAX_ORGANISATION_ASSET_VALIDATION_LENGTHS.serial],
    ["mac_min_length", "MAC minimum length", MAX_ORGANISATION_ASSET_VALIDATION_LENGTHS.mac],
    ["mac_max_length", "MAC maximum length", MAX_ORGANISATION_ASSET_VALIDATION_LENGTHS.mac],
    ["c_number_min_length", "C-number minimum length", MAX_ORGANISATION_ASSET_VALIDATION_LENGTHS.c_number],
    ["c_number_max_length", "C-number maximum length", MAX_ORGANISATION_ASSET_VALIDATION_LENGTHS.c_number],
  ] as const;

  fieldConfig.forEach(([field, label, maxValue]) => {
    const numericValue = values[field];
    if (!Number.isInteger(numericValue) || numericValue <= 0) {
      errors[field] = `${label} must be a positive integer.`;
      return;
    }
    if (numericValue > maxValue) {
      errors[field] = `${label} cannot exceed ${maxValue}.`;
    }
  });

  if (values.serial_min_length > values.serial_max_length) {
    errors.serial_max_length = "Serial maximum length must be greater than or equal to the minimum length.";
  }
  if (values.mac_min_length > values.mac_max_length) {
    errors.mac_max_length = "MAC maximum length must be greater than or equal to the minimum length.";
  }
  if (values.c_number_min_length > values.c_number_max_length) {
    errors.c_number_max_length = "C-number maximum length must be greater than or equal to the minimum length.";
  }

  return {
    values,
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}
