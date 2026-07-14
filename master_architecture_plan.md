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
