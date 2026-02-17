use std::fs;
use std::path::Path;
use std::io::{Read, Seek, SeekFrom, BufRead, BufReader, Write};
use std::collections::HashMap;
use std::sync::Mutex;
use serde::{Serialize, Deserialize};
use tauri::Manager;

mod terminal;

// ── Shared State ──────────────────────────────────────────────────────────────
// Stores line-offset indexes for large files: path → Vec of byte offsets
struct LineIndexCache(Mutex<HashMap<String, Vec<u64>>>);

// ── Types ─────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
struct FileResponse {
    content: String,
    file_name: String,
    extension: String,
    size: u64,
    mtime: u64, // Unix timestamp (seconds)
    is_binary: bool,
    is_large_file: bool,
}

#[derive(Serialize, Deserialize)]
struct IndexResponse {
    total_lines: usize,
    file_size: u64,
    mtime: u64,
}

#[derive(Serialize, Deserialize)]
struct LinesResponse {
    content: String,
    start_line: usize,
    lines_read: usize,
}

#[derive(Serialize, Deserialize)]
struct ChunkResponse {
    content: String,
    bytes_read: usize,
}

const LARGE_FILE_THRESHOLD: u64 = 2 * 1024 * 1024; // 2 MB

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
fn read_file_content(path: String) -> Result<FileResponse, String> {
    let file_path = Path::new(&path);
    
    let metadata = fs::metadata(file_path).map_err(|e| e.to_string())?;
    let size = metadata.len();
    
    let mtime = metadata.modified()
        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs())
        .unwrap_or(0);

    let file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
        
    let extension = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
        
    let is_image_ext = ["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp", "ico"].contains(&extension.as_str());

    // Check for binary via magic bytes
    let mut file = std::fs::File::open(file_path).map_err(|e| e.to_string())?;
    let mut buffer = [0; 1024];
    let count = file.read(&mut buffer).map_err(|e| e.to_string())?;
    let has_null_byte = buffer[..count].contains(&0);

    if has_null_byte && !is_image_ext {
        return Ok(FileResponse {
            content: "Binary file detected".to_string(),
            file_name,
            extension,
            size,
            mtime,
            is_binary: true,
            is_large_file: false,
        });
    }

    if is_image_ext {
        let bytes = fs::read(file_path).map_err(|e| e.to_string())?;
        use base64::{Engine as _, engine::general_purpose};
        let b64 = general_purpose::STANDARD.encode(bytes);
        let content = format!("data:image/{};base64,{}", if extension == "svg" { "svg+xml" } else { &extension }, b64);
        
        return Ok(FileResponse {
            content,
            file_name,
            extension,
            size,
            mtime,
            is_binary: false,
            is_large_file: false,
        }); 
    }

    // Large file: return empty content, frontend will use index_file + read_lines
    if size > LARGE_FILE_THRESHOLD {
        return Ok(FileResponse {
            content: String::new(),
            file_name,
            extension,
            size,
            mtime,
            is_binary: false,
            is_large_file: true,
        });
    }

    // Standard small file
    file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
    let mut full_content = String::new();
    file.read_to_string(&mut full_content).map_err(|_| "Failed to read text content".to_string())?;

    Ok(FileResponse {
        content: full_content,
        file_name,
        extension,
        size,
        mtime,
        is_binary: false,
        is_large_file: false,
    })
}

/// Scan a file and build an index of byte offsets for each line start.
/// Returns total number of lines and file size.
#[tauri::command]
fn index_file(path: String, state: tauri::State<'_, LineIndexCache>) -> Result<IndexResponse, String> {
    let file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
    let file_size = metadata.len();
    let reader = BufReader::with_capacity(64 * 1024, file); // 64KB buffer for fast scanning

    // Build offsets: the byte position where each line starts
    let mut offsets: Vec<u64> = Vec::new();
    offsets.push(0); // Line 0 starts at byte 0

    let mut byte_pos: u64 = 0;
    for line_result in reader.split(b'\n') {
        let line_bytes = line_result.map_err(|e| e.to_string())?;
        byte_pos += line_bytes.len() as u64 + 1; // +1 for the \n delimiter
        if byte_pos <= file_size {
            offsets.push(byte_pos);
        }
    }

    let total_lines = offsets.len();

    // Cache the index
    let mut cache = state.0.lock().map_err(|e| e.to_string())?;
    cache.insert(path, offsets);

    let mtime = metadata.modified()
        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs())
        .unwrap_or(0);

    Ok(IndexResponse { total_lines, file_size, mtime })
}

/// Read a range of lines from an indexed file.
#[tauri::command]
fn read_lines(
    path: String,
    start_line: usize,
    line_count: usize,
    state: tauri::State<'_, LineIndexCache>,
) -> Result<LinesResponse, String> {
    let cache = state.0.lock().map_err(|e| e.to_string())?;
    let offsets = cache.get(&path).ok_or("File not indexed. Call index_file first.")?;
    
    let total_lines = offsets.len();
    let safe_start = start_line.min(total_lines.saturating_sub(1));
    let safe_end = (safe_start + line_count).min(total_lines);
    let actual_count = safe_end - safe_start;

    if actual_count == 0 {
        return Ok(LinesResponse {
            content: String::new(),
            start_line: safe_start,
            lines_read: 0,
        });
    }

    let start_byte = offsets[safe_start];
    // End byte: if safe_end < total_lines, use that offset; otherwise read to EOF
    let end_byte = if safe_end < total_lines {
        offsets[safe_end]
    } else {
        // Read to end of file
        let metadata = fs::metadata(&path).map_err(|e| e.to_string())?;
        metadata.len()
    };

    let read_length = (end_byte - start_byte) as usize;

    let mut file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(start_byte)).map_err(|e| e.to_string())?;

    let mut buffer = vec![0u8; read_length];
    file.read_exact(&mut buffer).map_err(|e| e.to_string())?;

    let content = String::from_utf8_lossy(&buffer).to_string();

    Ok(LinesResponse {
        content,
        start_line: safe_start,
        lines_read: actual_count,
    })
}

