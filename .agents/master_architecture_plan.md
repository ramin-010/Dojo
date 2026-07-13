# Master Architecture Plan

## Revision UX (Recall Mode)
- **Trigger Condition**: When a user enters a topic workspace that is actively in a revision cycle (2, 3, or 4), the application enters "Recall Mode".
- **Collapsed State**:
  - A `defaultCollapsed` flag is propagated down to the Canvas system.
  - Text blocks (paragraphs, lists, code blocks, etc.) are hidden via the `.revision-collapsed` CSS class appended in `globals.css` (`display: none`).
  - Headings (`h1`, `h2`, `h3`) remain visible to outline context.
  - Blockquotes (styled uniquely as "My Take" insights) remain visible, acting as personal cues for recall.
- **Toggle Mechanism**:
  - An absolute-positioned, minimal floating action button (Eye/EyeOff icon) sits at the top-right of the canvas (`CanvasHeader.tsx`).
  - Clicking this toggle reveals/hides the full contents of all blocks globally by flipping `isAllExpanded`.
- **Block-level Expand**: Removed in favor of the global toggle for cleaner UX.
