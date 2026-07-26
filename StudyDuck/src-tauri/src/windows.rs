use tauri::{AppHandle, Result, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const WIDGET_LABEL: &str = "main";
pub const WORKSPACE_LABEL: &str = "workspace";

/// The floating duck: frameless, see-through, pinned above other windows.
///
/// Defined here rather than in tauri.conf.json because the widget is closed and
/// rebuilt every time the user swaps between it and the workspace, and two
/// copies of these settings would inevitably drift apart.
pub fn build_widget(app: &AppHandle) -> Result<WebviewWindow> {
    let widget = WebviewWindowBuilder::new(app, WIDGET_LABEL, WebviewUrl::App("index.html".into()))
        .title("StudyDuck")
        .inner_size(210.0, 240.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .center()
        .build()?;

    exclude_from_capture(&widget);

    Ok(widget)
}

/// Keeps the duck out of the screenshots it takes of the desktop.
///
/// WDA_EXCLUDEFROMCAPTURE leaves the window visible on screen but omits it from
/// screen capture, so what lands in the PNG is whatever the duck was covering.
/// Doing it this way avoids hiding and re-showing the window around every
/// capture, which would make the duck blink every 15 seconds.
///
/// Needs Windows 10 2004 or newer. Anywhere else this is a no-op and the duck
/// photographs itself.
#[cfg(target_os = "windows")]
fn exclude_from_capture(window: &WebviewWindow) {
    use std::ffi::c_void;

    const WDA_EXCLUDEFROMCAPTURE: u32 = 0x0000_0011;

    #[link(name = "user32")]
    extern "system" {
        fn SetWindowDisplayAffinity(hwnd: *mut c_void, affinity: u32) -> i32;
    }

    let Ok(hwnd) = window.hwnd() else {
        return;
    };

    // Cast rather than name the handle type: which windows-rs version Tauri
    // surfaces here shifts between releases, but it is a pointer either way.
    unsafe {
        SetWindowDisplayAffinity(hwnd.0 as *mut c_void, WDA_EXCLUDEFROMCAPTURE);
    }
}

#[cfg(not(target_os = "windows"))]
fn exclude_from_capture(_window: &WebviewWindow) {}

/// The normal app window.
pub fn build_workspace(app: &AppHandle) -> Result<WebviewWindow> {
    WebviewWindowBuilder::new(app, WORKSPACE_LABEL, WebviewUrl::App("index.html".into()))
        .title("StudyDuck")
        .inner_size(900.0, 640.0)
        .min_inner_size(480.0, 360.0)
        .center()
        .build()
}
