// The origin the browser used, from the headers a proxy sets. Behind the load balancer the server
// is asked for its own address and answers with the container's (0.0.0.0:3000 in the image), so
// anything built from that address is wrong for a URL the identity provider has to match.
//
// X-Forwarded-* win because they are what the browser actually typed; Host is the fallback for a
// direct request, and localhost is the only place http is assumed.

type IncomingHeaders = {
  "x-forwarded-host"?: string | null;
  "x-forwarded-proto"?: string | null;
  host?: string | null;
};

const first = (value: string | null | undefined): string | undefined =>
  value?.split(",")[0]?.trim() || undefined;

export function originFrom(headers: IncomingHeaders): string {
  const host = first(headers["x-forwarded-host"]) ?? first(headers.host) ?? "localhost:3000";
  const proto =
    first(headers["x-forwarded-proto"]) ??
    (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) ? "http" : "https");

  return `${proto}://${host}`;
}
