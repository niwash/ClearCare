// lib/csv.ts
// The CSV downloads: comma-separated, CRLF line ends, a field quoted only when it needs to be.

function csvField(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows: (string | number)[][]) {
  // The byte order mark tells Excel the file is UTF-8, so names like "Áras" show correctly.
  return "﻿" + rows.map((fields) => fields.map(csvField).join(",")).join("\r\n");
}
