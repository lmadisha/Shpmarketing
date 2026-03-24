export function cleanHex12(value: string) {
  return (value || "").replace(/[^a-fA-F0-9]/g, "").toUpperCase().slice(0, 12);
}

export function cleanCNumber(value: string) {
  return (value || "").trim().toUpperCase().slice(0, 10);
}

export function toCsvValue(value: unknown) {
  const raw = value == null ? "" : String(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const lines = [
    headers.map(toCsvValue).join(","),
    ...rows.map((row) => row.map(toCsvValue).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function compareValues(left: unknown, right: unknown) {
  const a = left ?? "";
  const b = right ?? "";

  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b);
  }

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  const aDate = Date.parse(String(a));
  const bDate = Date.parse(String(b));
  if (!Number.isNaN(aDate) && !Number.isNaN(bDate)) {
    return aDate - bDate;
  }

  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

export function summarizeRequestBody(body?: BodyInit | null) {
  if (!body) return null;

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }

  if (body instanceof FormData) {
    return Array.from(body.entries()).map(([key, value]) => ({
      field: key,
      value:
        value instanceof File
          ? { fileName: value.name, size: value.size, type: value.type || "application/octet-stream" }
          : String(value),
    }));
  }

  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  if (body instanceof Blob) {
    return { size: body.size, type: body.type || "application/octet-stream" };
  }

  return String(body);
}

export function summarizeResponsePayload(payload: unknown) {
  if (Array.isArray(payload)) {
    return { type: "array", count: payload.length };
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const summary: Record<string, unknown> = {
      type: "object",
      keys: Object.keys(record),
    };

    if ("summary" in record) summary.summary = record.summary;
    if ("message" in record) summary.message = record.message;
    if ("error" in record) summary.error = record.error;
    if ("ok" in record) summary.ok = record.ok;

    return summary;
  }

  return payload;
}
