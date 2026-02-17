Implementation Plan: Peek Text Editor (Finalization)
1. Context & North Star

Peek is a high-performance, lightweight "luxury" text editor. It is not an IDE. It should feel like a native OS utility: instant, stable, and aesthetically "stealthy."

    Tech Stack: Tauri (Rust), React (TS), Vite.

    Philosophy: Speed over features. Reliability over plugins.

    Current State: Basic layering (Textarea + Div) is implemented but needs "production-grade" hardening.

2. Phase 1: The "Zero-Data-Loss" Core (Rust/Tauri)

The editor's primary job is to be a safe custodian of text.
2.1 Atomic Saving System

Implement a "Safe-Write" command in src-tauri/src/lib.rs:

    Write to Temp: Write the string to {filename}.tmp.

    Sync: Call File::sync_all() to ensure bits are on the platter/SSD.

    Replace: Rename {filename}.tmp to {filename} (Atomic on most OSs).

    Error Handling: If any step fails, the original file must remain untouched.

2.2 External Change Detection (Mtime)

    State: Store the Modified Time (mtime) when a file is opened.

    Check: Before saving, compare the disk's current mtime with the stored version.

    Conflict: If they differ, trigger a frontend event disk-conflict-detected.

3. Phase 2: Performance UI (React/TS)

Maintaining the "Floating Text" illusion at 60fps.
3.1 Scroll & Layer Synchronization

    Task: Audit handleScroll in CodeEditor.tsx.

    Constraint: Use requestAnimationFrame for all synchronization between the textarea and the highlights div.

    Fix: Ensure white-space: pre-wrap and word-break are identical across all layers to prevent line-wrapping drift.

3.2 Web-Worker Syntax Highlighting

    Move Logic: Move highlight.js (or chosen engine) into src/workers/highlighter.ts.

    Flow: 1. Textarea onChange -> Send string to Worker.
    2. Worker processes -> Returns HTML string.
    3. Main thread updates highlights layer via dangerouslySetInnerHTML.

    Debounce: Add a 10ms-50ms debounce to the worker call to prevent lag during rapid typing.

4. Phase 3: The "Peek" Feature Set

High-level tools for a high-level editor.
4.1 The Omni-Bar (Fuzzy Finder)

Create a Spotlight-style modal (Cmd/Ctrl + P):

    Fuzzy Search: Use a lightweight JS library (like fuse.js) to search open tabs.

    Line Jump: If input starts with :, jump to that line number in the active editor.

    Command Mode: If input starts with >, list app actions (e.g., "Toggle Terminal", "Clear Cache").

4.2 Multi-Cursor Polish

    Ctrl+D: Implement "Add Next Occurrence" logic.

    Interaction: Ensure clicking anywhere in the textarea resets the custom multi-cursor state to prevent UI desync.

5. Phase 4: Aesthetic & Binary Polish

Defining the "Peek" brand.
5.1 The "Ghost" UI

    Tauri Vibrancy: Implement window-vibrancy in Rust to allow a semi-transparent, blurred background on macOS/Windows.

    CSS Variables: Centralize all colors in App.css using variables for easy "Theme" switching (Dark/Light/OLED).

5.2 Binary Optimization

Update src-tauri/Cargo.toml:
Ini, TOML

[profile.release]
opt-level = 'z'      # Minimize size
lto = true           # Link Time Optimization
codegen-units = 1
panic = 'abort'      # Remove bloat

6. Definition of Done (Testing)

    [ ] Data Safety: Can I "Pull the plug" during a save without corrupting the original file?

    [ ] Sync Check: In a 2,000-line file, is the highlighting perfectly aligned with the text?

    [ ] Speed: Does the app launch in under 300ms?

    [ ] Binary Check: Does the editor block me from opening a 1GB .exe file accidentally?