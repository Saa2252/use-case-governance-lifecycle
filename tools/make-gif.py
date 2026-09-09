#!/usr/bin/env python3
"""Assemble the click-through frames into an animated GIF.

    python3 tools/make-gif.py media/frames media/walkthrough.gif

Frames are downscaled to 1000px wide and quantised to a shared palette, which
keeps the file small enough to embed or upload while staying readable.
"""
import sys
import pathlib
from PIL import Image

WIDTH = 1000
# Hold each gate long enough to read the heading, and sit on the failure.
DURATIONS = [2200, 2200, 3800, 3200, 2200, 2600, 2600]
FINAL_HOLD = 4000


def main(src_dir: str, out_path: str) -> None:
    paths = sorted(pathlib.Path(src_dir).glob("frame-*.png"))
    if not paths:
        raise SystemExit(f"no frame-*.png found in {src_dir}")

    frames = []
    for p in paths:
        im = Image.open(p).convert("RGB")
        h = round(im.height * WIDTH / im.width)
        frames.append(im.resize((WIDTH, h), Image.LANCZOS))

    # One shared adaptive palette so colours do not shift between frames.
    palette = frames[0].quantize(colors=192, method=Image.MEDIANCUT)
    frames = [f.quantize(palette=palette, dither=Image.FLOYDSTEINBERG) for f in frames]

    durations = [DURATIONS[i] if i < len(DURATIONS) else 2400 for i in range(len(frames))]
    durations[-1] = FINAL_HOLD

    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=2,
    )
    size_mb = pathlib.Path(out_path).stat().st_size / 1e6
    print(f"  {out_path} — {len(frames)} frames, {size_mb:.1f} MB")
    if size_mb > 8:
        print("  warning: over 8 MB — many upload targets will transcode it. Drop WIDTH or colours.")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
