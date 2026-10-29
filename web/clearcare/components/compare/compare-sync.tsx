"use client";

// Keeps /compare's address in step with the saved list (CCARE-127), so the server draws the homes
// the user has saved: when the list changes, such as a home removed here or in another tab, the
// address follows. Opened from a shared address with nothing saved, the page keeps that address's
// homes instead, and saves them, including any it couldn't load just now.
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { compareHref, type ComparedHome } from "@/lib/compare";
import { replaceCompared, useComparedHomes } from "./compare-store";

export function CompareSync({
  shownIds,
  shownHomes,
  loadedNames,
}: {
  shownIds: string[];
  shownHomes: ComparedHome[];
  // The register's name for each home that loaded, by ID.
  loadedNames: Record<string, string>;
}) {
  const homes = useComparedHomes();
  const router = useRouter();
  // Only on the first look at the saved list, or removing the last home would bring them all back.
  const checked = useRef(false);

  useEffect(() => {
    if (homes === null) return;
    if (!checked.current) {
      checked.current = true;
      if (homes.length === 0 && shownHomes.length > 0) {
        replaceCompared(shownHomes);
        return;
      }
    }
    // A home saved while it couldn't be loaded has a stand-in name until the page loads it.
    if (homes.some((home) => loadedNames[home.id] && loadedNames[home.id] !== home.name)) {
      replaceCompared(homes.map((home) => ({ ...home, name: loadedNames[home.id] ?? home.name })));
      return;
    }
    const ids = homes.map((home) => home.id);
    if (ids.join(",") !== shownIds.join(",")) router.replace(compareHref(ids), { scroll: false });
  }, [homes, shownIds, shownHomes, loadedNames, router]);

  return null;
}
