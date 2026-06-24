"""
Note Image Enhancement Pipeline
================================
Converts a phone-photographed handwritten note into a clean, print-quality
digital version. Designed to feel like a high-end scanner output.

Pipeline stages:
  1. Load & orient (EXIF-safe)
  2. Smart upscale (ensures enough resolution for clean binarization)
  3. Ink-color-aware grayscale (blue/black/red ink detection)
  4. True background division (removes shadows, uneven lighting perfectly)
  5. CLAHE (local contrast boost)
  6. NL-Means denoising (edge-preserving)
  7. Unsharp mask (crisp strokes)
  8. Sauvola adaptive binarization (gold standard for handwriting)
  9. Morphological cleanup (noise removal + stroke reconnection)
 10. Smart downscale to output resolution
"""

from __future__ import annotations

import io
import logging
import math
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional, Tuple, Union

import cv2
import numpy as np
from PIL import Image, ImageOps
from skimage.filters import threshold_sauvola

logger = logging.getLogger("note_pipeline")


# ─── Configuration ────────────────────────────────────────────────────────────

class OutputMode(str, Enum):
    BINARY   = "binary"    # Pure black & white (smallest file, most readable)
    GRAYSCALE = "grayscale" # Soft gray tones (more natural, less harsh)
    CREAM    = "cream"     # Off-white background (easiest on the eyes)


@dataclass
class PipelineConfig:
    # === Resolution ===
    # Target long-side for internal processing (higher = sharper, slower)
    processing_resolution: int = 3000
    # Target long-side for output image (balance readability vs file size)
    output_resolution: int = 2400

    # === Background Correction ===
    # Fraction of image size for background estimation blur kernel
    # 0.05 = 5% of long side. Larger = more aggressive shadow removal.
    bg_blur_fraction: float = 0.05
    # Target mean intensity after BG division (230 = near-white paper)
    bg_target_brightness: float = 230.0

    # === CLAHE ===
    clahe_clip_limit: float = 1.5
    clahe_tile_grid: int = 16   # Grid divisions per side

    # === Denoising (Guided Filter) ===
    # Denoising strength controls the eps regularization parameter.
    # Value maps as: eps = strength^2
    # 5.0 → eps=25  (light, for pencil or clean phone photos)
    # 7.0 → eps=49  (medium, typical ballpoint + phone photo)
    # 12.0 → eps=144 (heavy, rough paper or bad lighting)
    denoise_strength: float = 7.0
    # Legacy fields kept for API compatibility (not used by guided filter)
    denoise_template_window: int = 7
    denoise_search_window: int = 21

    # === Sharpening (Unsharp Mask) ===
    sharpen_amount: float = 1.8    # Weight of original (>1 = sharpen)
    sharpen_blur_sigma: float = 1.5 # Sigma of the subtracted blur
    sharpen_radius: float = 0.0    # 0 = auto from sigma

    # === Sauvola Binarization ===
    # window_size: odd integer, ~2–3% of image width
    # k: sensitivity. Lower = keep more of faint strokes (0.1–0.3)
    # r: dynamic range of standard deviation (default 128 for uint8)
    sauvola_window_fraction: float = 0.025  # fraction of image width
    sauvola_k: float = 0.15
    sauvola_r: float = 128.0

    # === Morphological Post-processing ===
    # Remove isolated noise dots smaller than this radius
    morph_open_radius: int = 1
    # Close/reconnect stroke gaps smaller than this radius
    morph_close_radius: int = 1

    # === Output ===
    output_mode: OutputMode = OutputMode.BINARY
    # For CREAM mode: background RGB color
    cream_color: Tuple[int, int, int] = (253, 250, 240)
    # For GRAYSCALE mode: intensity of ink (0 = pure black)
    gray_ink_intensity: int = 10
    jpeg_quality: int = 95
    png_compression: int = 6   # 0–9, higher = smaller but slower


# ─── Result dataclass ──────────────────────────────────────────────────────────

@dataclass
class PipelineResult:
    success: bool
    image: Optional[np.ndarray] = None      # Final processed image (H,W,C) RGB
    processing_time_ms: float = 0.0
    stages: dict = field(default_factory=dict)  # Stage timing breakdown
    warnings: list = field(default_factory=list)
    error: Optional[str] = None

    def to_pil(self) -> Optional[Image.Image]:
        if self.image is None:
            return None
        if self.image.ndim == 2:
            return Image.fromarray(self.image, mode="L")
        return Image.fromarray(self.image, mode="RGB")

    def to_bytes(self, fmt: str = "jpeg", **kwargs) -> Optional[bytes]:
        pil = self.to_pil()
        if pil is None:
            return None
        buf = io.BytesIO()
        if fmt.lower() in ("jpg", "jpeg"):
            pil = pil.convert("RGB")
            pil.save(buf, format="JPEG", quality=kwargs.get("quality", 95))
        elif fmt.lower() == "png":
            pil.save(buf, format="PNG", compress_level=kwargs.get("compress_level", 6))
        elif fmt.lower() == "webp":
            pil.save(buf, format="WEBP", quality=kwargs.get("quality", 90), lossless=False)
        buf.seek(0)
        return buf.read()


