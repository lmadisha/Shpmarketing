export function normalizeHexIdentifier(value: string) {
  return (value || "").replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

export function normalizeCNumber(value: string) {
  return (value || "").trim().toUpperCase();
}

// Legacy aliases kept to avoid rewriting unused pages that still import these names.
export const cleanHex12 = normalizeHexIdentifier;
export const cleanCNumber = normalizeCNumber;

function escapeSpreadsheetValue(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeWorksheetName(sheetName: string) {
  const sanitized = sheetName.replace(/:|\\|\/|\?|\*|\[|\]/g, "").trim();
  return (sanitized || "Sheet1").slice(0, 31);
}

function toSpreadsheetRow(values: Array<unknown>, styleId?: string) {
  return `<Row>${values.map((value) => {
    const styleAttribute = styleId ? ` ss:StyleID="${styleId}"` : "";
    return `<Cell${styleAttribute}><Data ss:Type="String">${escapeSpreadsheetValue(value)}</Data></Cell>`;
  }).join("")}</Row>`;
}

export function downloadExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: Array<Array<unknown>>,
) {
  const safeSheetName = sanitizeWorksheetName(sheetName);
  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${escapeSpreadsheetValue(safeSheetName)}">
  <Table>
   ${toSpreadsheetRow(headers, "Header")}
   ${rows.map((row) => toSpreadsheetRow(row)).join("\n   ")}
  </Table>
 </Worksheet>
</Workbook>`;
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8;" });
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
