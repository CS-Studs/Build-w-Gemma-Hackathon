import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Label of the floating duck window. */
export const WIDGET_LABEL = "main";

/** Label of the normal app window. */
export const WORKSPACE_LABEL = "workspace";

export const isWidgetWindow = getCurrentWindow().label === WIDGET_LABEL;

/**
 * Opens one window and closes the current one.
 *
 * The new window is built first and only then is this one closed: Tauri exits
 * the app once the last window goes away, so closing first would kill the
 * process before there was anything to replace it with. The Rust command
 * returns only when the window genuinely exists, which is what makes that safe.
 */
async function swapTo(command: "open_widget" | "open_workspace"): Promise<void> {
  await invoke(command);
  await getCurrentWindow().close();
}

/** Widget -> workspace. */
export function enterWorkspace(): Promise<void> {
  return swapTo("open_workspace");
}

/** Workspace -> widget. */
export function enterWidget(): Promise<void> {
  return swapTo("open_widget");
}
