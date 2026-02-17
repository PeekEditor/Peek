# Peek - Technical Documentation

## 1. Architecture Overview

**Peek** is a high-performance, lightweight code editor built using **Tauri** (Rust) for the backend and **React** (TypeScript) + **Vite** for the frontend.

### Core Technologies
-   **Frontend**: React 18, TypeScript, Vite, CSS Modules / Global CSS.
-   **Backend**: Rust (Tauri), Portable PTY (Terminal).
-   **Build System**: Cargo + pnpm.
-   **Communication**: Tauri IPC (Commands/Events) between Rust Main Process and Webview.

---

## 2. Frontend Architecture

### 2.1. File Management & Routing
The application uses a **Single Page Application (SPA)** model but mimics a multi-tab interface.
-   **State**: `useTabs` hook manages open files.
-   **File Loading**:
    -   Small Files (<50KB): Read fully into memory (`fs.readTextFile`).
    -   Large Files (>50KB): Read via **Chunks** using a custom Rust command `read_file_chunk`.
    -   **Binary Detection**: "Magic Bytes" check in Rust prevents loading binaries as text.

### 2.2. The `CodeEditor` Component (`src/components/CodeEditor.tsx`)
This is the heart of the application. It uses a **Layered Architecture** to achieve performance and custom rendering capabilities.

#### Layered Design
To support custom cursors, syntax highlighting, and search overlays, the editor is composed of multiple absolute-positioned layers inside a relative container:

1.  **Wrapper** (`.editor-content`): `position: relative`, `flex: 1`. Handles resizing.
2.  **Input Layer** (`textarea`):
    -   `zIndex: 10`.
    -   `color: transparent`, `caretColor: transparent`.
    -   Handles all user input, native selection events, and scrolling.
    -   **Syncing**: Its `scrollTop` and `scrollLeft` are mirrored to other layers via `handleScroll`.
3.  **Visual Layer** (`.editor-highlights`):
    -   `zIndex: 0`.
    -   `pointer-events: none`.
    -   Contains the **Syntax Highlighting** (Rendered by `highlight.js`).
    -   **Synchronized Attributes**: MUST match `textarea` exactly in:
        -   `font-family`, `font-size`.
        -   `line-height` (Enforced generic PIXEL value to avoid browser rounding errors).
        -   `padding` (24px).
        -   `white-space` (Pre/Pre-wrap).
4.  **Search Overlay** (`.search-marks-overlay`):
    -   `position: absolute`.
    -   Renders `<mark>` tags for search results.
    -   Matches text flow exactly.
5.  **Multi-Cursor Overlay**:
    -   Renders custom `cursor-caret` and `cursor-selection` divs.
    -   **Coordinate System**: Uses `row * lineHeight + padding` and `col * ch + padding` to map text indices to pixels.

#### Critical Implementation Details
-   **Pixel-Perfect Line Height**: We calculate `Math.round(fontSize * 1.6)` in pixels and enforce it on all layers. Using unitless `1.6` caused drift between the `textarea` and `div` layers on large files.
-   **Scroll Sync**: `handleScroll` forces `highlightsRef.scrollLeft = textareaRef.scrollLeft` to ensure horizontal scrolling stays aligned (fixing the "floating text" illusion).
-   **Multi-Cursor Logic** (`useMultiCursor.ts`):
    -   State: Array of `{ start, end, id }` cursors.
    -   **Input Handling**: We intercept `onKeyDown`.
    -   **Ctrl+D**: Triggers "Add Next Occurrence". Also triggers "Search Highlight" for visual feedback.
    -   **Click Handling**: `onClick` on the textarea clears custom cursors to restore native selection.

### 2.3. Large File Viewer (`src/components/LargeFileViewer.tsx`)
For files > 2MB, we switch to a **Virtualized List** approach.
-   Only renders lines currently in the viewport.
-   Uses `react-window` or custom logic (current implementation allows chunk reading).
-   Disables full Syntax Highlighting (falls back to plain text) to maintain 60fps.

---

## 3. Backend Architecture (Rust)

Located in `src-tauri/src/`.

### 3.1. Commands (`lib.rs`)
Exposes functions callable from frontend:
-   `read_file_chunk(path, offset, length)`: Reads raw bytes.
-   `get_file_metadata(path)`: Returns size, permissions, created time.
-   `detect_binary(path)`: Reads first 512 bytes to check for null bytes.

### 3.2. Pseudo-Terminal (PTY)
Uses `portable-pty` to spawn a shell (`bash`/`zsh`/`powershell`).
-   **Async Reader**: Spawns a thread to read stdout/stderr and emits `terminal-data` events to frontend.
-   **Writer**: Frontend sends `terminal-write` commands to stdin.

---

## 4. Key Workflows

### 4.1. Saving Files
1.  **Frontend**: `Ctrl+S` -> `fs.writeTextFile`.
2.  **Safety**: Checks if file was modified on disk since load (Optimistic Concurrency - *Planned*).
3.  **Auto-Save**: Optional background interval saves to `localStorage` or temp file.

### 4.2. Search and Replace
-   **Search**: Uses `Regex` in JS (if small file) or Rust-based grep (if large file - *Planned*).
-   **Replace**: Constructs new content string and updates React state.

---

## 5. Development & Debugging

-   **Debug Mode**: `pnpm tauri dev` opens the window with DevTools enabled.
-   **Styles**: `src/App.css` contains global variables (`--bg-color`, `--text-color`) and overrides.
-   **Worker**: Syntax highlighting runs in `src/worker.ts` to avoid freezing the main thread.
