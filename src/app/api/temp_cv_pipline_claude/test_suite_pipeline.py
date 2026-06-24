"""
test_pipeline.py
=================
Test suite for the Note Image Enhancement Pipeline.
Validates every stage independently and the full end-to-end flow.

Run:
    python3 tests/test_pipeline.py
    python3 tests/test_pipeline.py --visual   # Also save visual diffs
"""

from __future__ import annotations

import sys
import os
import time
import argparse
import textwrap
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

# ── Path setup ────────────────────────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
SRC  = ROOT / "src"
sys.path.insert(0, str(SRC))

from pipeline import (
    NoteImagePipeline, PipelineConfig, OutputMode, process_note
)

# ── Test helpers ──────────────────────────────────────────────────────────────

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
INFO = "\033[94mℹ\033[0m"

passed = 0
failed = 0

def check(name: str, condition: bool, detail: str = ""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  {PASS} {name}")
    else:
        failed += 1
        print(f"  {FAIL} {name}", f"({detail})" if detail else "")


def section(title: str):
    print(f"\n{'─'*50}")
    print(f"  {title}")
    print(f"{'─'*50}")


# ── Test image generators ─────────────────────────────────────────────────────

def make_note_image(
    width=600, height=800, ink_color=(30, 30, 100), paper_color=(252, 248, 238),
    lighting_variation=0.12, noise_std=5.0, seed=42
) -> np.ndarray:
    """
    Synthesize a realistic phone-photo-of-handwritten-note image.
    Returns RGB numpy array.
    """
    np.random.seed(seed)
    h, w = height, width

    # Paper base
    img = np.ones((h, w, 3), dtype=np.float32)
    img[:,:,0] = paper_color[0]
    img[:,:,1] = paper_color[1]
    img[:,:,2] = paper_color[2]

    # Vignetting (uneven phone camera illumination)
    cy, cx = h/2, w/2
    Y, X = np.ogrid[:h, :w]
    vignette = 1.0 - lighting_variation * ((Y-cy)**2/cy**2 + (X-cx)**2/cx**2)
    img *= vignette[:,:,np.newaxis]

    # Paper texture noise
    img += np.random.normal(0, noise_std, (h,w,3))

    # Draw horizontal text lines
    for y_base in range(100, h-100, 55):
        # Wavy baseline
        for x in range(40, w-40):
            y = y_base + int(4 * np.sin(x / 25.0)) + np.random.randint(-1, 2)
            y = np.clip(y, 0, h-1)

            # Ink stroke (2px thick)
            for dy in range(-1, 2):
                yy = np.clip(y + dy, 0, h-1)
                opacity = 0.9 - 0.3 * abs(dy) + np.random.normal(0, 0.05)
                opacity = np.clip(opacity, 0, 1)

                # Skip some pixels (simulate ink skips)
                if np.random.random() > 0.97:
                    continue

                img[yy, x, 0] = ink_color[0] * opacity + img[yy, x, 0] * (1-opacity)
                img[yy, x, 1] = ink_color[1] * opacity + img[yy, x, 1] * (1-opacity)
                img[yy, x, 2] = ink_color[2] * opacity + img[yy, x, 2] * (1-opacity)

    return np.clip(img, 0, 255).astype(np.uint8)


def make_blank_image(w=600, h=600) -> np.ndarray:
    return np.ones((h, w, 3), dtype=np.uint8) * 240


# ── Tests ──────────────────────────────────────────────────────────────────────

def test_load():
    section("Stage 1: Loading")
    pipeline = NoteImagePipeline()

    # From numpy array
    arr = make_note_image()
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    result = pipeline.process(bgr)
    check("Load from numpy BGR array", result.success, result.error or "")

    # From PIL Image
    pil = Image.fromarray(arr)
    result = pipeline.process(pil)
    check("Load from PIL Image", result.success, result.error or "")

    # From bytes
    import io
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=90)
    result = pipeline.process(buf.getvalue())
    check("Load from JPEG bytes", result.success, result.error or "")

    # From file path
    tmp_path = Path("/tmp/test_note_load.jpg")
    pil.save(tmp_path, quality=90)
    result = pipeline.process(tmp_path)
    check("Load from file path", result.success, result.error or "")
    tmp_path.unlink(missing_ok=True)

    # Convenience wrapper
    result = process_note(arr)
    check("process_note() convenience function", result.success, result.error or "")


