# Discussion: The Canvas & Learning Workflow Architecture

Based on the detailed conversation with ChatGPT and AntiGravity, here is my analysis of how we should translate this philosophy into the actual Canvas feature and the app's overall architecture.

## 1. Core Philosophy: The App as a Learning Companion with Memory
The primary differentiator of this app is that it doesn't just store notes; it stores a **model of the learner's knowledge**. It remembers what they struggled with yesterday and connects it to what they are learning today. 

## 2. The Canvas UI (The "Messy Workspace")
The Canvas should be a frictionless dumping ground for the active learning session. It does NOT need to be heavily formatted or pretty.

**Key Features for the Canvas:**
- **Frictionless Entry:** Paste text, docs, ChatGPT snippets, links, and code easily.
- **The Generation Step:** Before consolidation, the user must provide a short, rough summary (or code snippet) in their own words. This is the 30-second cognitive effort step. We could have a dedicated "My Understanding" block on the canvas to encourage this.
- **Action:** A prominent "Consolidate Session" button that triggers the AI pipeline.

## 3. The AI Consolidation Pipeline
When the user clicks "Consolidate Session," the AI shouldn't just format notes. It should execute a multi-step pipeline:

1. **Note Generation:** Transforms the raw canvas (anchored by the user's rough summary) into a structured knowledge note.
2. **Recall Prompt Generation:** Analyzes the topic and generates active-recall questions (e.g., "Explain X in your own words" or "Write a small code example for Y").
3. **Knowledge Graph Update (The Secret Sauce):** The AI extracts core concepts from the session, logs them, and connects them to the user's past history. 

## 4. Architectural Implications (What we need to build)
To support this "AI with Memory", we need to expand our database schema. We currently have `Workspace` and `QuickNote`. We will likely need:

- `Topic` / `Note`: The polished output of a session.
- `Concept`: The atomic ideas (e.g., "Generics", "Conditional Types").
- `UserConceptMastery`: Tracks how well the user knows a concept, past mistakes, and spaced repetition data (Next Review Date, Mastery Score).
- `RecallPrompt`: The specific questions/exercises tied to a topic used during revision.

## 5. The Revision UI (Active Recall First)
When a user does a revision session:
1. **Prompt First:** Show the `RecallPrompt` (e.g., "Try writing a type guard from memory"). The polished note is hidden.
2. **Reveal & Grade:** User clicks "Reveal" to see the note, then self-grades their understanding.
3. **Schedule:** The spaced repetition algorithm schedules the next review based on the grade.

---

### Open Questions & Options for Implementation
Before we begin the technical implementation (`staging_plan.md`), I'd like your feedback on the following:

**Option A: The Linear Scratchpad vs. 2D Spatial Canvas**
Does the Canvas need to be an infinite 2D spatial board (like Miro/Excalidraw), or is a linear "block-based" document (like Notion/Roam but messy) sufficient and lower-friction? 
*Recommendation: A linear block-based approach is much faster to build and easier for pasting/reading raw text and code snippets, whereas 2D canvases can get clunky with heavy text.*

**Option B: Context Injection for Future Learning**
To achieve the "companion with memory" feature, we need to pass the user's recent history and struggles to the AI whenever they hit "Consolidate". This means storing a rolling summary of their learning state. Does this sound like the right approach for the prompt engineering?

Please review this analysis. If this aligns with your vision, let me know your thoughts on the options, and approve with "Proceed" so we can move to the technical `staging_plan.md`.
