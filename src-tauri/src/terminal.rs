use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use std::thread;

use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

// ── Types ─────────────────────────────────────────────────────────────────────

/// Holds a single terminal session: the master writer + child process.
struct TerminalSession {
    writer: Box<dyn Write + Send>,
    pair_master: Box<dyn MasterPty + Send>,
}

/// Managed state: map of terminal ID → session.
pub struct PtyState {
    sessions: Mutex<HashMap<u32, TerminalSession>>,
    next_id: Mutex<u32>,
}

impl PtyState {
    pub fn new() -> Self {
        PtyState {
            sessions: Mutex::new(HashMap::new()),
            next_id: Mutex::new(1),
        }
    }
}

#[derive(Serialize, Clone)]
struct TerminalOutput {
    id: u32,
    data: String,
}

#[derive(Serialize, Clone)]
struct TerminalExit {
    id: u32,
    code: i32,
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Spawn a new terminal session. Returns the terminal ID.
#[tauri::command]
pub fn spawn_terminal(
    rows: u16,
    cols: u16,
    cwd: Option<String>,
    app: AppHandle,
    state: tauri::State<'_, PtyState>,
) -> Result<u32, String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Build shell command
    let mut cmd = CommandBuilder::new_default_prog();
    if let Some(dir) = cwd {
        cmd.cwd(dir);
    }

    // Spawn child
    let _child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    // Assign ID
    let id = {
        let mut next = state.next_id.lock().map_err(|e| e.to_string())?;
        let id = *next;
        *next += 1;
        id
    };

    // Get reader from master
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;

    // Get writer for sending input
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take writer: {}", e))?;

    // Store session
    {
        let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
        sessions.insert(
            id,
            TerminalSession {
                writer,
                pair_master: pair.master,
            },
        );
    }

    // Background reader thread: reads PTY output and emits events
    let app_handle = app.clone();
    let terminal_id = id;
    thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_handle.emit(
                        "terminal-output",
                        TerminalOutput {
                            id: terminal_id,
                            data,
                        },
                    );
                }
                Err(_) => break,
            }
        }
        // Terminal exited
        let _ = app_handle.emit(
            "terminal-exit",
            TerminalExit {
                id: terminal_id,
                code: 0,
            },
        );
    });

    Ok(id)
}

/// Write data (user input) to terminal.
#[tauri::command]
pub fn write_terminal(
    id: u32,
    data: String,
    state: tauri::State<'_, PtyState>,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get_mut(&id)
        .ok_or_else(|| format!("Terminal {} not found", id))?;
    session
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("Write failed: {}", e))?;
    session
        .writer
        .flush()
        .map_err(|e| format!("Flush failed: {}", e))?;
    Ok(())
}

/// Resize terminal.
#[tauri::command]
pub fn resize_terminal(
    id: u32,
    rows: u16,
    cols: u16,
    state: tauri::State<'_, PtyState>,
) -> Result<(), String> {
    let sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    let session = sessions
        .get(&id)
        .ok_or_else(|| format!("Terminal {} not found", id))?;
    session
        .pair_master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Resize failed: {}", e))?;
    Ok(())
}

/// Kill a terminal session.
#[tauri::command]
pub fn kill_terminal(id: u32, state: tauri::State<'_, PtyState>) -> Result<(), String> {
    let mut sessions = state.sessions.lock().map_err(|e| e.to_string())?;
    sessions.remove(&id);
    Ok(())
}
