import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useWindowDrag } from "../hooks/useWindowDrag";
import { enterWorkspace } from "../windows";
import { Duck } from "./Duck";
import "./Widget.css";

/** The floating duck: drag to move it, click to open the workspace. */
export function Widget() {
  const { held, handlers } = useWindowDrag(() => {
    void enterWorkspace();
  });

  useEffect(() => {
    const blockMenu = (event: MouseEvent) => event.preventDefault();
    document.addEventListener("contextmenu", blockMenu);
    return () => document.removeEventListener("contextmenu", blockMenu);
  }, []);

  return (
    <div className="widget">
      <button
        className="widget__quit"
        title="Close StudyDuck"
        aria-label="Close StudyDuck"
        onClick={() => void getCurrentWindow().close()}
      >
        ×
      </button>

      <div className={held ? "widget__float is-held" : "widget__float"}>
        <div
          className={held ? "widget__duck is-held" : "widget__duck"}
          {...handlers}
        >
          <Duck />
        </div>
      </div>
    </div>
  );
}
