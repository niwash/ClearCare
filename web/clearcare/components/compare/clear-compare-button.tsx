"use client";

// "Clear the list" on Compare Homes (CCARE-127): takes every saved home off. Shown only while
// there are homes to clear.
import { useState } from "react";
import { clearCompared, useComparedHomes } from "./compare-store";

export function ClearCompareButton({ className }: { className: string }) {
  const homes = useComparedHomes();
  const [status, setStatus] = useState("");

  return (
    <>
      {homes && homes.length > 0 && (
        <button
          type="button"
          onClick={() => {
            clearCompared();
            setStatus("Your list is cleared.");
          }}
          className={className}
        >
          Clear the list
        </button>
      )}
      <span role="status" className="sr-only">
        {status}
      </span>
    </>
  );
}
