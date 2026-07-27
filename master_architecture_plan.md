# Master Architecture Plan

## Authentication System
- **Previous System**: NextAuth v4 (Database backed credentials provider).
- **Current System**: Lightweight Edge Middleware (`src/proxy.ts`).
- **Mechanism**: 
  - Edge middleware intercepts all routes (except `/login`, `/_next`, `/api`, etc.).
  - It checks for the existence of an HTTP-only `revise_auth` cookie.
  - If missing, redirects to `/login`.
  - `/login` is a single password screen that sends a POST to `/api/auth/login`.
  - `/api/auth/login` verifies against `process.env.APP_PASSWORD` and sets the cookie with a 1-year expiration.
  - `/api/auth/logout` clears the cookie.
- **Benefits**: Zero database overhead, instant edge-level protection, minimal friction for personal usage.

## Dashboard Quick Notes
- **Purpose**: Provide a zero-friction, WhatsApp-style scratchpad directly on the Dashboard.
- **Architecture**:
  - **Database**: `QuickNote` model tied to `Workspace` with `content`, `createdAt`.
  - **Frontend**: A sleek, timeline-style minimalist widget located below the `RevisionsList`. Notes auto-save via debouncing.
  - **Behavior**: Entering empty strings deletes the note. Optimistic state updates mask server latency.

## Day Manager V2 (Real-Life Resilient Redesign)
- **Purpose**: Replaced the V1 linear domino-chain Day Manager with a flexible, real-life-aware schedule triage modal.
- **File Changed**: `src/components/dashboard/DayManagerModal.tsx` (single-file rewrite, same external API).
- **Key Features**:
  - **Past/Future Split**: Blocks are separated by status (COMPLETED/SKIPPED/PARTIAL → read-only past; ACTIVE/UPCOMING → editable future). A live-updating "NOW" horizon divider marks the boundary.
  - **Universal Time Pickers & Pinning**: Start Time and End Time are clickable `<input type="time">` controls on every future block. Selecting a custom start time automatically pins the block (`isPinned: true`). Selecting an end time calculates duration. Pinned blocks act as fixed anchors. `isPinned` is local-only (not persisted to DB).
  - **Inline Custom Block Creator**: Replaced basic add button with an expandable inline form featuring instant autoFocus, start/end time pickers, and one-click duration presets (`15m` through `3h`).
  - **Smart Gap Rows**: When a time gap exists between blocks (≥5 min), a clickable dashed row appears showing the free buffer duration and a "+ Fill" button to instantly insert a block filling the gap.
  - **Overlap Detection**: If a pinned block's start time falls before the previous block's end time, an amber "OVERLAP" warning badge is shown.
  - **Quick Triage Footer**: Context-dependent button — "Delay +30m" (shifts cascade start when no active block) or "Insert 30m Break" (adds a break after the active block).
  - **DnD Unpin**: Dragging a pinned block automatically unpins it (user explicitly changing position).
- **Architecture**: Recalculation engine uses a **push-only cascade** for future unpinned blocks (`Math.max(currentMin, existingStart)`), preserving scheduled gaps by default and only pushing blocks forward when earlier blocks overflow into them. ACTIVE and pinned blocks act as fixed waypoints. Past blocks remain frozen. Save merges past + future arrays back into `updateDaySchedule()`.

## Daily Debrief (AI Mentor Data)
- **Purpose**: Collect highly structured, high-signal data at the end of each day to feed into a Weekly/Monthly AI Mentor Report, while preserving an unstructured area for psychological expressive writing.
- **Architecture**:
  - **Database**: `DayDebrief` model tied to `Workspace` and `date`. Includes `blocksPlanned`, `blocksCompleted`, `blocksSkipped`, `totalFocusedMin` (Layer 1), `energy`, `focus`, `mood`, `tags`, `narrative`, `tomorrowIntent` (Layer 2), and `freeWrite` (Layer 3).
  - **Frontend**: A 3-layer modal (`DayDebriefModal.tsx`) triggered from the Dashboard's "Wrap Up Day" header button.
  - **Behavior**: Auto-computes schedule metrics dynamically from the day's blocks. Saves the user's categorical/quantitative inputs alongside the metrics for downstream LLM pattern extraction.
