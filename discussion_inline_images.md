# Discussion: Inline Images & Image Gallery (Canvas Architecture)

Since we are sticking to the existing infinite canvas, our goal is to allow pasting images *inside* a text block, and allowing multiple images side-by-side, without breaking the current spatial canvas.

You asked to fully understand the flow first before we rush into implementation. Here is a breakdown of how it works right now, and how we need to change it.

## The Current Flow (Why it creates new blocks)
Right now, if you are typing inside a text block and hit `Cmd+V / Ctrl+V` to paste an image, here is what happens:
1. A global `paste` event listener fires in `SingleCanvas.tsx`.
2. It loops through your clipboard items. If it sees an image file, it calls `e.preventDefault()` (stopping the editor from receiving it).
3. It calls `onAddImage(canvasId, file, x, y)`.
4. This creates a brand new Canvas Block of type `'image'` sitting on top of the canvas, completely separate from the text you were just typing.

## The Proposed Flow (How we fix it)

To allow images *inside* your text blocks (and allow multiple in a row), we need to do two things:

### Step 1: Let the Editor Handle Its Own Pastes
In `SingleCanvas.tsx`, we already have a check called `isInsideEditor`. We need to change the logic so that **if you are actively typing inside a block**, the global canvas ignores the paste event and lets the Tiptap editor handle the image natively.
- **If clicking the background & pasting:** Creates a separate Canvas Image Block.
- **If typing in a text block & pasting:** Inserts the image *inline* inside the text.

### Step 2: The Tiptap `ImageGalleryNode`
By default, Tiptap just drops an `<img>` tag in the text. To get the "multiple images in a row" Notion-style layout, we will build a custom Tiptap extension:
1. We create a custom React Node View (`ImageGalleryNode.tsx`).
2. We configure it to accept an array of image URLs.
3. When you paste an image into the editor, we intercept it inside Tiptap, upload it, and add it to the `ImageGalleryNode`.
4. The React component renders those images beautifully side-by-side using CSS Grid or Flexbox.

---
**Next Steps:**
Please review this flow. Does this perfectly capture how you want images to behave inside the canvas blocks? If everything makes sense, reply with **"Proceed"** and we can plan out the code changes.
