# Master Architecture Plan

## Authentication System (Upgraded to Multi-User)
- **Previous System**: Single-tenant Edge Middleware with a global `APP_PASSWORD`. The `DEV_USER_ID` and `DEV_WORKSPACE_ID` were hardcoded constants throughout 97 locations.
- **Current System**: Full Multi-User JWT-based Authentication.
- **Mechanism**: 
  - Edge middleware (`src/proxy.ts`) protects routes and redirects to `/login`.
  - Registration (`/api/auth/register`) creates a `User` (with `bcryptjs` hashed password) and a default `Workspace`.
  - Login (`/api/auth/login`) verifies credentials and issues a `jose` signed JWT HTTP-only cookie (`revise_session`).
  - Across the app (Server Components, Actions, API Routes), `getSession()` from `@/lib/auth` replaces the hardcoded constants to dynamically resolve `userId` and `workspaceId`.
  - Client components receive `workspaceId` as a prop from their server-side parents to guarantee tenant isolation.

## Resource Preview & UI Theme 
- **Resource Preview Modal**: A unified markdown rendering modal (`ResourcePreviewModal.tsx`) for `TopicWorkspace`. Uses `createPortal` to escape the stacking context so it displays above `z-[100]` sidebars. Hooks into the browser's Fullscreen API on mount for a distraction-free F11-style view.
- **Theme Compatibility**: Strict overrides of Tailwind Typography (`@tailwindcss/typography`) default grays using dynamic CSS variables (e.g., `prose-headings:text-foreground`). This fixes the "invisible text" issue when using dark mode typography inverted on a Sepia (beige) theme.
- **Responsive Navigation**: Utility buttons (Prev/Next Topic) collapse text on narrow screens (`max-md:hidden`) to prevent layout clipping.

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