def test_upscale():
    section("Stage 2: Smart Upscale")
    pipeline = NoteImagePipeline()

    small = make_note_image(300, 400)  # Small image
    result = pipeline.process(small)

    check("Small image processed successfully", result.success)
    if result.image is not None:
        out_h, out_w = result.image.shape[:2]
        # Output should be based on output_resolution, not the tiny input
        check(
            f"Output larger than tiny input (out={max(out_h,out_w)}, in={max(300,400)})",
            max(out_h, out_w) > max(300, 400)
        )

    large = make_note_image(3500, 4600)
    result = pipeline.process(large)
    check("Large image processed successfully", result.success)
    if result.image is not None:
        out_h, out_w = result.image.shape[:2]
        cfg = PipelineConfig()
        check(
            f"Large image downscaled to output_res ({max(out_h,out_w)} ≤ {cfg.output_resolution})",
            max(out_h, out_w) <= cfg.output_resolution
        )


def test_ink_detection():
    section("Stage 3: Ink Color Detection")
    pipeline = NoteImagePipeline()

    for ink_name, ink_rgb in [
        ("blue",  (20, 30, 120)),
        ("black", (15, 15, 15)),
        ("red",   (130, 20, 20)),
    ]:
        img = make_note_image(ink_color=ink_rgb)
        result = pipeline.process(img)
        check(f"{ink_name} ink image processed without error", result.success, result.error or "")


def test_background_correction():
    section("Stage 4: Background Illumination Correction")

    # Create an image with severe vignetting
    img_severe = make_note_image(lighting_variation=0.30)
    img_mild   = make_note_image(lighting_variation=0.05)

    pipeline = NoteImagePipeline()
    for name, img in [("severe vignette", img_severe), ("mild vignette", img_mild)]:
        result = pipeline.process(img)
        check(f"Processes {name} successfully", result.success, result.error or "")
        if result.image is not None:
            # After processing, background should be near-white (>200)
            bg_region = result.image[:50, :50]  # Corner (should be paper)
            bg_mean = float(bg_region.mean())
            check(
                f"{name}: background region mean ≥ 200 (got {bg_mean:.0f})",
                bg_mean >= 200
            )


def test_output_modes():
    section("Output Modes")
    img = make_note_image()

    for mode in OutputMode:
        config = PipelineConfig(output_mode=mode)
        result = NoteImagePipeline(config).process(img)
        check(f"Mode '{mode.value}' processes successfully", result.success, result.error or "")

        if result.image is not None:
            check(
                f"Mode '{mode.value}' output has 3 channels",
                result.image.ndim == 3 and result.image.shape[2] == 3
            )


def test_output_formats():
    section("Output Encoding (to_bytes)")
    img = make_note_image()
    result = process_note(img)

    check("Pipeline succeeded", result.success, result.error or "")
    if not result.success:
        return

    for fmt in ["jpeg", "png", "webp"]:
        data = result.to_bytes(fmt=fmt)
        check(f"to_bytes({fmt}) returns non-empty bytes", data is not None and len(data) > 100)

    pil = result.to_pil()
    check("to_pil() returns PIL Image", isinstance(pil, Image.Image))


def test_edge_cases():
    section("Edge Cases")
    pipeline = NoteImagePipeline()

    # Tiny image (might trip up window-size calculations)
    tiny = make_blank_image(50, 50)
    result = pipeline.process(tiny)
    check("50x50 tiny image doesn't crash", result.success, result.error or "")

    # Very dark image (almost all ink)
    dark = np.zeros((400, 600, 3), dtype=np.uint8)
    dark[:,:] = [10, 10, 10]
    result = pipeline.process(dark)
    check("Nearly-black image doesn't crash", result.success, result.error or "")

    # Very bright (overexposed)
    bright = np.ones((400, 600, 3), dtype=np.uint8) * 255
    result = pipeline.process(bright)
    check("All-white image doesn't crash", result.success, result.error or "")

    # Invalid source
    result = pipeline.process("nonexistent_file_xyz.jpg")
    check("Non-existent file returns success=False", not result.success)
    check("Non-existent file has error message", bool(result.error))


