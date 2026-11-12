"use client";

// components/search/homes-near-me.tsx
// "Homes near me", among the ways to start before anything is searched (CCARE-230,
// app/(site)/search/page.tsx): what "Use my location" under the search box does, searched at once.
// That button changes the bar's draft, which waits for Search; here there is nothing else to choose
// first.
import { Icon } from "@/components/ui/icons";
import { searchHref, type PageSearch } from "@/lib/page-search";
import { usedLocation } from "@/lib/search-box";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { askLocation, LOCATION_MESSAGES, useScripted, type LocationState } from "./search-box";

export function HomesNearMe({ search }: { search: PageSearch }) {
  const router = useRouter();
  const scripted = useScripted();
  const [location, setLocation] = useState<LocationState>("idle");
  const button = useRef<HTMLButtonElement>(null);
  // Moved on by each press: only the latest request's answer counts.
  const locating = useRef(0);

  function locate() {
    const attempt = ++locating.current;
    // button is null once the page was left.
    const wanted = () => attempt === locating.current && button.current !== null;
    askLocation(wanted, setLocation, (near) => {
      // Said until the results take the page's place.
      setLocation("waiting");
      router.push(searchHref(usedLocation(search, near)));
    });
  }

  return (
    <div className="flex flex-col gap-1">
      {/* The browser is asked by a script, so the button is there only once scripts run. */}
      {scripted && (
        <button
          ref={button}
          type="button"
          onClick={locate}
          className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl border border-primary bg-tint-blue px-4 font-semibold text-on-tint-blue hover:bg-surface adult:rounded-lg"
        >
          <Icon name="location" className="size-5" />
          Homes near me
        </button>
      )}
      {/* Always there, and empty when there is nothing to say, so what appears in it is announced. */}
      <p aria-live="polite" className="text-sm text-ink-muted">
        {LOCATION_MESSAGES[location]}
      </p>
    </div>
  );
}
