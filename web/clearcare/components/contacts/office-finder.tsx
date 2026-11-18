"use client";

// components/contacts/office-finder.tsx
// Find your local Nursing Homes Support Office by county (CCARE-258). It replaces a list of
// seventeen closed rows named after the HSE's areas: a family knows their county, and only needs
// their own office's address and numbers.
import { useState, type ReactNode } from "react";
import { Chevron } from "@/components/ui/chevron";
import { ExternalIcon } from "@/components/ui/external-icon";
import { Icon } from "@/components/ui/icons";
import { textInputClass } from "@/components/ui/classes";
import { COUNTIES } from "@/lib/counties";
import { FAIR_DEAL_CONTACT_URL, SPLIT_COUNTY_NOTE, officesForCounty, type SupportOffice } from "@/lib/support-offices";
import { PhoneLine } from "./phone-line";

// children: the heading and intro. Then, top to bottom: what the office does, the county list, and
// the chosen county's office under it.
export function OfficeFinder({ children }: { children: ReactNode }) {
  const [county, setCounty] = useState("");
  const offices = officesForCounty(county);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">{children}</div>
        <OfficeDoes />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="office-county" className="font-semibold">
            Your county
          </label>
          {/* The site's own arrow, as the search page's county list (search-filters.tsx). */}
          <span className="relative inline-flex w-full max-w-xs text-ink">
            <select
              id="office-county"
              value={county}
              onChange={(event) => setCounty(event.target.value)}
              className={`${textInputClass} w-full appearance-none pr-9`}
            >
              <option value="">Choose a county</option>
              {COUNTIES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <Chevron className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 rotate-90" />
          </span>
        </div>
        <p className="text-xs text-ink-muted">
          Source:{" "}
          <a
            href={FAIR_DEAL_CONTACT_URL}
            className="inline-flex items-center gap-1 text-ink-muted adult:text-primary [&_svg]:size-3"
            target="_blank"
            rel="noopener noreferrer"
          >
            HSE Fair Deal contacts
            <span className="sr-only"> (opens in a new tab)</span>
            <ExternalIcon />
          </a>
          , checked 13 Nov 2026.
        </p>
      </div>

      {/* Announced when it changes, so a screen reader hears the office without hunting for it. A
          split county's two offices side by side. Nothing until a county is chosen. */}
      <div aria-live="polite" className="flex flex-col gap-3 empty:hidden">
        {county && SPLIT_COUNTY_NOTE[county] && <p className="text-sm text-ink-muted">{SPLIT_COUNTY_NOTE[county]}</p>}
        {offices.length > 0 && (
          <div className={`grid gap-3 ${offices.length > 1 ? "md:grid-cols-2" : "max-w-xl"}`}>
            {offices.map((office) => (
              <OfficeCard key={office.area} office={office} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// What the local office does with an application, from the HSE's Fair Deal guidance.
const OFFICE_DOES = [
  "Receives and processes your Fair Deal application",
  "Carries out the financial assessment, which works out what you'll pay",
  "Answers questions about where your application is",
];

function OfficeDoes() {
  return (
    // Just the list, with no heading of its own. A screen reader hears what it's a list of.
    <ul aria-label="Your local office" className="flex flex-col gap-1.5 text-sm text-ink-muted">
      {OFFICE_DOES.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function OfficeCard({ office }: { office: SupportOffice }) {
  const who = `the ${office.area} office`;
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-page p-4 adult:rounded-md">
      <h4 className="font-semibold">{office.area} Nursing Homes Support Office</h4>
      {office.address && (
        <address className="text-sm not-italic text-ink-muted">
          {office.address.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
      )}
      {office.hours && <p className="text-sm text-ink-muted">{office.hours}</p>}
      <div className="flex flex-col gap-2">
        {office.phones.map((phone) => (
          <PhoneLine key={phone} phone={phone} who={who} />
        ))}
      </div>
      {office.email && (
        <p className="flex items-center gap-2 text-sm">
          <Icon name="email" className="size-4 shrink-0 text-primary" />
          <span className="sr-only">Email: </span>
          <a href={`mailto:${office.email}`} className="wrap-anywhere">
            {office.email}
          </a>
        </p>
      )}
    </article>
  );
}
