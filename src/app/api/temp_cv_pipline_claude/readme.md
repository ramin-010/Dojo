# Note Image Enhancement Pipeline

Converts phone photos of handwritten notes into clean, print-quality digital documents.
Built to replace a basic OpenCV pipeline with a research-grade approach.

## What it produces

| Mode | Look | Best for |
|------|------|----------|
| **Binary** | Pure black ink on white | Maximum clarity, printing |
| **Grayscale** | Soft dark ink on white | Natural feel, everyday reading |
| **Cream** | Navy ink on off-white | Long reading sessions, eye strain |

## Architecture

```
Input (any format)
     │
     ▼
1. Load + EXIF rotate          PIL — handles HEIC, JPEG, PNG, WebP, etc.
     │
     ▼
2. Smart upscale               Lanczos 4 → 3000px long side
     │                         (Sauvola needs resolution to work well)
     ▼
3. Ink-color-aware gray        Detects blue/black/red ink
     │                         Blue ink → weighted toward blue channel
     │                         for much better ink/paper separation
     ▼
4. Background division         True division: pixel / blurred_background
     │                         Removes shadows, vignetting, phone flash
     │                         Result: perfectly flat, uniform paper tone
     ▼
5. CLAHE                       Local contrast boost in 16x16 grid
     │                         Rescues faint/faded strokes
     ▼
6. Guided filter denoise       cv2.ximgproc.guidedFilter
     │                         Edge-preserving, 27x faster than NL-Means
     │                         Paper grain → gone; stroke edges → razor sharp
     ▼
7. Unsharp mask                Adds back amplified high-frequency detail
     │                         Strokes become confident and crisp
     ▼
8. Sauvola binarization        T(x,y) = m * [1 + k * (σ/R - 1)]
     │                         Gold standard for handwriting (Sauvola 2000)
     │                         Self-calibrates to local brightness AND variance
     │                         Handles everything from pencil to thick marker
     ▼
9. Morphological cleanup       Open: removes isolated noise dots
     │                         Close: reconnects broken strokes
     ▼
10. Render + downscale         Apply output mode (binary/gray/cream)
     │                         Scale to output_resolution (default 2400px)
     ▼
Output (JPEG/PNG/WebP)
```

## File structure

```
src/
  pipeline.py        Core pipeline — import this in Python
  pipeline_cli.py    CLI wrapper — called by route.ts as subprocess
  route.ts           Next.js API route — drop-in replacement for your current one
  NoteUploader.tsx   React component with drag-drop, mode selector, comparison view

tests/
  test_pipeline.py   Full test suite (37 tests)
  visual/            Auto-generated visual comparisons

requirements.txt     Python dependencies
```

## Integration

### Drop-in replacement for your current route.ts

Replace `app/api/process-note/route.ts` with `src/route.ts`.
Place `src/pipeline.py` and `src/pipeline_cli.py` in your project's `src/` folder.

```bash
pip install -r requirements.txt
```

### API

```
POST /api/process-note
Content-Type: multipart/form-data

file            (required)  Image file
mode            (optional)  binary | grayscale | cream     [default: binary]
denoise         (optional)  light | medium | strong        [default: medium]  
output_format   (optional)  jpeg | png | webp              [default: jpeg]
```

Response:
```json
{ "url": "data:image/jpeg;base64,...", "timing_ms": 1946 }
```

### Direct Python usage

```python
from pipeline import process_note, PipelineConfig, OutputMode

# Simple one-liner
result = process_note("photo.jpg")
result.to_pil().save("clean.jpg")

# With custom config
config = PipelineConfig(
    output_mode=OutputMode.CREAM,
    denoise_strength=12.0,      # Heavier denoising for grainy photos
    sauvola_k=0.10,             # Lower k = keep more faint strokes (pencil)
    output_resolution=3000,     # Higher res output
)
result = process_note("photo.jpg", config=config)

# Check timing
print(result.processing_time_ms)   # e.g. 1946.3
print(result.stages)               # Per-stage breakdown
```

## Performance

Typical timing for a 1500×2000 phone photo (3000px processing resolution):

| Stage | Time | Note |
|-------|------|------|
| Load + upscale | ~155ms | Lanczos upscale to 3000px |
| Ink detection + grayscale | ~180ms | Channel-weighted conversion |
| Background division | ~520ms | Large Gaussian blur |
| CLAHE | ~40ms | Fast |
| Guided filter denoise | ~210ms | 27× faster than NL-Means |
| Sauvola binarization | ~800ms | Cython-optimized in skimage |
| Morphological cleanup | ~5ms | Fast |
| Render + downscale | ~30ms | Fast |
| **Total** | **~2.0s** | |

Previous OpenCV pipeline: >8s due to NL-Means denoising.

## Tuning guide

| Situation | Recommended change |
|-----------|--------------------|
| Pencil notes (faint) | `sauvola_k=0.10`, `denoise_strength=5.0` |
| Bold marker | `sauvola_k=0.20`, `morph_open_radius=2` |
| Bad lighting / shadows | `bg_blur_fraction=0.07` |
| Rough paper / grain | `denoise_strength=12.0` |
| Very small writing | `sauvola_window_fraction=0.015` |
| Output too dark | Increase `sauvola_k` slightly |
| Output too light (missing strokes) | Decrease `sauvola_k` slightly |