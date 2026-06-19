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
        this.notify();
    }

    stopDrag() {
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
    }
}

export const createDragController = () => new DragController();
