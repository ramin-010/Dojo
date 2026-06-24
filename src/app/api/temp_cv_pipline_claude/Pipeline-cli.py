#!/usr/bin/env python3
"""
pipeline_cli.py
===============
Command-line interface for the Note Image Pipeline.
Called by the Next.js API route (route.ts) as a subprocess.

Usage:
    python3 pipeline_cli.py INPUT OUTPUT [options]

Arguments:
    INPUT                   Path to input image (any format PIL can read)
    OUTPUT                  Path to write processed image

Options:
    --mode MODE             Output style: binary | grayscale | cream
                            (default: binary)
    --denoise-strength N    NL-Means denoising strength (default: 7.0)
    --format FMT            Output format: jpeg | png | webp (default: jpeg)
    --jpeg-quality Q        JPEG quality 1-100 (default: 95)
    --processing-res N      Internal processing resolution long side (default: 3000)
    --output-res N          Output resolution long side (default: 2400)
    --sauvola-k K           Sauvola k parameter (default: 0.15)
    --verbose               Print detailed timing

Stdout output (for parsing by route.ts):
    processing_time_ms=<float>
    stage_timings=<json>
"""

import argparse
import json
import sys
import logging
from pathlib import Path

# Add parent to path so pipeline.py is importable
sys.path.insert(0, str(Path(__file__).parent))

from pipeline import NoteImagePipeline, PipelineConfig, OutputMode


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Enhance handwritten note images for screen reading",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )

    parser.add_argument("input", help="Input image path")
    parser.add_argument("output", help="Output image path")

    parser.add_argument(
        "--mode",
        choices=["binary", "grayscale", "cream"],
        default="binary",
        help="Output visual style (default: binary)",
    )
    parser.add_argument(
        "--denoise-strength",
        type=float,
        default=7.0,
        metavar="N",
        help="NL-Means denoising strength 5-15 (default: 7.0)",
    )
    parser.add_argument(
        "--format",
        choices=["jpeg", "jpg", "png", "webp"],
        default="jpeg",
        dest="output_format",
        help="Output file format (default: jpeg)",
    )
    parser.add_argument(
        "--jpeg-quality",
        type=int,
        default=95,
        metavar="Q",
        help="JPEG quality 1-100 (default: 95)",
    )
    parser.add_argument(
        "--processing-res",
        type=int,
        default=3000,
        metavar="N",
        help="Internal processing resolution long side (default: 3000)",
    )
    parser.add_argument(
        "--output-res",
        type=int,
        default=2400,
        metavar="N",
        help="Output resolution long side (default: 2400)",
    )
    parser.add_argument(
        "--sauvola-k",
        type=float,
        default=0.15,
        metavar="K",
        help="Sauvola k: lower keeps more faint strokes (default: 0.15)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Print detailed stage timings to stderr",
    )

    return parser.parse_args()


def main() -> int:
    args = parse_args()

    # Configure logging
    log_level = logging.DEBUG if args.verbose else logging.WARNING
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        stream=sys.stderr,
    )

    # Validate input
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"ERROR: Input file not found: {input_path}", file=sys.stderr)
        return 1

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Build config
    mode_map = {
        "binary": OutputMode.BINARY,
        "grayscale": OutputMode.GRAYSCALE,
        "cream": OutputMode.CREAM,
    }

    config = PipelineConfig(
        output_mode=mode_map[args.mode],
        denoise_strength=args.denoise_strength,
        jpeg_quality=args.jpeg_quality,
        processing_resolution=args.processing_res,
        output_resolution=args.output_res,
        sauvola_k=args.sauvola_k,
    )

    # Run pipeline
    pipeline = NoteImagePipeline(config)
    result = pipeline.process(input_path)

    if not result.success:
        print(f"ERROR: {result.error}", file=sys.stderr)
        return 1

    # Save output
    fmt = args.output_format.lower()
    if fmt == "jpg":
        fmt = "jpeg"

    output_bytes = result.to_bytes(fmt=fmt, quality=config.jpeg_quality)
    if output_bytes is None:
        print("ERROR: Failed to encode output image", file=sys.stderr)
        return 1

    output_path.write_bytes(output_bytes)

    # Print machine-readable timing to stdout (parsed by route.ts)
    print(f"processing_time_ms={result.processing_time_ms:.1f}")
    print(f"stage_timings={json.dumps(result.stages)}")

    if args.verbose:
        print("\n=== Stage Timings ===", file=sys.stderr)
        for stage, ms in result.stages.items():
            print(f"  {stage:<25} {ms:>8.1f} ms", file=sys.stderr)
        print(f"  {'TOTAL':<25} {result.processing_time_ms:>8.1f} ms", file=sys.stderr)
        if result.warnings:
            print("\nWarnings:", file=sys.stderr)
            for w in result.warnings:
                print(f"  ⚠ {w}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())