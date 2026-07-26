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
 * Hiding comes first so this window vanishes the instant it is clicked, rather
 * than sitting on top of its replacement for however long the new window takes
 * to build. Hiding does not destroy the window, so the app stays alive through
 * the swap -- Tauri exits once the last window is *closed*, and closing before
 * the replacement existed would kill the process outright.
 */
async function swapTo(command: "open_widget" | "open_workspace"): Promise<void> {
  const current = getCurrentWindow();
  await current.hide();

  try {
    await invoke(command);
  } catch (error) {
    // Nothing replaced us, so come back rather than linger as an invisible window.
    await current.show();
    throw error;
  }

  await current.close();
}

/** Widget -> workspace. */
export function enterWorkspace(): Promise<void> {
  return swapTo("open_workspace");
}

/** Workspace -> widget. */
export function enterWidget(): Promise<void> {
  return swapTo("open_widget");
}
