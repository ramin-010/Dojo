/**
 * Note Image Enhancement API Route
 * ==================================
 * Drop-in replacement for the OpenCV-based route.
 *
 * This route delegates all image processing to the Python pipeline
 * (pipeline.py) which uses Sauvola binarization, NL-Means denoising,
 * background division, and CLAHE — all running in a subprocess.
 *
 * Why Python subprocess instead of OpenCV-JS?
 *  - scikit-image's Sauvola implementation is heavily optimized (Cython)
 *  - OpenCV's fastNlMeansDenoising has no JS equivalent
 *  - Full NumPy float64 precision for BG division (JS version was int math)
 *  - Easier to tune and extend without recompiling WASM
 *
 * API:
 *   POST /api/process-note
 *   Content-Type: multipart/form-data
 *
 * Form fields:
 *   file         (required) - image file
 *   mode         (optional) - "binary" | "grayscale" | "cream"  [default: "binary"]
 *   denoise      (optional) - "light" | "medium" | "strong"     [default: "medium"]
 *   output_format (optional)- "jpeg" | "png" | "webp"           [default: "jpeg"]
 *
 * Response:
 *   { url: "data:image/jpeg;base64,..." }
 *   or
 *   { error: "..." }
 */

import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, readFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

// ─── Types ────────────────────────────────────────────────────────────────────

type OutputMode = "binary" | "grayscale" | "cream";
type DenoiseLevel = "light" | "medium" | "strong";
type OutputFormat = "jpeg" | "png" | "webp";

interface ProcessRequest {
  mode: OutputMode;
  denoise: DenoiseLevel;
  outputFormat: OutputFormat;
}

// ─── Config mapping ───────────────────────────────────────────────────────────

const DENOISE_MAP: Record<DenoiseLevel, number> = {
  light: 5,
  medium: 7,
  strong: 12,
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let tmpDir: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Parse options with defaults
    const mode = (formData.get("mode") as OutputMode) || "binary";
    const denoise = (formData.get("denoise") as DenoiseLevel) || "medium";
    const outputFormat = (formData.get("output_format") as OutputFormat) || "jpeg";

    // Validate mode
    if (!["binary", "grayscale", "cream"].includes(mode)) {
      return NextResponse.json({ error: `Invalid mode: ${mode}` }, { status: 400 });
    }

    // ── Write uploaded file to temp dir ──────────────────────────────────
    tmpDir = await mkdtemp(join(tmpdir(), "note-pipeline-"));
    const inputExt = file.name.split(".").pop() || "jpg";
    const inputPath = join(tmpDir, `input.${inputExt}`);
    const outputPath = join(tmpDir, `output.${outputFormat}`);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(inputPath, buffer);

    // ── Build Python command ──────────────────────────────────────────────
    // Use the pipeline CLI (pipeline_cli.py) which accepts all config as args
    const pythonScript = join(process.cwd(), "src", "pipeline_cli.py");
    const denoiseStrength = DENOISE_MAP[denoise] ?? 7;

    const args = [
      `"${inputPath}"`,
      `"${outputPath}"`,
      `--mode ${mode}`,
      `--denoise-strength ${denoiseStrength}`,
      `--format ${outputFormat}`,
    ].join(" ");

    const command = `python3 ${pythonScript} ${args}`;

    // ── Run Python pipeline ───────────────────────────────────────────────
    const { stdout, stderr } = await execAsync(command, {
      timeout: 60_000, // 60 second timeout
      maxBuffer: 1024 * 1024 * 10, // 10MB output buffer
    });

    if (stderr && !stderr.includes("WARNING")) {
      // Log warnings but don't fail on them
      console.warn("[note-pipeline] stderr:", stderr);
    }

    // ── Read output and encode ────────────────────────────────────────────
    const processedBuffer = await readFile(outputPath);
    const mimeType =
      outputFormat === "png"
        ? "image/png"
        : outputFormat === "webp"
        ? "image/webp"
        : "image/jpeg";

    const base64 = processedBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    // Parse timing from stdout if available
    let timingMs: number | undefined;
    const timingMatch = stdout.match(/processing_time_ms=([\d.]+)/);
    if (timingMatch) {
      timingMs = parseFloat(timingMatch[1]);
    }

    return NextResponse.json({
      url: dataUrl,
      timing_ms: timingMs,
    });

  } catch (error: any) {
    console.error("[note-pipeline] Error:", error);

    // Distinguish timeout from other errors
    if (error.killed || error.signal === "SIGTERM") {
      return NextResponse.json(
        { error: "Processing timed out. Try a smaller image." },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Processing failed" },
      { status: 500 }
    );
  } finally {
    // ── Cleanup temp files ────────────────────────────────────────────────
    if (tmpDir) {
      try {
        const { rm } = await import("fs/promises");
        await rm(tmpDir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup, non-fatal
      }
    }
  }
}