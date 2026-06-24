/**
 * NoteUploader.tsx
 * ==================
 * React component for uploading and processing handwritten note photos.
 *
 * Features:
 *  - Drag & drop or click to upload
 *  - Mode selector: Binary / Grayscale / Cream
 *  - Denoise level selector
 *  - Side-by-side comparison view (original vs. processed)
 *  - Download processed image
 *  - Processing time display
 */

"use client";

import React, { useState, useCallback, useRef } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

type OutputMode = "binary" | "grayscale" | "cream";
type DenoiseLevel = "light" | "medium" | "strong";

interface ProcessingState {
  status: "idle" | "processing" | "done" | "error";
  originalUrl: string | null;
  processedUrl: string | null;
  timingMs: number | null;
  error: string | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const MODE_OPTIONS: { value: OutputMode; label: string; description: string }[] = [
  {
    value: "binary",
    label: "Binary",
    description: "Pure black & white — maximum clarity",
  },
  {
    value: "grayscale",
    label: "Grayscale",
    description: "Soft dark ink — natural feel",
  },
  {
    value: "cream",
    label: "Cream",
    description: "Off-white paper — easiest on eyes",
  },
];

const DENOISE_OPTIONS: { value: DenoiseLevel; label: string }[] = [
  { value: "light", label: "Light (pencil, sharp photos)" },
  { value: "medium", label: "Medium (typical phone photo)" },
  { value: "strong", label: "Strong (grainy / bad lighting)" },
];

// ─── Component ──────────────────────────────────────────────────────────────────

export default function NoteUploader() {
  const [mode, setMode] = useState<OutputMode>("binary");
  const [denoise, setDenoise] = useState<DenoiseLevel>("medium");
  const [state, setState] = useState<ProcessingState>({
    status: "idle",
    originalUrl: null,
    processedUrl: null,
    timingMs: null,
    error: null,
  });
  const [showComparison, setShowComparison] = useState(false);
  const [sliderPos, setSliderPos] = useState(50);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDragging = useRef(false);

  // ── Upload handler ────────────────────────────────────────────────────────
  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setState((s) => ({
          ...s,
          status: "error",
          error: "Please upload an image file (JPG, PNG, HEIC, etc.)",
        }));
        return;
      }

      // Show original immediately
      const originalUrl = URL.createObjectURL(file);
      setState({
        status: "processing",
        originalUrl,
        processedUrl: null,
        timingMs: null,
        error: null,
      });

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("mode", mode);
        formData.append("denoise", denoise);
        formData.append("output_format", "jpeg");

        const response = await fetch("/api/process-note", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok || data.error) {
          throw new Error(data.error || `Server error ${response.status}`);
        }