/// Patch a file at a specific line range. Replaces `original_line_count` lines 
/// starting at `start_line` with `new_content`. Returns new total line count.
#[tauri::command]
fn patch_file_lines(
    path: String,
    start_line: usize,
    original_line_count: usize,
    new_content: String,
    state: tauri::State<'_, LineIndexCache>,
) -> Result<IndexResponse, String> {
    // Look up byte range from line index
    let (start_byte, end_byte) = {
        let cache = state.0.lock().map_err(|e| e.to_string())?;
        let offsets = cache.get(&path).ok_or("File not indexed")?;
        let total = offsets.len();
        let s = start_line.min(total.saturating_sub(1));
        let e = (s + original_line_count).min(total);
        let sb = offsets[s];
        let eb = if e < total {
            offsets[e]
        } else {
            fs::metadata(&path).map_err(|e| e.to_string())?.len()
        };
        (sb, eb)
    }; // Drop the lock before doing file I/O

    let file_path = Path::new(&path);
    let temp_path = file_path.with_extension("tmp");

    let mut source = std::fs::File::open(file_path).map_err(|e| e.to_string())?;
    let mut dest = std::fs::File::create(&temp_path).map_err(|e| e.to_string())?;

    // 1. Copy bytes before the edit region
    if start_byte > 0 {
        let mut buf = [0u8; 8192];
        let mut remaining = start_byte;
        while remaining > 0 {
            let to_read = std::cmp::min(remaining, 8192) as usize;
            let n = source.read(&mut buf[..to_read]).map_err(|e| e.to_string())?;
            if n == 0 { break; }
            dest.write_all(&buf[..n]).map_err(|e| e.to_string())?;
            remaining -= n as u64;
        }
    }

    // 2. Write new content
    dest.write_all(new_content.as_bytes()).map_err(|e| e.to_string())?;

    // 3. Skip old content, copy rest
    source.seek(SeekFrom::Start(end_byte)).map_err(|e| e.to_string())?;
    std::io::copy(&mut source, &mut dest).map_err(|e| e.to_string())?;

    // 4. Atomic replace
    fs::rename(&temp_path, file_path).map_err(|e| e.to_string())?;

    // 5. Re-index the file and return
    drop(source);
    // Re-index by calling the indexing logic directly
    let file = std::fs::File::open(file_path).map_err(|e| e.to_string())?;
    let file_size = fs::metadata(file_path).map_err(|e| e.to_string())?.len();
    let reader = BufReader::with_capacity(64 * 1024, file);

    let mut offsets: Vec<u64> = Vec::new();
    offsets.push(0);
    let mut byte_pos: u64 = 0;
    for line_result in reader.split(b'\n') {
        let line_bytes = line_result.map_err(|e| e.to_string())?;
        byte_pos += line_bytes.len() as u64 + 1;
        if byte_pos <= file_size {
            offsets.push(byte_pos);
        }
    }

    let total_lines = offsets.len();
    
    // Re-stat for new mtime (Must do before moving path into cache)
    let metadata = fs::metadata(file_path).map_err(|e| e.to_string())?;
    let file_size = metadata.len();
    let mtime = metadata.modified()
        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs())
        .unwrap_or(0);

    let mut cache = state.0.lock().map_err(|e| e.to_string())?;
    cache.insert(path, offsets);

    Ok(IndexResponse { total_lines, file_size, mtime })
}

// Keep old read_file_chunk for backwards compat (used by initial load)
#[tauri::command]
fn read_file_chunk(path: String, offset: u64, length: usize) -> Result<ChunkResponse, String> {
    let mut file = std::fs::File::open(&path).map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;
    let mut buffer = vec![0; length];
    let read_bytes = file.read(&mut buffer).map_err(|e| e.to_string())?;
    Ok(ChunkResponse {
        content: String::from_utf8_lossy(&buffer[..read_bytes]).to_string(),
        bytes_read: read_bytes,
    })
}

#[tauri::command]
fn safe_save_file(path: String, content: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    let temp_path = file_path.with_extension("tmp");

    // 1. Write to temp file
    let mut file = std::fs::File::create(&temp_path).map_err(|e| e.to_string())?;
    file.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    
    // 2. Sync to disk (ensure data is flushed)
    file.sync_all().map_err(|e| e.to_string())?;
    
    // 3. Atomic replace
    fs::rename(&temp_path, file_path).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn write_file_content(path: String, content: String) -> Result<(), String> {
    // Forward to safe implementation for now, or keep as unsafe alias?
    // Let's upgrade it to safe implementation to protect existing calls.
    safe_save_file(path, content)
}

// ── App Entry ─────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(LineIndexCache(Mutex::new(HashMap::new())))
        .manage(terminal::PtyState::new())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))?;
            window.set_icon(icon)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_file_content,
            read_file_chunk,
            write_file_content,
            safe_save_file,
            index_file,
            read_lines,
            patch_file_lines,
            terminal::spawn_terminal,
            terminal::write_terminal,
            terminal::resize_terminal,
            terminal::kill_terminal,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
