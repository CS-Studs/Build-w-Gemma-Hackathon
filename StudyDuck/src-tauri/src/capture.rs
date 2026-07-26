use std::{
    fs,
    io::{Cursor, Write},
    path::PathBuf,
};

use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use tauri::{AppHandle, Manager};
use xcap::{
    Monitor,
    image::{DynamicImage, ImageFormat, RgbaImage, imageops::FilterType},
};

/// The running log every verdict is appended to, one line per analysis.
const ANALYSIS_FILE: &str = "analysis.txt";

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

/// Grabs the primary monitor and hands it back as a base64 JPEG.
///
/// Nothing is written to disk: the frame exists only long enough to be sent to
/// Gemma, and only the verdict is worth keeping.
///
/// Errors are echoed to stderr as well as returned: the caller is a frameless
/// window whose console nobody can open, so the dev terminal is the only place
/// a failure here would otherwise be seen.
#[tauri::command]
pub async fn capture_screen() -> Result<String, String> {
    grab_screen().inspect_err(|error| eprintln!("capture_screen failed: {error}"))
}

fn grab_screen() -> Result<String, String> {
    let frame = primary_monitor()?
        .capture_image()
        .map_err(|e| e.to_string())?;

    Ok(BASE64.encode(encode_jpeg(frame)?))
}

/// Appends one analysis to the log and returns where it landed.
#[tauri::command]
pub async fn save_analysis(app: AppHandle, text: String) -> Result<String, String> {
    write_analysis(&app, &text).inspect_err(|error| eprintln!("save_analysis failed: {error}"))
}

/// Adding the line ending here rather than trusting the caller keeps the
/// one-entry-per-line shape of the log an invariant of the writer.
fn write_analysis(app: &AppHandle, line: &str) -> Result<String, String> {
    let dir = capture_dir(app)?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let path = dir.join(ANALYSIS_FILE);
    let mut log = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;

    writeln!(log, "{line}").map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().into_owned())
}
