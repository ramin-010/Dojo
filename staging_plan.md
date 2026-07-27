# Staging Plan — Day Manager V2

## Final Implementation

### Single File Rewritten
- **`src/components/dashboard/DayManagerModal.tsx`**: Complete rewrite (386 → ~490 lines)
- **Zero other files changed** — same `DayManagerModalProps` interface, same `updateDaySchedule()` call

### Architecture: Recalculation Engine with Pin Waypoints

The V2 recalculation engine processes **only future blocks** (UPCOMING/ACTIVE) while past blocks (COMPLETED/SKIPPED/PARTIAL) remain frozen. The cascade logic:

```
let currentMin = dayStartMin;

for each future slot:
  if ACTIVE  → locked startTime, endTime = start + duration, cascade continues from endTime
  if PINNED  → locked startTime (user anchor), endTime = start + duration, cascade continues from endTime
  if NORMAL  → startTime = currentMin (cascaded), endTime = start + duration
```

### Key Decisions

1. `isPinned` is local-only — not persisted to DB
2. Dragging a pinned block unpins it
3. Past/future split is status-based not time-based
4. "Resume at" control only shown when no ACTIVE block
5. Gap rows for ≥5 min gaps; smaller gaps ignored
6. Overlap detection shows amber "OVERLAP" badge
7. Footer button is context-dependent: "Delay +30m" vs "Insert 30m Break"
