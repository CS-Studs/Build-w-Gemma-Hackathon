use tauri::{AppHandle, Result, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const WIDGET_LABEL: &str = "main";
pub const WORKSPACE_LABEL: &str = "workspace";

/// The floating duck: frameless, see-through, pinned above other windows.
///
/// Defined here rather than in tauri.conf.json because the widget is closed and
/// rebuilt every time the user swaps between it and the workspace, and two
/// copies of these settings would inevitably drift apart.
pub fn build_widget(app: &AppHandle) -> Result<WebviewWindow> {
    WebviewWindowBuilder::new(app, WIDGET_LABEL, WebviewUrl::App("index.html".into()))
        .title("StudyDuck")
        .inner_size(210.0, 240.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .center()
        .build()
}

/// The normal app window.
pub fn build_workspace(app: &AppHandle) -> Result<WebviewWindow> {
    WebviewWindowBuilder::new(app, WORKSPACE_LABEL, WebviewUrl::App("index.html".into()))
        .title("StudyDuck")
        .inner_size(900.0, 640.0)
        .min_inner_size(480.0, 360.0)
        .center()
        .build()
}
