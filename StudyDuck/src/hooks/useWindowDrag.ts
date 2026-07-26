import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";

const appWindow = getCurrentWindow();

/** How far the pointer may travel (CSS px) before a press stops being a click. */
const CLICK_SLOP = 5;

type DragOrigin = {
  pointerX: number;
  pointerY: number;
  windowX: number;
  windowY: number;
};

type PointerHandler = (event: ReactPointerEvent<HTMLElement>) => void;

export type WindowDragHandlers = {
  onPointerDown: PointerHandler;
  onPointerMove: PointerHandler;
  onPointerUp: PointerHandler;
  onPointerCancel: PointerHandler;
};

export type WindowDrag = {
  /** True from press until release, whether or not the pointer moved. */
  held: boolean;
  handlers: WindowDragHandlers;
};

/**
 * Drags the OS window by an element, and reports a plain click when the pointer
 * never travelled past CLICK_SLOP.
 *
 * Tauri's own startDragging() hands the drag to the OS, which swallows the
 * release event -- so it can tell you a drag began but never that it ended, and
 * cannot separate a click from a drag at all. Hence the manual implementation.
 */
export function useWindowDrag(onClick?: () => void): WindowDrag {
  const [held, setHeld] = useState(false);

  const origin = useRef<DragOrigin | null>(null);
  const activePointer = useRef<number | null>(null);
  const dragged = useRef(false);
  const pending = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);

  // Kept in a ref so the handlers below stay referentially stable.
  const clickHandler = useRef(onClick);
  useEffect(() => {
    clickHandler.current = onClick;
  });

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  // Window moves are batched to one IPC call per frame; pointermove can fire
  // several times per frame and each setPosition is a round trip to Rust.
  const flush = useCallback(() => {
    frame.current = null;
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    void appWindow.setPosition(new PhysicalPosition(next.x, next.y));
  }, []);

  const onPointerDown = useCallback<PointerHandler>((event) => {
    if (event.button !== 0) return;
    event.preventDefault();

    const target = event.currentTarget;
    const id = event.pointerId;
    const pointerX = event.screenX;
    const pointerY = event.screenY;

    activePointer.current = id;
    dragged.current = false;
    target.setPointerCapture(id);
    setHeld(true);

    void appWindow.outerPosition().then((position) => {
      // The press may already have been released while this resolved.
      if (activePointer.current !== id) return;
      origin.current = {
        pointerX,
        pointerY,
        windowX: position.x,
        windowY: position.y,
      };
    });
  }, []);

  const onPointerMove = useCallback<PointerHandler>(
    (event) => {
      const from = origin.current;
      if (!from || activePointer.current !== event.pointerId) return;

      const dx = event.screenX - from.pointerX;
      const dy = event.screenY - from.pointerY;

      // Hold the window still inside the slop radius, so clicking never nudges it.
      if (!dragged.current) {
        if (Math.hypot(dx, dy) <= CLICK_SLOP) return;
        dragged.current = true;
      }

      // screenX/Y are CSS pixels in screen space; setPosition wants physical.
      const scale = window.devicePixelRatio;
      pending.current = {
        x: Math.round(from.windowX + dx * scale),
        y: Math.round(from.windowY + dy * scale),
      };
      if (frame.current === null) frame.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  const onPointerUp = useCallback<PointerHandler>((event) => {
    if (activePointer.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const wasClick = !dragged.current && event.type !== "pointercancel";
    activePointer.current = null;
    origin.current = null;
    dragged.current = false;
    setHeld(false);

    if (wasClick) clickHandler.current?.();
  }, []);

  return {
    held,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
