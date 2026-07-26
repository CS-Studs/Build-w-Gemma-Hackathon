import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalPosition } from "@tauri-apps/api/dpi";
import duck from "./assets/default.gif";
import "./App.css";

const appWindow = getCurrentWindow();

type DragOrigin = {
  pointerX: number;
  pointerY: number;
  windowX: number;
  windowY: number;
};

function App() {
  const [held, setHeld] = useState(false);

  const origin = useRef<DragOrigin | null>(null);
  const activePointer = useRef<number | null>(null);
  const pending = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);

  // Window moves are batched to one IPC call per frame; pointermove can fire
  // several times per frame and each setPosition is a round trip to Rust.
  const flush = useCallback(() => {
    frame.current = null;
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    void appWindow.setPosition(new PhysicalPosition(next.x, next.y));
  }, []);

  useEffect(() => {
    const blockMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", blockMenu);
    return () => {
      document.removeEventListener("contextmenu", blockMenu);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, []);

  const onPointerDown = useCallback(
    async (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();

      const target = e.currentTarget;
      const id = e.pointerId;
      const pointerX = e.screenX;
      const pointerY = e.screenY;

      activePointer.current = id;
      target.setPointerCapture(id);
      setHeld(true);

      const pos = await appWindow.outerPosition();
      // The pointer may already have been released while this resolved.
      if (activePointer.current !== id) return;
      origin.current = { pointerX, pointerY, windowX: pos.x, windowY: pos.y };
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const from = origin.current;
      if (!from || activePointer.current !== e.pointerId) return;

      // screenX/Y are CSS pixels in screen space; setPosition wants physical.
      const scale = window.devicePixelRatio;
      pending.current = {
        x: Math.round(from.windowX + (e.screenX - from.pointerX) * scale),
        y: Math.round(from.windowY + (e.screenY - from.pointerY) * scale),
      };
      if (frame.current === null) frame.current = requestAnimationFrame(flush);
    },
    [flush],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointer.current !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    activePointer.current = null;
    origin.current = null;
    setHeld(false);
  }, []);

  return (
    <div className="stage">
      <button
        className="quit"
        title="Close StudyDuck"
        aria-label="Close StudyDuck"
        onClick={() => void appWindow.close()}
      >
        ×
      </button>

      <div className={held ? "bob held" : "bob"}>
        <div
          className={held ? "duck held" : "duck"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <img src={duck} alt="StudyDuck" draggable={false} />
        </div>
      </div>
    </div>
  );
}

export default App;
