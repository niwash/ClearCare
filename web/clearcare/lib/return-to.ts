// A visitor who signs in must come back to the page they started on, so the path is carried in
// the URL. It arrives from the browser, so it is treated as untrusted: only a path on this site
// survives, and anything else falls back to the home page.
export const DEFAULT_RETURN_TO = "/";

// Parsed against a placeholder origin. Anything that keeps another origin, or that normalises into
// a protocol-relative path, was not a path on this site; a backslash or a control character lands
// in one of those two cases, so neither needs a check of its own.
const PLACEHOLDER_ORIGIN = "https://clearcare.invalid";

// A control character changes what the browser reads at the redirect without changing what a
// reader sees, so the value is refused rather than quietly rewritten.
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

export function safeReturnPath(value: string | null | undefined): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate.startsWith("/")) return DEFAULT_RETURN_TO;
  if (CONTROL_CHARACTERS.test(candidate)) return DEFAULT_RETURN_TO;

  let parsed: URL;
  try {
    parsed = new URL(candidate, PLACEHOLDER_ORIGIN);
  } catch {
    return DEFAULT_RETURN_TO;
  }

  if (parsed.origin !== PLACEHOLDER_ORIGIN) return DEFAULT_RETURN_TO;

  // "/a/..//evil.example" resolves to "//evil.example", which a browser reads as another host.
  if (parsed.pathname.startsWith("//")) return DEFAULT_RETURN_TO;

  // Returning into the authentication routes would re-enter the callback loop.
  if (parsed.pathname.startsWith("/api/auth")) return DEFAULT_RETURN_TO;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
