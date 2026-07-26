mod capture;
mod windows;

use tauri::{AppHandle, Manager};

/// Opens the workspace window, or focuses it if it is already there.
///
/// Building the window from Rust rather than from JS keeps the swap
/// deterministic: this returns only once the window really exists, so the
/// caller can safely close the window it is leaving without the app exiting.
#[tauri::command]
async fn open_workspace(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(windows::WORKSPACE_LABEL) {
        return existing.set_focus().map_err(|e| e.to_string());
    }

    windows::build_workspace(&app).map_err(|e| e.to_string())?;
    Ok(())
}

/// Opens the floating duck, or focuses it if it is already there.
#[tauri::command]
async fn open_widget(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(windows::WIDGET_LABEL) {
        return existing.set_focus().map_err(|e| e.to_string());
    }

    windows::build_widget(&app).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            windows::build_widget(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_workspace,
            open_widget,
            capture::capture_screen
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
