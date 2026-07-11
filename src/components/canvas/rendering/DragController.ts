export class DragController {
    isDragging: boolean = false;
    activeOffset: { x: number, y: number } | null = null;
    private _activeId: string | null = null;
    private listeners: ((isDragging: boolean, id: string | null) => void)[] = [];

    get activeId() {
        return this._activeId;
    }

    startDrag(id: string, x?: number, y?: number) {
        this.isDragging = true;
        this._activeId = id;
        if (x !== undefined && y !== undefined) {
            this.activeOffset = { x, y };
        } else {
            this.activeOffset = null;
        }

        // Imperative GPU fast-path: promote the dragged block to its own
        // compositor layer and strip backdrop-filter for the duration of the drag.
        // This avoids per-frame blur recomputation and repaint of the block's
        // entire DOM subtree (which can be thousands of pixels tall for large blocks).
        if (typeof document !== 'undefined') {
            const el = document.getElementById(`smart-block-${id}`);
            if (el) {
                el.style.willChange = 'transform';
                el.dataset.dragging = 'true';
            }
        }

        this.notify();
    }

    stopDrag() {
        // Restore normal rendering on the previously-dragged block
        if (typeof document !== 'undefined' && this._activeId) {
            const el = document.getElementById(`smart-block-${this._activeId}`);
            if (el) {
                el.style.willChange = '';
                delete el.dataset.dragging;
            }
        }

        this.isDragging = false;
        this._activeId = null;
        this.notify();
    }

    update(id: string, x: number, y: number) {
        if (this._activeId !== id) return;
        this.activeOffset = { x, y };
    }

    subscribe(callback: (isDragging: boolean, id: string | null) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    private notify() {
        this.listeners.forEach(cb => cb(this.isDragging, this._activeId));
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('canvas-drag-state', { detail: { isDragging: this.isDragging } }));
        }
    }
}

export const createDragController = () => new DragController();
