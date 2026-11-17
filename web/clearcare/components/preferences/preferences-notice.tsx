"use client";

// components/preferences/preferences-notice.tsx
// On a phone, the confirmation that the search was kept. Saving applies the search and closes the
// sheet, so the button that says "Saved" is gone by the time it would say it; this is the same
// answer, given where the visitor is now looking. Desktop keeps reading it in the button, so this
// is hidden from md up.
//
// Like the shortlist's toast (components/compare/shortlist-toast.tsx): a few seconds at the bottom
// of the screen, above the floating menu button, with the status region always there so a screen
// reader reads it when it appears.
import { useEffect, useState } from "react";

import { onSavedPreferences } from "./saved-search-store";

// How long the confirmation stays, the same as the button's.
const SHOWN_FOR = 3000;

export function PreferencesNotice() {
  const [shown, setShown] = useState(0);

  useEffect(() => onSavedPreferences(() => setShown(Date.now())), []);
  useEffect(() => {
    if (!shown) return;
    const timer = setTimeout(() => setShown(0), SHOWN_FOR);
    return () => clearTimeout(timer);
  }, [shown]);

  return (
    // pointer-events-none: the confirmation sits over the results for three seconds and must not
    // swallow a tap meant for what is under it.
    <div role="status" className="pointer-events-none fixed inset-x-3 bottom-24 z-40 md:hidden">
      {shown > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-page shadow-xl adult:rounded-lg">
          <span className="flex-1 text-sm leading-snug">Preferences saved</span>
        </div>
      )}
    </div>
  );
}
