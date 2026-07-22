# Staging Plan: Canvas Inline Image Gallery

## Goal
Modify the existing infinite canvas to support pasting images directly inside text blocks, and render multiple images side-by-side using a custom Tiptap Node View (ImageGalleryNode).

## Technical Implementation Details

### 1. Fix Global Paste Interception
- **File:** `src/components/canvas/core/SingleCanvas.tsx`
- **Action:** Update the global `paste` event listener. If `isInsideEditor` is true, immediately `return` and do not call `e.preventDefault()`. This lets the Tiptap editor handle the paste event natively.

### 2. Create ImageGalleryNode Extension
- **File:** `src/components/canvas/extensions/ImageGalleryExtension.tsx`
- **Action:** Create a Tiptap `Node.create()` extension named `imageGallery`. It will define an `images` attribute (array of strings) and use `ReactNodeViewRenderer` to render the React component.

### 3. Create ImageGallery React Component
- **File:** `src/components/canvas/blocks/ImageGalleryNode.tsx`
- **Action:** Build a React component that receives the `images` array from the Node View wrapper. Render the images using a Tailwind flexbox/grid layout (e.g., 2 columns if 2 images, 3 if 3+).

### 4. Wire Extension into BlockEditor
- **File:** `src/components/canvas/blocks/BlockEditor.tsx`
- **Action:** 
  1. Add `ImageGalleryExtension` to the `useEditor` extensions array.
  2. Add an `onUploadImage?: (file: File) => Promise<string>` prop.
  3. In `editorProps.handlePaste`, intercept pasted files. If they are images, immediately insert the `imageGallery` node with a temporary object URL, then call `onUploadImage` in the background and update the node attributes when finished.

### 5. Pass onUploadImage from Workspace
- **File:** `src/app/(protected)/topic/[id]/TopicWorkspace.tsx`
- **Action:** Pass the `onUploadImage` callback down through `TopicCanvas` -> `SingleCanvas` -> `CanvasBlockLayer` -> `InlineCursor` -> `BlockEditor`. Use the existing Supabase storage utility (e.g. `uploadImage`) to handle the file upload.
