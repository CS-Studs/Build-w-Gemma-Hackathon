use std::{
    fs,
    io::Cursor,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use tauri::{AppHandle, Manager};
use xcap::{
    Monitor,
    image::{DynamicImage, ImageFormat, RgbaImage, imageops::FilterType},
};

const ANALYSIS_PREFIX: &str = "analysis-";

/// How many analyses to keep. This directory is scratch space, so older notes
/// are dropped once the count goes past this.
const MAX_ANALYSES: usize = 60;

/// Screenshots are shrunk to this width before being sent off. A classifier
/// only needs to see roughly what is on screen, and a full-resolution frame is
/// both a slow upload and a lot of image tokens.
const MAX_WIDTH: u32 = 1280;

/// Where captures and analyses land.
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

/// Shrinks the frame and encodes it as JPEG, which has no alpha channel and so
/// needs the captured RGBA dropped to RGB first.
fn encode_jpeg(frame: RgbaImage) -> Result<Vec<u8>, String> {
    let mut image = DynamicImage::ImageRgba8(frame);

    if image.width() > MAX_WIDTH {
        let height = (image.height() * MAX_WIDTH) / image.width();
        image = image.resize(MAX_WIDTH, height, FilterType::Triangle);
    }

    let mut buffer = Vec::new();
    DynamicImage::ImageRgb8(image.to_rgb8())
        .write_to(&mut Cursor::new(&mut buffer), ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;

    Ok(buffer)
}

/// Deletes the oldest files beyond `keep`.
///
/// Only touches files this module wrote: both the prefix and the extension are
/// checked, so nothing else dropped in the folder is at risk.
fn prune(dir: &Path, prefix: &str, extension: &str, keep: usize) -> std::io::Result<()> {
    let mut existing: Vec<PathBuf> = fs::read_dir(dir)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with(prefix) && name.ends_with(extension))
        })
        .collect();

    if existing.len() <= keep {
        return Ok(());
    }

    // Names embed a fixed-width millisecond timestamp, so sorting by name sorts
    // by age.
    existing.sort();
    for stale in &existing[..existing.len() - keep] {
        let _ = fs::remove_file(stale);
    }

    Ok(())
}

fn timestamp() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|since| since.as_millis())
        .map_err(|e| e.to_string())
}

/// Grabs the primary monitor and hands it back as a base64 JPEG.
///
/// Nothing is written to disk: the frame exists only long enough to be sent to
/// Gemma, and only the verdict is worth keeping.
#[tauri::command]
pub async fn capture_screen() -> Result<String, String> {
    let frame = primary_monitor()?
        .capture_image()
        .map_err(|e| e.to_string())?;

    Ok(BASE64.encode(encode_jpeg(frame)?))
}

/// Writes one analysis into the capture directory and returns where it landed.
#[tauri::command]
pub async fn save_analysis(app: AppHandle, text: String) -> Result<String, String> {
    let dir = capture_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let stamp = timestamp()?;
    let path = dir.join(format!("{ANALYSIS_PREFIX}{stamp}.txt"));

    fs::write(&path, text).map_err(|e| e.to_string())?;
    let _ = prune(&dir, ANALYSIS_PREFIX, ".txt", MAX_ANALYSES);

    Ok(path.to_string_lossy().into_owned())
}
