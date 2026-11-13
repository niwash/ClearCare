"use client";
// components/layout/cursor-highlight.tsx
// A soft halo around the mouse pointer in the adult-centred design ("Easier to read"), so a small
// pointer is easier to find on a large screen (CCARE-232). Only with a mouse or trackpad (a fine
// pointer that can hover): a touch screen has no pointer to lose. It never takes a click (pointer-
// events: none), shows nothing until the mouse moves, hides when it leaves the window, and is
// hidden from screen readers and on paper. With reduced motion it moves with the pointer but never
// animates its size.
import { useEffect, useRef, useState } from "react";

const MOUSE = "(hover: hover) and (pointer: fine)";

function adultDesign() {
  return document.documentElement.getAttribute("data-design") === "adult-centred";
}

export function CursorHighlight() {
  const [on, setOn] = useState(false);
  const halo = useRef<HTMLDivElement>(null);

  // On when Easier to read is chosen and there is a mouse; the toggle changes data-design without a
  // reload, and a laptop can gain or lose a mouse, so both are watched.
  useEffect(() => {
    const mouse = window.matchMedia(MOUSE);
    const update = () => setOn(adultDesign() && mouse.matches);
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-design"] });
    mouse.addEventListener("change", update);
    return () => {
      observer.disconnect();
      mouse.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!on) return;
    const element = halo.current;
    if (!element) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    // One move a frame, however often the mouse reports.
    const draw = () => {
      frame = 0;
      element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      x = event.clientX;
      y = event.clientY;
      element.dataset.shown = "";
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const leave = () => delete element.dataset.shown;
    const press = () => (element.dataset.pressed = "");
    const release = () => delete element.dataset.pressed;
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("blur", leave);
    window.addEventListener("pointerdown", press);
    window.addEventListener("pointerup", release);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("blur", leave);
      window.removeEventListener("pointerdown", press);
      window.removeEventListener("pointerup", release);
    };
  }, [on]);

  if (!on) return null;
  // The outer box follows the pointer; the inner circle is centred on it and shrinks a little while
  // the button is held, to show the click landed. Yellow inside a dark ring, so it shows on light
  // and dark pages alike, translucent so what is under it can still be read.
  return (
    <div
      ref={halo}
      aria-hidden
      className="group/halo pointer-events-none fixed top-0 left-0 z-[100] hidden opacity-0 data-[shown]:opacity-100 print:hidden [@media(hover:hover)_and_(pointer:fine)]:block"
    >
      <div className="-mt-6 -ml-6 size-12 rounded-full border-2 border-ink/70 bg-yellow-300/35 shadow-[0_0_0_2px_rgb(255_255_255/0.6)] transition-transform duration-100 group-data-[pressed]/halo:scale-75 motion-reduce:transition-none" />
    </div>
  );
}
