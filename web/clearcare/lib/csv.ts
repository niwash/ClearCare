// lib/csv.ts
// The CSV downloads (RFC 4180): commas, quotes and line breaks quoted, lines ended with CRLF.

function csvField(value: string | number) {
  // Text a spreadsheet would run as a formula (=, +, -, @) starts with an apostrophe instead, as the
  // homes' names and details come from outside. Numbers are left as they are, so -3 stays a number.
  const text = typeof value === "string" && /^[=+\-@\t\r]/.test(value) ? `'${value}` : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(rows: (string | number)[][]) {
  // The byte order mark tells Excel the file is UTF-8, so the € and names like "Áras" show correctly.
  return "﻿" + rows.map((fields) => fields.map(csvField).join(",")).join("\r\n") + "\r\n";
}
