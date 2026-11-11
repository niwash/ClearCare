"use client";

// components/preferences/save-preferences-button.tsx
// "Save my preferences", under the Search button in the filters panel (ADR-0025): the choices are
// made here, so this is where they are kept — and, now that nothing sits above the results, this is
// also where a visitor hears how it went.
//
// It is in place for every signed-in visitor and disabled until there is something worth keeping,
// so the option is visible before it can be used, and it goes back to disabled as soon as the form
// is emptied. It is a type="button": it sits inside the search form, and pressing it must save
// rather than run a search.
//
// The save is answered in the button itself — "Saved" for a few seconds, where the visitor is
// already looking, with the same words announced in a live region — and the way out ("Forget my
// preferences") is beside it.
//
// On a phone the sheet closes as the save is applied, which takes the button with it, so the same
// confirmation is also given by PreferencesNotice, outside the sheet and hidden from md up.
import { useEffect, useState } from "react";

import { hasSavedChoices, type SavedSearch } from "@/lib/preferences";

import { forgetPreferences, savePreferences, useSavedSearch } from "./saved-search-store";

// How long "Saved" stays before the button offers to save again.
const SAVED_FOR = 3000;

export function SavePreferencesButton({
  current,
  onSaved,
  onForgotten,
}: {
  current: SavedSearch; // the choices on screen, saved or not
  onSaved?: () => void; // what to do once they are stored: the panel applies them
  onForgotten?: () => void; // what to do once they are gone: the panel empties the page
}) {
  const { status, saved, error, busy } = useSavedSearch();
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), SAVED_FOR);
    return () => clearTimeout(timer);
  }, [justSaved]);

  // Signed out, or a deployment with no saved searches: nothing to offer.
  if (status !== "ready") return null;

  const canSave = hasSavedChoices(current);

  return (
    <div className="flex w-full flex-col items-center gap-1">
      <button
        type="button"
        onClick={async () => {
          const stored = await savePreferences(current, onSaved);
          if (stored) setJustSaved(true);
        }}
        disabled={busy || !canSave}
        className={`min-h-11 w-full rounded-full border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:border-line disabled:text-ink-faint adult:rounded-md ${
          justSaved
            ? "border-primary bg-primary text-on-primary"
            : "border-primary bg-surface text-ink enabled:hover:bg-surface-muted"
        }`}
      >
        {justSaved ? "Saved" : "Save my preferences"}
      </button>

      {/* The same answer for a screen reader, which does not see the label change. */}
      <span role="status" className="sr-only">
        {justSaved ? "Preferences saved" : ""}
      </span>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {saved && (
        <button
          type="button"
          onClick={async () => {
            const gone = await forgetPreferences();
            if (gone) onForgotten?.();
          }}
          disabled={busy}
          className="min-h-11 px-2 text-sm text-ink-muted underline hover:text-ink disabled:opacity-50"
        >
          Forget my preferences
        </button>
      )}
    </div>
  );
}
