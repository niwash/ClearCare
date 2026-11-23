// lib/alerts.ts
// The alert packages and subscriptions as the API holds them (ADR-0034, CCARE-270), and what the
// site's pages may ask their own routes for (CCARE-271). Pure: no fetch, no token, so the tests can
// load it and the API's documents are read the same way in the route handlers and in the pages.
//
// The package ids are the database's, not the site's: `alert_packages.id` comes from an identity
// column, so a database whose sequence has moved on numbers the packages differently from the
// seed's order. The site reads the ids from GET /alerts/packages and sends back the one it was
// given, keyed by scope. The counties are the other way round: db/V25 seeds them in the order
// lib/counties.ts lists them, so a county's id is its place in that list plus one, and
// tests/alerts.test.ts holds the two together.
import { COUNTIES } from "./counties.ts";

export type AlertScope = "CENTRE" | "COUNTY" | "ALL";

// The kinds of target the site offers. The page names one of these; the API names the scope.
export type AlertTargetKind = "centre" | "county" | "all";

export const SCOPE_OF: Record<AlertTargetKind, AlertScope> = {
  centre: "CENTRE",
  county: "COUNTY",
  all: "ALL",
};

export interface AlertPackage {
  id: number;
  title: string;
  description: string | null;
  scope: AlertScope;
}

// One target an account follows, as the API returns it. A centre row carries centreId and a null
// countyId; a county row carries the reverse; the all-reports row has both null.
export interface AlertSubscription {
  id: number;
  packageId: number;
  title: string;
  description: string | null;
  scope: AlertScope;
  centreId: string | null;
  countyId: number | null;
  createdAt: string;
}

// What the page asks its own route for. The package is the site's choice from the packages the API
// offered; the route resolves it to an id at request time.
export interface AlertRequest {
  kind: AlertTargetKind;
  centreId?: string;
  countyId?: number;
}

const SCOPES: AlertScope[] = ["CENTRE", "COUNTY", "ALL"];
// A Cognito subject is well under this; the API refuses anything longer, so does the route.
const MAX_CENTRE_ID = 32;
const MAX_TOKEN = 200;

function whole(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

// One package as the API hands it over, or null for anything else.
export function parsePackage(value: unknown): AlertPackage | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;

  const id = whole(row.id);
  const title = text(row.title, 200);
  const scope = SCOPES.find((each) => each === row.scope);
  if (id === null || !title || !scope) return null;

  return { id, title, description: text(row.description, 500), scope };
}

// The API's answer to GET /alerts/packages, without the rows it could not read.
export function parsePackages(value: unknown): AlertPackage[] {
  if (typeof value !== "object" || value === null) return [];
  const rows = (value as { packages?: unknown }).packages;
  if (!Array.isArray(rows)) return [];
  return rows.map(parsePackage).filter((row): row is AlertPackage => row !== null);
}

// The package the site offers for one kind of target, or null when the API lists none: a deployment
// with the package switched off has nothing to offer, and the page says so rather than guessing an
// id.
export function packageForKind(packages: AlertPackage[], kind: AlertTargetKind): AlertPackage | null {
  const scope = SCOPE_OF[kind];
  return packages.find((pack) => pack.scope === scope) ?? null;
}

// One subscription as the API hands it over, or null for anything else. A row the site cannot read
// is left out of a list rather than breaking the page: a subscription is a convenience.
export function parseSubscription(value: unknown): AlertSubscription | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;

  const id = whole(row.id);
  const packageId = whole(row.package_id);
  const scope = SCOPES.find((each) => each === row.scope);
  const title = text(row.title, 200);
  if (id === null || packageId === null || !scope || !title) return null;

  const centreId = row.centre_id === null || row.centre_id === undefined ? null : text(row.centre_id, MAX_CENTRE_ID);
  if (row.centre_id && centreId === null) return null;
  const countyId = row.county_id === null || row.county_id === undefined ? null : whole(row.county_id);

  // The scope decides which target is there; a CENTRE row with no centre is not a row the site
  // could render, so it is treated as unreadable.
  if (scope === "CENTRE" && !centreId) return null;
  if (scope === "COUNTY" && countyId === null) return null;

  return {
    id,
    packageId,
    title,
    description: text(row.description, 500),
    scope,
    centreId: scope === "CENTRE" ? centreId : null,
    countyId: scope === "COUNTY" ? countyId : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
  };
}

// The API's list answer, newest first, without the rows it could not read.
export function parseSubscriptions(value: unknown): AlertSubscription[] {
  if (typeof value !== "object" || value === null) return [];
  const rows = (value as { subscriptions?: unknown }).subscriptions;
  if (!Array.isArray(rows)) return [];
  return rows.map(parseSubscription).filter((row): row is AlertSubscription => row !== null);
}

// What the page asks the route for, checked here so a body cannot name a target the site never
// offers: a centre follow takes a centre id and no county, a county follow the reverse, and the
// every-report follow takes neither.
export function parseAlertRequest(value: unknown): AlertRequest | null {
  if (typeof value !== "object" || value === null) return null;
  const body = value as Record<string, unknown>;
  const kind = (Object.keys(SCOPE_OF) as AlertTargetKind[]).find((each) => each === body.scope);
  if (!kind) return null;

  if (kind === "centre") {
    const centreId = text(body.centre_id, MAX_CENTRE_ID);
    if (!centreId || !/^[0-9]+$/.test(centreId)) return null;
    return { kind, centreId };
  }

  if (kind === "county") {
    const countyId = whole(body.county_id);
    if (countyId === null || countyId > COUNTIES.length) return null;
    return { kind, countyId };
  }

  return { kind };
}

// The request as the API reads it, with its own field names and the package id the site was given.
export function alertRequestBody(packageId: number, request: AlertRequest): Record<string, string | number> {
  return {
    package_id: packageId,
    ...(request.centreId ? { centre_id: request.centreId } : {}),
    ...(request.countyId !== undefined ? { county_id: request.countyId } : {}),
  };
}

// The county a row names, or null. Its id is its place in the list plus one (db/V25).
export function countyName(countyId: number | null | undefined): string | null {
  if (typeof countyId !== "number" || !Number.isInteger(countyId)) return null;
  return COUNTIES[countyId - 1] ?? null;
}

export function countyId(name: string): number | null {
  const index = COUNTIES.indexOf(name);
  return index === -1 ? null : index + 1;
}

// The token in an unsubscribe link, or null. It is a capability, not personal data (ADR-0034), but
// only the characters the pipeline's token can hold are accepted, so it cannot be anything else.
export function unsubscribeToken(value: string | null | undefined): string | null {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate || candidate.length > MAX_TOKEN) return null;
  return /^[A-Za-z0-9_-]+$/.test(candidate) ? candidate : null;
}

// Whether this row is the one a centre page would have made.
export function followsCentre(subscription: AlertSubscription, centreId: string): boolean {
  return subscription.scope === "CENTRE" && subscription.centreId === centreId;
}

// Whether this row is the one a county search would have made.
export function followsCounty(subscription: AlertSubscription, id: number): boolean {
  return subscription.scope === "COUNTY" && subscription.countyId === id;
}
