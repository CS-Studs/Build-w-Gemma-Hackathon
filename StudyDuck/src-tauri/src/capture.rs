use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use tauri::{AppHandle, Manager};
use xcap::Monitor;

const PREFIX: &str = "screen-";

/// How many captures to keep. A full-screen PNG every 15 seconds is on the
/// order of a gigabyte an hour, and this directory is scratch space, so the
/// oldest frames are dropped once the count goes past this.
const MAX_CAPTURES: usize = 40;

/// Where captures land.
///
/// In development that is the source tree, so they are easy to find. A packaged
/// build has no source tree to write into, so it falls back to the per-user app
/// data directory.
fn capture_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        Ok(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../src/assets/temp"))
    } else {
        app.path()
            .app_data_dir()
            .map(|dir| dir.join("temp"))
            .map_err(|e| e.to_string())
    }
}

/// The primary monitor, falling back to whichever one is listed first.
fn primary_monitor() -> Result<Monitor, String> {
    let monitors = Monitor::all().map_err(|e| e.to_string())?;

    let mut fallback = None;
    for monitor in monitors {
        if monitor.is_primary().unwrap_or(false) {
            return Ok(monitor);
        }
        if fallback.is_none() {
            fallback = Some(monitor);
        }
    }

    fallback.ok_or_else(|| "no monitor available to capture".to_string())
}

/// Deletes the oldest captures beyond MAX_CAPTURES.
///
/// Only touches files this module wrote: the prefix and extension are both
/// checked, so nothing else dropped in the folder is at risk.
fn prune(dir: &Path) -> std::io::Result<()> {
    let mut captures: Vec<PathBuf> = fs::read_dir(dir)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with(PREFIX) && name.ends_with(".png"))
        })
        .collect();

    if captures.len() <= MAX_CAPTURES {
        return Ok(());
    }

    // Names embed a fixed-width millisecond timestamp, so sorting by name sorts
    // by age.
    captures.sort();
    for stale in &captures[..captures.len() - MAX_CAPTURES] {
        let _ = fs::remove_file(stale);
    }

    Ok(())
}

/// Writes a PNG of the primary monitor and returns where it landed.
#[tauri::command]
pub async fn capture_screen(app: AppHandle) -> Result<String, String> {
    let dir = capture_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let image = primary_monitor()?
        .capture_image()
        .map_err(|e| e.to_string())?;

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();

    let path = dir.join(format!("{PREFIX}{stamp}.png"));
    image.save(&path).map_err(|e| e.to_string())?;

    let _ = prune(&dir);

    Ok(path.to_string_lossy().into_owned())
}
