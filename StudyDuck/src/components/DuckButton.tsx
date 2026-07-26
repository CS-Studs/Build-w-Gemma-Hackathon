import { Duck } from "./Duck";
import { enterWidget } from "../windows";
import "./DuckButton.css";

/** Workspace-side duck: click to go back to the floating widget. No dragging. */
export function DuckButton() {
  return (
    <button
      className="duck-button"
      title="Back to the floating duck"
      aria-label="Back to the floating duck"
      onClick={() => void enterWidget()}
    >
      <Duck />
    </button>
  );
}
