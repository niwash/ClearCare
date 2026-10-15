"use client";

import Image from "next/image";
import { useRef } from "react";

type ImageViewerProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

// An image that opens full size in a dialog on the same page. Esc, the Close button or a click
// outside the image closes it. Wide images can be scrolled inside the dialog on small screens.
export function ImageViewer({ src, alt, width, height }: ImageViewerProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="block w-full cursor-zoom-in overflow-hidden rounded-lg border border-line bg-white"
      >
        <Image src={src} alt={alt} width={width} height={height} sizes="(min-width: 1280px) 1200px, 100vw" priority className="h-auto w-full" />
        <span className="sr-only">Open full size</span>
      </button>

      <dialog
        ref={dialog}
        aria-label={alt}
        // A click on the backdrop lands on the dialog itself, not on its contents.
        onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/80"
      >
        <div className="flex h-full flex-col">
          <div className="flex justify-end p-3">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              autoFocus
              className="flex min-h-11 items-center gap-2 rounded-md bg-surface px-4 font-semibold text-ink"
            >
              Close
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" className="size-5">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div
            onClick={(event) => event.target === event.currentTarget && dialog.current?.close()}
            className="min-h-0 flex-1 overflow-auto px-3 pb-3"
          >
            {/* Full width on large screens; at least 1200px wide so small screens scroll instead of shrinking it. */}
            <Image src={src} alt="" width={width} height={height} sizes="100vw" className="mx-auto h-auto w-full min-w-[1200px] max-w-[2000px] rounded-md bg-white" />
          </div>
        </div>
      </dialog>
    </>
  );
}