# ─── Main Pipeline Class ───────────────────────────────────────────────────────

class NoteImagePipeline:
    """
    Transforms a phone photo of handwritten notes into a clean, highly readable
    digital document. Each stage is independently timed and configurable.
    """

    def __init__(self, config: Optional[PipelineConfig] = None):
        self.config = config or PipelineConfig()

    # ── Public entry point ─────────────────────────────────────────────────

    def process(
        self,
        source: Union[str, Path, bytes, np.ndarray, Image.Image],
    ) -> PipelineResult:
        """
        Process a note image from any source format.

        Args:
            source: File path, raw bytes, numpy array (BGR or RGB), or PIL Image.

        Returns:
            PipelineResult with .image (numpy RGB), .to_pil(), .to_bytes()
        """
        t_total = time.perf_counter()
        stages: dict[str, float] = {}
        warnings: list[str] = []

        try:
            # ── Stage 1: Load ──────────────────────────────────────────────
            t = time.perf_counter()
            img_rgb, original_shape = self._load(source)
            stages["load_ms"] = (time.perf_counter() - t) * 1000
            logger.debug("Loaded: %dx%d", img_rgb.shape[1], img_rgb.shape[0])

            # ── Stage 2: Upscale ───────────────────────────────────────────
            t = time.perf_counter()
            img_rgb = self._smart_upscale(img_rgb)
            stages["upscale_ms"] = (time.perf_counter() - t) * 1000

            # ── Stage 3: Ink-aware grayscale ───────────────────────────────
            t = time.perf_counter()
            gray, ink_type = self._to_gray_ink_aware(img_rgb)
            stages["gray_ms"] = (time.perf_counter() - t) * 1000
            logger.debug("Ink type: %s", ink_type)

            # ── Stage 4: Background illumination correction ────────────────
            t = time.perf_counter()
            corrected = self._correct_background(gray)
            stages["bg_correction_ms"] = (time.perf_counter() - t) * 1000

            # ── Stage 5: CLAHE ─────────────────────────────────────────────
            t = time.perf_counter()
            enhanced = self._apply_clahe(corrected)
            stages["clahe_ms"] = (time.perf_counter() - t) * 1000

            # ── Stage 6: NL-Means Denoise ──────────────────────────────────
            t = time.perf_counter()
            denoised = self._denoise(enhanced)
            stages["denoise_ms"] = (time.perf_counter() - t) * 1000

            # ── Stage 7: Unsharp Mask ──────────────────────────────────────
            t = time.perf_counter()
            sharpened = self._sharpen(denoised)
            stages["sharpen_ms"] = (time.perf_counter() - t) * 1000

            # ── Stage 8: Sauvola Binarization ─────────────────────────────
            t = time.perf_counter()
            binary = self._binarize_sauvola(sharpened)
            stages["binarize_ms"] = (time.perf_counter() - t) * 1000

            # ── Stage 9: Morphological cleanup ────────────────────────────
            t = time.perf_counter()
            cleaned = self._morphological_cleanup(binary)
            stages["morph_ms"] = (time.perf_counter() - t) * 1000

            # ── Stage 10: Final render & downscale ────────────────────────
            t = time.perf_counter()
            final = self._render_output(cleaned)
            stages["render_ms"] = (time.perf_counter() - t) * 1000

            total_ms = (time.perf_counter() - t_total) * 1000
            logger.info(
                "Pipeline complete: %dx%d → %dx%d in %.0fms",
                original_shape[1], original_shape[0],
                final.shape[1], final.shape[0],
                total_ms,
            )

            return PipelineResult(
                success=True,
                image=final,
                processing_time_ms=total_ms,
                stages=stages,
                warnings=warnings,
            )

        except Exception as exc:  # noqa: BLE001
            logger.exception("Pipeline failed")
            return PipelineResult(
                success=False,
                error=str(exc),
                processing_time_ms=(time.perf_counter() - t_total) * 1000,
                stages=stages,
                warnings=warnings,
            )

    # ── Stage implementations ──────────────────────────────────────────────

    def _load(self, source: Union[str, Path, bytes, np.ndarray, Image.Image]):
        """Load from any source into RGB numpy array."""
        if isinstance(source, np.ndarray):
            # Accept BGR (OpenCV) or RGB
            if source.ndim == 2:
                img_rgb = cv2.cvtColor(source, cv2.COLOR_GRAY2RGB)
            elif source.shape[2] == 4:
                img_rgb = cv2.cvtColor(source, cv2.COLOR_BGRA2RGB)
            else:
                img_rgb = cv2.cvtColor(source, cv2.COLOR_BGR2RGB)
        elif isinstance(source, Image.Image):
            img_rgb = np.array(source.convert("RGB"))
        elif isinstance(source, (str, Path)):
            # Use PIL so EXIF rotation is handled natively
            with Image.open(source) as pil_img:
                pil_img = ImageOps.exif_transpose(pil_img)
                img_rgb = np.array(pil_img.convert("RGB"))
        elif isinstance(source, (bytes, bytearray)):
            arr = np.frombuffer(source, dtype=np.uint8)
            bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if bgr is None:
                # Fallback to PIL for formats OpenCV can't handle
                with Image.open(io.BytesIO(source)) as pil_img:
                    pil_img = ImageOps.exif_transpose(pil_img)
                    img_rgb = np.array(pil_img.convert("RGB"))
            else:
                img_rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        else:
            raise ValueError(f"Unsupported source type: {type(source)}")

        original_shape = img_rgb.shape
        return img_rgb, original_shape

    def _smart_upscale(self, img: np.ndarray) -> np.ndarray:
        """
        Upscale small images to the processing resolution using Lanczos.
        Sauvola binarization and unsharp mask both benefit greatly from
        having more pixels to work with.
        """
        h, w = img.shape[:2]
        long_side = max(h, w)
        target = self.config.processing_resolution

        if long_side >= target:
            return img  # Already large enough

        scale = target / long_side
        new_w = math.ceil(w * scale)
        new_h = math.ceil(h * scale)
        upscaled = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
        logger.debug("Upscaled %dx%d → %dx%d (%.2fx)", w, h, new_w, new_h, scale)
        return upscaled

    def _to_gray_ink_aware(self, img_rgb: np.ndarray) -> Tuple[np.ndarray, str]:
        """
        Convert to grayscale with channel weighting tuned to the detected ink color.

        Blue ink on warm paper: boosting the blue channel dramatically increases
        contrast between ink and paper vs. standard luminance weights.

        Returns (grayscale_array, ink_type_string)
        """
        r = img_rgb[:, :, 0].astype(np.float32)
        g = img_rgb[:, :, 1].astype(np.float32)
        b = img_rgb[:, :, 2].astype(np.float32)

        # Quick luminance pass to find ink pixels
        lum = 0.299 * r + 0.587 * g + 0.114 * b
        # Ink = darkest 20% of pixels
        threshold = np.percentile(lum, 20)
        ink_mask = lum < threshold

        if ink_mask.sum() < 200:
            # Very bright image, fall back to luminance
            gray = lum.clip(0, 255).astype(np.uint8)
            return gray, "unknown"

        mr = float(r[ink_mask].mean())
        mg = float(g[ink_mask].mean())
        mb = float(b[ink_mask].mean())

        # Identify dominant ink channel by which is LOWEST in ink region
        # (lower value in ink = more ink absorption = that color is the ink)
        min_channel = min(mr, mg, mb)

        if mb == min_channel and mb < mr - 8 and mb < mg - 8:
            # Blue ink (most common: ballpoint, rollerball)
            # Boost blue channel separation
            gray = (0.10 * r + 0.10 * g + 0.80 * b).clip(0, 255).astype(np.uint8)
            ink_type = "blue"
        elif mr == min_channel and mr < mg - 8 and mr < mb - 8:
            # Red/maroon ink
            gray = (0.80 * r + 0.10 * g + 0.10 * b).clip(0, 255).astype(np.uint8)
            ink_type = "red"
        elif mg == min_channel and mg < mr - 8 and mg < mb - 8:
            # Green ink
            gray = (0.10 * r + 0.80 * g + 0.10 * b).clip(0, 255).astype(np.uint8)
            ink_type = "green"
        else:
            # Black/dark ink: standard perceptual luminance
            gray = (0.299 * r + 0.587 * g + 0.114 * b).clip(0, 255).astype(np.uint8)
            ink_type = "black"

        logger.debug("Ink RGB in dark region: R=%.0f G=%.0f B=%.0f → %s", mr, mg, mb, ink_type)
        return gray, ink_type

    def _correct_background(self, gray: np.ndarray) -> np.ndarray:
        """
        Background illumination correction using true division.

        A large Gaussian blur estimates the paper (background only).
        Dividing the original by this estimate removes shadows, vignetting,
        and uneven phone flash — the same technique used by Adobe Scan.

        Result: near-uniform background regardless of lighting conditions.
        """
        h, w = gray.shape
        long_side = max(h, w)

        # Kernel size: large enough to blur out all ink, keep paper tone
        # At least 101 pixels, at most ~200, always odd
        k = int(long_side * self.config.bg_blur_fraction)
        k = max(k, 51)
        k = min(k, 201)
        if k % 2 == 0:
            k += 1

        # Use a very large GaussianBlur (approximates mean background)
        background = cv2.GaussianBlur(gray, (k, k), 0)

        # True division normalization
        gray_f = gray.astype(np.float64)
        bg_f = background.astype(np.float64)

        # Divide and scale to target brightness
        corrected_f = (gray_f / np.maximum(bg_f, 1.0)) * self.config.bg_target_brightness
        corrected = np.clip(corrected_f, 0, 255).astype(np.uint8)

        logger.debug(
            "BG correction: kernel=%d, output mean=%.1f",
            k, float(corrected.mean())
        )
        return corrected

    def _apply_clahe(self, gray: np.ndarray) -> np.ndarray:
        """
        Contrast Limited Adaptive Histogram Equalization.

        Boosts local contrast in small tiles independently — fixes regions
        where background and ink are similar in brightness (e.g. faded notes,
        light pencil). The clip limit prevents over-amplifying noise.
        """
        clahe = cv2.createCLAHE(
            clipLimit=self.config.clahe_clip_limit,
            tileGridSize=(self.config.clahe_tile_grid, self.config.clahe_tile_grid),
        )
        return clahe.apply(gray)

    def _denoise(self, gray: np.ndarray) -> np.ndarray:
        """
        Guided Image Filter denoising — edge-preserving, fast, and high quality.

        Guided filter is the ideal denoiser for this task:
         - Preserves ink stroke edges perfectly (edge correlation ≈ 1.0)
         - ~27x faster than NL-Means at equivalent visual quality
         - Works by fitting local linear models using the image as its own guide
         - Unlike Gaussian/Median blur: edges are not softened

        The denoise_strength config maps to the filter's eps (regularization):
          Low eps  → less smoothing, preserves fine detail (pencil notes)
          High eps → more smoothing, removes grain (bad lighting, rough paper)

        Typical timing: ~250ms for a 3000px image (vs 6800ms for NL-Means)
        """
        # Map denoise_strength (5–15) to eps range (20–120)
        # eps controls how aggressively it smooths across edges
        eps = float(self.config.denoise_strength) ** 2  # 25 → 225
        eps = min(max(eps, 20), 225)

        # radius: spatial extent of smoothing (~5–9 for typical notes)
        radius = 8

        return cv2.ximgproc.guidedFilter(
            guide=gray,
            src=gray,
            radius=radius,
            eps=eps,
        )

    def _sharpen(self, gray: np.ndarray) -> np.ndarray:
        """
        Unsharp Mask sharpening to give strokes a crisp, confident appearance.

        Formula: sharpened = amount * original - (amount - 1) * blurred
        This is mathematically equivalent to: original + amount * (original - blurred)
        i.e. we add back the high-frequency details at amplified strength.

        Best applied BEFORE binarization so that stroke edges have a steep
        gradient — Sauvola finds clean ink/paper boundaries more accurately.
        """
        sigma = self.config.sharpen_blur_sigma
        blurred = cv2.GaussianBlur(gray, (0, 0), sigma)
        sharpened = cv2.addWeighted(
            gray, self.config.sharpen_amount,
            blurred, -(self.config.sharpen_amount - 1.0),
            0,
        )
        return sharpened

    def _binarize_sauvola(self, gray: np.ndarray) -> np.ndarray:
        """
        Sauvola Adaptive Binarization — the academic gold standard for
        handwritten document binarization (Sauvola & Pietikäinen, 2000).

        Unlike Otsu (global threshold) or OpenCV's adaptiveThreshold (simple
        local mean), Sauvola uses:

            T(x,y) = m(x,y) * [1 + k * (σ(x,y)/R - 1)]

        Where m = local mean, σ = local std dev, R = dynamic range, k = sensitivity.

        This self-calibrates to both the local brightness AND local variance:
        - In bright, low-variance regions (blank paper): high threshold → no false positives
        - In dark, high-variance regions (ink on paper): lower threshold → captures faint strokes
        - Result: handles everything from light pencil to bold marker uniformly
        """
        h, w = gray.shape

        # Window: should be ~2–3% of image width, always odd
        win = int(w * self.config.sauvola_window_fraction)
        win = max(win, 31)  # Minimum 31 pixels
        win = min(win, 201)  # Maximum 201 pixels
        if win % 2 == 0:
            win += 1

        thresh = threshold_sauvola(
            gray,
            window_size=win,
            k=self.config.sauvola_k,
            r=self.config.sauvola_r,
        )

        # Binary: True = ink, False = paper
        binary_ink = gray < thresh  # True where pixel is ink

        # Convert to uint8: 255 = ink, 0 = paper (for morphology)
        result = binary_ink.astype(np.uint8) * 255

        ink_pct = float(result.mean()) / 255 * 100
        logger.debug("Sauvola: window=%d, k=%.2f, ink_coverage=%.1f%%", win, self.config.sauvola_k, ink_pct)

        return result

    def _morphological_cleanup(self, binary: np.ndarray) -> np.ndarray:
        """
        Two-pass morphological refinement:

        Pass 1 — OPEN (erode then dilate): removes isolated noise pixels
          that are smaller than the structuring element. Dots, specs, grain.

        Pass 2 — CLOSE (dilate then erode): fills tiny gaps in strokes,
          reconnecting broken letters that Sauvola split.

        Using elliptical kernels (vs. rectangular) is better for curved ink
        strokes — the shape of the structuring element matches the subject.
        """
        r_open = self.config.morph_open_radius
        r_close = self.config.morph_close_radius

        if r_open > 0:
            k = cv2.getStructuringElement(
                cv2.MORPH_ELLIPSE, (r_open * 2 + 1, r_open * 2 + 1)
            )
            binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, k)

        if r_close > 0:
            k = cv2.getStructuringElement(
                cv2.MORPH_ELLIPSE, (r_close * 2 + 1, r_close * 2 + 1)
            )
            binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, k)

        return binary

    def _render_output(self, binary_ink: np.ndarray) -> np.ndarray:
        """
        Convert binary ink mask to the desired output mode and scale.

        Modes:
          BINARY   → pure black & white. Maximum clarity, smallest file.
          GRAYSCALE→ ink rendered as near-black gray. Slightly softer.
          CREAM    → off-white paper color. Easiest on eyes for long reading.
        """
        cfg = self.config

        # Downscale if needed
        h, w = binary_ink.shape
        long_side = max(h, w)
        if long_side > cfg.output_resolution:
            scale = cfg.output_resolution / long_side
            new_w = int(w * scale)
            new_h = int(h * scale)
            binary_ink = cv2.resize(
                binary_ink, (new_w, new_h), interpolation=cv2.INTER_AREA
            )
            # Re-threshold after downscale (anti-aliasing can introduce gray)
            _, binary_ink = cv2.threshold(binary_ink, 127, 255, cv2.THRESH_BINARY)

        ink_mask = binary_ink == 255  # True where ink

        if cfg.output_mode == OutputMode.BINARY:
            # Black ink (0) on white paper (255)
            canvas = np.full(binary_ink.shape, 255, dtype=np.uint8)
            canvas[ink_mask] = 0
            # Return as RGB (3 channels) for consistent API
            return cv2.cvtColor(canvas, cv2.COLOR_GRAY2RGB)

        elif cfg.output_mode == OutputMode.GRAYSCALE:
            canvas = np.full(binary_ink.shape, 255, dtype=np.uint8)
            canvas[ink_mask] = cfg.gray_ink_intensity
            return cv2.cvtColor(canvas, cv2.COLOR_GRAY2RGB)

        elif cfg.output_mode == OutputMode.CREAM:
            cr, cg, cb = cfg.cream_color
            canvas = np.ones((*binary_ink.shape, 3), dtype=np.uint8)
            canvas[:, :, 0] = cr
            canvas[:, :, 1] = cg
            canvas[:, :, 2] = cb
            canvas[ink_mask] = [15, 15, 40]  # Deep navy ink on cream
            return canvas

        else:
            raise ValueError(f"Unknown output mode: {cfg.output_mode}")


# ─── Convenience function ──────────────────────────────────────────────────────

def process_note(
    source: Union[str, Path, bytes, np.ndarray, Image.Image],
    config: Optional[PipelineConfig] = None,
) -> PipelineResult:
    """
    One-liner convenience wrapper.

    Example:
        result = process_note("photo.jpg")
        result.to_pil().save("clean.jpg")
    """
    return NoteImagePipeline(config).process(source)