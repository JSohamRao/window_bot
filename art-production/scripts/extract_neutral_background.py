from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

from PIL import Image


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create alpha from an edge-connected neutral preview backdrop without changing RGB or geometry."
    )
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--neutral-tolerance", type=int, default=14)
    parser.add_argument("--minimum-luma", type=int, default=72)
    args = parser.parse_args()

    image = Image.open(args.source).convert("RGBA")
    width, height = image.size
    pixels = image.load()
    background = bytearray(width * height)
    pending: deque[tuple[int, int]] = deque()

    def is_neutral(x: int, y: int) -> bool:
        red, green, blue, _ = pixels[x, y]
        return max(red, green, blue) - min(red, green, blue) <= args.neutral_tolerance and (red + green + blue) // 3 >= args.minimum_luma

    for x in range(width):
        if is_neutral(x, 0):
            pending.append((x, 0))
        if is_neutral(x, height - 1):
            pending.append((x, height - 1))
    for y in range(height):
        if is_neutral(0, y):
            pending.append((0, y))
        if is_neutral(width - 1, y):
            pending.append((width - 1, y))

    while pending:
        x, y = pending.popleft()
        index = y * width + x
        if background[index] or not is_neutral(x, y):
            continue
        background[index] = 1
        if x:
            pending.append((x - 1, y))
        if x + 1 < width:
            pending.append((x + 1, y))
        if y:
            pending.append((x, y - 1))
        if y + 1 < height:
            pending.append((x, y + 1))

    alpha = Image.new("L", (width, height), 255)
    alpha_pixels = alpha.load()
    removed = 0
    for y in range(height):
        for x in range(width):
            if background[y * width + x]:
                alpha_pixels[x, y] = 0
                removed += 1

    image.putalpha(alpha)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    image.save(args.output, "PNG")
    print(f"Removed {removed} edge-connected neutral pixels; RGB and {width}x{height} geometry unchanged.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
