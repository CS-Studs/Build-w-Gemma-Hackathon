import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * Captures the desktop on a fixed interval for as long as this is mounted.
 *
 * Mounting is the whole scoping mechanism: only the widget window renders the
 * component that calls this, so the loop starts when the duck appears and dies
 * with the window when it swaps to the workspace.
 */
export function useScreenshotLoop(intervalMs: number) {
  useEffect(() => {
    const timer = window.setInterval(() => {
      invoke("capture_screen").catch((error: unknown) => {
        console.error("screenshot failed", error);
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs]);
}
