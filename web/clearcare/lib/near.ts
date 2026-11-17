// lib/near.ts
// The point a search measures distances from (CCARE-228): near=<lat>,<lng> in the page address and
// in GET /centres, and how far a home is from it. A point is rounded to two decimals, about 1 km,
// before it goes anywhere: the API refuses more (api/openapi.yaml), and the privacy notice promises
// that nothing finer leaves the page. No imports, so the tests load this file as it is.

// Degrees with an optional fraction: no exponents, hex or Infinity, which Number() would also read.
const DEGREES = /^-?\d{1,3}(\.\d+)?$/;

function rounded(degrees: number) {
  return Math.round(degrees * 100) / 100;
}

// A latitude and a longitude as near takes them: "53.35,-6.26", or "" when they are not a point.
export function nearFrom(latitude: number, longitude: number) {
  const lat = rounded(latitude);
  const lng = rounded(longitude);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? `${lat},${lng}` : "";
}

// The point near holds in the page address, rounded, or "" for anything else, as an unknown order is
// dropped: a hand-edited link never sends the API a finer point, or one it would refuse.
export function readNear(text: string) {
  const parts = text.split(",").map((part) => part.trim());
  if (parts.length !== 2 || !parts.every((part) => DEGREES.test(part))) return "";
  return nearFrom(Number(parts[0]), Number(parts[1]));
}

// How far a home is, for its card: whole kilometres only, because the point is only good to about
// 1 km. null when there is no distance: no point was given, ClearCare has no location for the home,
// or the API is older than CCARE-226 and leaves the field out.
export function distanceText(metres: number | null | undefined) {
  if (typeof metres !== "number") return null;
  if (metres < 1000) return "Less than 1 km away (straight line)";
  return `About ${Math.round(metres / 1000)} km away (straight line)`;
}
