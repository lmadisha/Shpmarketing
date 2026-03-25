export type SerialLookupRow = {
  fridge_serial_number: string;
};

export function normalizeSerialCandidate(value: string) {
  return String(value || "").trim().toUpperCase();
}

export function findExactSerialMatch(
  candidate: string,
  rows: readonly SerialLookupRow[],
) {
  const normalizedCandidate = normalizeSerialCandidate(candidate);
  if (!normalizedCandidate) {
    return null;
  }

  const matched = rows.find(
    (row) => normalizeSerialCandidate(row.fridge_serial_number) === normalizedCandidate,
  );

  return matched ? normalizeSerialCandidate(matched.fridge_serial_number) : null;
}