        setState({
          status: "done",
          originalUrl,
          processedUrl: data.url,
          timingMs: data.timing_ms ?? null,
          error: null,
        });
        setShowComparison(false);
      } catch (err: any) {
        setState((s) => ({
          ...s,
          status: "error",
          error: err.message || "Processing failed",
        }));
      }
    },
    [mode, denoise]
  );

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      isDragging.current = false;
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    isDragging.current = true;
  };

  // ── Comparison slider ─────────────────────────────────────────────────────
  const handleSlider = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  };

  // ── Download ──────────────────────────────────────────────────────────────
  const downloadProcessed = () => {
    if (!state.processedUrl) return;
    const a = document.createElement("a");
    a.href = state.processedUrl;
    a.download = `note-cleaned-${mode}.jpg`;
    a.click();
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Note Enhancer</h1>
          <p className="text-gray-500 mt-1">
            Upload a photo of your handwritten notes — get a clean, print-quality digital version
          </p>
        </div>

        {/* Options row */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
          {/* Output mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Output style
            </label>
            <div className="grid grid-cols-3 gap-3">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  className={[
                    "flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all",
                    mode === opt.value
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 bg-white",
                  ].join(" ")}
                >
                  <span className="font-medium text-sm text-gray-900">
                    {opt.label}
                  </span>
                  <span className="text-xs text-gray-500 mt-0.5">
                    {opt.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Denoise level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Denoising level
            </label>
            <div className="flex gap-2">
              {DENOISE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDenoise(opt.value)}
                  className={[
                    "flex-1 py-2 px-3 rounded-lg text-sm border-2 transition-all",
                    denoise === opt.value
                      ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                      : "border-gray-200 text-gray-600 hover:border-gray-300",
                  ].join(" ")}
                >
                  {opt.value.charAt(0).toUpperCase() + opt.value.slice(1)}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1.5">
              {DENOISE_OPTIONS.find((o) => o.value === denoise)?.label}
            </p>
          </div>
        </div>

        {/* Upload area */}
        <div
          className="bg-white rounded-2xl shadow-sm border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) processFile(file);
            }}
          />
          <div className="py-12 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
              <svg className="w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-700">
                Drop your note photo here
              </p>
              <p className="text-sm text-gray-400 mt-0.5">
                or click to browse — JPG, PNG, HEIC supported
              </p>
            </div>
          </div>
        </div>

        {/* Status / Results */}
        {state.status === "processing" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="font-medium text-gray-900">Enhancing your notes…</p>
              <p className="text-sm text-gray-400">Running Sauvola binarization + NL-Means denoising</p>
            </div>
          </div>
        )}

        {state.status === "error" && (
          <div className="bg-red-50 rounded-2xl border border-red-200 p-4">
            <p className="text-red-700 font-medium">Processing failed</p>
            <p className="text-red-500 text-sm mt-1">{state.error}</p>
          </div>
        )}

        {state.status === "done" && state.processedUrl && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Result header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="text-green-500">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                <span className="font-medium text-gray-900">Enhancement complete</span>
                {state.timingMs && (
                  <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    {(state.timingMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowComparison((v) => !v)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  {showComparison ? "Hide" : "Compare"} original
                </button>
                <button
                  onClick={downloadProcessed}
                  className="text-sm bg-blue-500 hover:bg-blue-600 text-white font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Download
                </button>
              </div>
            </div>

            {/* Image display */}
            {showComparison ? (
              /* Slider comparison view */
              <div
                className="relative w-full cursor-col-resize select-none"
                style={{ maxHeight: "70vh" }}
                onMouseMove={handleSlider}
              >
                {/* Original (underneath) */}
                <img
                  src={state.originalUrl!}
                  alt="Original"
                  className="w-full h-full object-contain"
                />
                {/* Processed (clipped on top) */}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${sliderPos}%` }}
                >
                  <img
                    src={state.processedUrl}
                    alt="Processed"
                    className="w-full h-full object-contain"
                    style={{ minWidth: `${(100 / sliderPos) * 100}%` }}
                  />
                </div>
                {/* Divider line */}
                <div
                  className="absolute inset-y-0 w-0.5 bg-blue-500 shadow-lg pointer-events-none"
                  style={{ left: `${sliderPos}%` }}
                >
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-md">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l-3 3 3 3M16 9l3 3-3 3" />
                    </svg>
                  </div>
                </div>
                {/* Labels */}
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md pointer-events-none">
                  Enhanced
                </div>
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md pointer-events-none">
                  Original
                </div>
              </div>
            ) : (
              /* Processed only */
              <div className="p-4">
                <img
                  src={state.processedUrl}
                  alt="Processed note"
                  className="w-full rounded-lg"
                  style={{
                    background:
                      mode === "binary" ? "#fff"
                      : mode === "cream" ? "#fdf8f0"
                      : "#fff",
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Tips */}
        <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
          <p className="text-amber-800 font-medium text-sm mb-2">📸 Tips for best results</p>
          <ul className="text-amber-700 text-sm space-y-1 list-disc list-inside">
            <li>Shoot in good natural light — avoid harsh overhead flash</li>
            <li>Hold the phone directly above the note (parallel to paper)</li>
            <li>Fill the frame with the note, leaving a small margin</li>
            <li>Use "Cream" mode for long reading sessions to reduce eye strain</li>
          </ul>
        </div>
      </div>
    </div>
  );
}