def test_performance():
    section("Performance")
    img = make_note_image(1500, 2000)  # Typical phone photo size

    t = time.perf_counter()
    result = process_note(img)
    elapsed = time.perf_counter() - t

    check("Processes 1500x2000 image successfully", result.success, result.error or "")
    check(
        f"Completes in under 60s (took {elapsed:.1f}s)",
        elapsed < 60.0,
        f"Too slow: {elapsed:.1f}s"
    )

    if result.success and result.stages:
        slowest = max(result.stages, key=lambda k: result.stages[k])
        total = result.processing_time_ms
        print(f"\n  {INFO} Stage timings:")
        for stage, ms in sorted(result.stages.items(), key=lambda x: -x[1]):
            bar = "█" * int(ms / total * 30)
            print(f"    {stage:<28} {ms:>7.1f}ms  {bar}")
        print(f"    {'TOTAL':<28} {total:>7.1f}ms")


def test_quality_metrics():
    section("Output Quality Checks")
    img = make_note_image()
    result = process_note(img)

    if not result.success or result.image is None:
        check("Pipeline succeeded for quality test", False, result.error or "")
        return

    out = result.image
    gray_out = cv2.cvtColor(out, cv2.COLOR_RGB2GRAY)

    # Background should be mostly white
    white_ratio = float((gray_out > 200).sum()) / gray_out.size
    check(
        f"Output is mostly white background (white_ratio={white_ratio:.0%} ≥ 60%)",
        white_ratio >= 0.60
    )

    # Should have some ink (dark pixels)
    ink_ratio = float((gray_out < 100).sum()) / gray_out.size
    check(
        f"Output has ink pixels (ink_ratio={ink_ratio:.1%} > 0.1%)",
        ink_ratio > 0.001
    )

    # No pure gray middle ground (bimodal = binary)
    mid_ratio = float(((gray_out > 50) & (gray_out < 200)).sum()) / gray_out.size
    check(
        f"Output is bimodal/binary (mid_gray_ratio={mid_ratio:.1%} < 20%)",
        mid_ratio < 0.20
    )


# ── Visual output (optional) ──────────────────────────────────────────────────

def save_visual_results(output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"\n{INFO} Saving visual results to {output_dir}/")

    img = make_note_image(800, 1100)
    Image.fromarray(img).save(output_dir / "00_original.jpg", quality=90)

    for mode in OutputMode:
        config = PipelineConfig(output_mode=mode)
        result = NoteImagePipeline(config).process(img)
        if result.success:
            pil = result.to_pil()
            if pil:
                pil.save(output_dir / f"01_{mode.value}.jpg", quality=95)
                print(f"  Saved: {mode.value}.jpg")

    # Comparison sheet
    imgs = [Image.open(p) for p in sorted(output_dir.glob("*.jpg"))]
    if imgs:
        w = max(i.width for i in imgs)
        h = sum(i.height for i in imgs) + len(imgs) * 10
        sheet = Image.new("RGB", (w, h), (240, 240, 240))
        y = 0
        for i, im in enumerate(imgs):
            sheet.paste(im, (0, y))
            y += im.height + 10
        sheet.save(output_dir / "comparison.jpg", quality=90)
        print(f"  Saved: comparison.jpg")


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--visual", action="store_true", help="Save visual output to tests/visual/")
    args = parser.parse_args()

    print("\n" + "═"*50)
    print("  Note Pipeline Test Suite")
    print("═"*50)

    test_load()
    test_upscale()
    test_ink_detection()
    test_background_correction()
    test_output_modes()
    test_output_formats()
    test_edge_cases()
    test_performance()
    test_quality_metrics()

    if args.visual:
        save_visual_results(ROOT / "tests" / "visual")

    # Summary
    total = passed + failed
    print(f"\n{'═'*50}")
    print(f"  Results: {passed}/{total} passed", end="")
    if failed:
        print(f"  \033[91m({failed} failed)\033[0m")
    else:
        print(f"  \033[92m(all passed)\033[0m")
    print("═"*50 + "\n")

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()