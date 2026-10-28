// A visitor who signs in must come back to the page they started on, so the path is carried in
// the URL. It arrives from the browser, so it is treated as untrusted: only a path on this site
// survives, and anything else falls back to the home page.
export const DEFAULT_RETURN_TO = "/";

// Control characters hide a second value from a reader but not from the redirect, and a backslash
// is read as a forward slash by some browsers, so both are refused outright.
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

export function safeReturnPath(value: string | null | undefined): string {
  if (typeof value !== "string") return DEFAULT_RETURN_TO;

  const candidate = value.trim();
  if (candidate === "") return DEFAULT_RETURN_TO;

  // "/page" is internal; "//host" is another site, and "https://host" is absolute.
  if (!candidate.startsWith("/")) return DEFAULT_RETURN_TO;
  if (candidate.startsWith("//")) return DEFAULT_RETURN_TO;
  if (candidate.includes("\\")) return DEFAULT_RETURN_TO;
  if (CONTROL_CHARACTERS.test(candidate)) return DEFAULT_RETURN_TO;

  let parsed: URL;
  try {
    parsed = new URL(candidate, "https://clearcare.invalid");
  } catch {
    return DEFAULT_RETURN_TO;
  }

  // Anything that resolved away from the placeholder origin was not a path.
  if (parsed.origin !== "https://clearcare.invalid") return DEFAULT_RETURN_TO;

  // Returning into the authentication routes would re-enter the callback loop.
  if (parsed.pathname.startsWith("/api/auth")) return DEFAULT_RETURN_TO;

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
