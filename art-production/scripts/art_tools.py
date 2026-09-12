from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, UnidentifiedImageError


ROOT = Path(__file__).resolve().parents[1]
APPROVED = ROOT / "approved"
MANIFEST_PATH = APPROVED / "manifest.json"
REPORTS = ROOT / "reports"
CONTACT_SHEETS = ROOT / "contact-sheets"
REJECTED = ROOT / "rejected"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def load_manifest() -> dict:
    try:
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except FileNotFoundError:
        fail(f"Missing manifest: {MANIFEST_PATH}")
    except json.JSONDecodeError as exc:
        fail(f"Invalid manifest JSON: {exc}")


def fail(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def selected_families(manifest: dict, family: str | None) -> list[dict]:
    families = manifest.get("families", [])
    if family is None:
        return families
    matches = [item for item in families if item.get("animation") == family]
    if not matches:
        fail(f"Unknown animation family: {family}")
    return matches


def frame_path(frame: str) -> Path:
    candidate = (APPROVED / frame).resolve()
    if APPROVED.resolve() not in candidate.parents:
        fail(f"Manifest path escapes approved/: {frame}")
    return candidate


def image_record(path: Path, family: str) -> dict:
    with path.open("rb") as stream:
        if stream.read(8) != PNG_SIGNATURE:
            raise ValueError("invalid PNG signature")
    with Image.open(path) as source:
        source.verify()
    with Image.open(path) as source:
        image = source.convert("RGBA")
        bands = source.getbands()
        alpha_present = "A" in bands
        alpha = image.getchannel("A")
        bbox = alpha.getbbox()
        if bbox:
            left, top, right, bottom = bbox
            visible_width = right - left
            visible_height = bottom - top
            center_x = (left + right - 1) / 2
            center_y = (top + bottom - 1) / 2
            bottom_point = bottom - 1
            right_point = right - 1
        else:
            left = top = right = bottom = visible_width = visible_height = 0
            center_x = center_y = bottom_point = right_point = None
        return {
            "animation": family,
            "filename": path.name,
            "path": path.relative_to(APPROVED).as_posix(),
            "canvasWidth": image.width,
            "canvasHeight": image.height,
            "alphaPresent": alpha_present,
            "alphaBoundingBox": list(bbox) if bbox else None,
            "visibleWidth": visible_width,
            "visibleHeight": visible_height,
            "visibleCenterX": center_x,
            "visibleCenterY": center_y,
            "bottomVisiblePoint": bottom_point,
            "leftVisiblePoint": left if bbox else None,
            "rightVisiblePoint": right_point,
            "topVisiblePoint": top if bbox else None,
        }


def dhash(path: Path, size: int = 16) -> int:
    with Image.open(path) as source:
        image = source.convert("RGBA")
        background = Image.new("RGBA", image.size, (255, 255, 255, 255))
        composited = Image.alpha_composite(background, image).convert("L")
        reduced = composited.resize((size + 1, size), Image.Resampling.LANCZOS)
        get_pixels = getattr(reduced, "get_flattened_data", reduced.getdata)
        pixels = list(get_pixels())
    value = 0
    for row in range(size):
        offset = row * (size + 1)
        for col in range(size):
            value = (value << 1) | (pixels[offset + col] > pixels[offset + col + 1])
    return value


def duplicate_report(families: list[dict]) -> dict:
    exact: list[dict] = []
    near: list[dict] = []
    for family in families:
        paths = [frame_path(name) for name in family["frames"] if frame_path(name).is_file()]
        hashes: dict[str, Path] = {}
        perceptual: list[tuple[Path, int]] = []
        for path in paths:
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest in hashes:
                exact.append({"animation": family["animation"], "a": hashes[digest].name, "b": path.name})
            else:
                hashes[digest] = path
            perceptual.append((path, dhash(path)))
        for index, (left_path, left_hash) in enumerate(perceptual):
            for right_path, right_hash in perceptual[index + 1 :]:
                distance = (left_hash ^ right_hash).bit_count()
                if distance <= 5 and left_path.read_bytes() != right_path.read_bytes():
                    near.append({
                        "animation": family["animation"],
                        "a": left_path.name,
                        "b": right_path.name,
                        "dHashDistance": distance,
                    })
    return {"exactDuplicates": exact, "suspiciousNearDuplicates": near}


def validate(family: str | None) -> int:
    manifest = load_manifest()
    families = selected_families(manifest, family)
    errors: list[str] = []
    warnings: list[str] = []
    seen_paths: set[str] = set()
    total = 0

    for item in families:
        name = item.get("animation", "")
        folder = APPROVED / "thukuna" / name
        if not folder.is_dir():
            errors.append(f"{name}: missing approved folder {folder}")
        frames = item.get("frames", [])
        minimum = int(item.get("minimumFrameCount", 0))
        if len(frames) < minimum:
            errors.append(f"{name}: manifest has {len(frames)} frames; minimum is {minimum}")
        present = 0
        expected_pattern = re.compile(rf"^(?:{re.escape(name)}|blink)_\d{{2}}\.png$" if name == "idle" else rf"^{re.escape(name)}_\d{{2}}\.png$")
        for relative in frames:
            if relative in seen_paths:
                errors.append(f"duplicate manifest path: {relative}")
            seen_paths.add(relative)
            path = frame_path(relative)
            if REJECTED.resolve() in path.parents:
                errors.append(f"{name}: rejected asset included: {relative}")
            if not expected_pattern.match(path.name):
                errors.append(f"{name}: invalid filename: {path.name}")
            if not path.is_file():
                errors.append(f"{name}: missing file: {relative}")
                continue
            present += 1
            try:
                record = image_record(path, name)
                if record["canvasWidth"] != record["canvasHeight"]:
                    errors.append(f"{name}/{path.name}: canvas is not square")
                if not record["alphaPresent"]:
                    errors.append(f"{name}/{path.name}: PNG has no alpha channel")
                if record["alphaBoundingBox"] is None:
                    errors.append(f"{name}/{path.name}: frame is fully transparent")
            except (OSError, UnidentifiedImageError, ValueError) as exc:
                errors.append(f"{name}/{path.name}: {exc}")
        if present < minimum:
            errors.append(f"{name}: only {present} approved files exist; minimum is {minimum}")
        total += present

    if family is None:
        required = {item["animation"] for item in manifest.get("families", [])}
        expected = {"idle", "crawl", "sprint", "jump", "hop", "fall", "climb", "perch", "sleep", "watch", "laugh", "angry", "rage", "fall_over", "domain"}
        missing_entries = sorted(expected - required)
        if missing_entries:
            errors.append(f"missing manifest families: {', '.join(missing_entries)}")
        if total < int(manifest.get("minimumTotalFrames", 116)):
            errors.append(f"approved total is {total}; minimum is {manifest.get('minimumTotalFrames', 116)}")

    duplicates = duplicate_report(families)
    for item in duplicates["exactDuplicates"]:
        errors.append(f"{item['animation']}: exact duplicate {item['a']} / {item['b']}")
    for item in duplicates["suspiciousNearDuplicates"]:
        warnings.append(f"{item['animation']}: inspect near duplicate {item['a']} / {item['b']} (dHash {item['dHashDistance']})")

    label = family or "complete library"
    print(f"Validated {label}: {total} approved PNG(s)")
    for warning in warnings:
        print(f"WARNING: {warning}")
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(f"FAILED with {len(errors)} error(s).", file=sys.stderr)
        return 1
    print("PASS")
    return 0


def analyze(family: str | None) -> int:
    manifest = load_manifest()
    families = selected_families(manifest, family)
    records: list[dict] = []
    for item in families:
        for relative in item["frames"]:
            path = frame_path(relative)
            if path.is_file():
                records.append(image_record(path, item["animation"]))
    REPORTS.mkdir(parents=True, exist_ok=True)
    json_path = REPORTS / "alpha-bounds.json"
    csv_path = REPORTS / "alpha-bounds.csv"
    json_path.write_text(json.dumps({"frames": records}, indent=2) + "\n", encoding="utf-8")
    fieldnames = list(records[0].keys()) if records else ["animation", "filename", "path"]
    with csv_path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)
    print(f"Wrote {len(records)} alpha-bound record(s) to {json_path} and {csv_path}")
    return 0


def make_contact_sheet(family: str) -> int:
    manifest = load_manifest()
    item = selected_families(manifest, family)[0]
    paths = [frame_path(relative) for relative in item["frames"] if frame_path(relative).is_file()]
    if not paths:
        fail(f"No approved files found for {family}")
    thumb = 256
    label_height = 34
    columns = min(4, len(paths))
    rows = math.ceil(len(paths) / columns)
    sheet = Image.new("RGB", (columns * thumb, rows * (thumb + label_height)), (32, 32, 36))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=16)
    for index, path in enumerate(paths):
        col = index % columns
        row = index // columns
        x = col * thumb
        y = row * (thumb + label_height)
        tile = Image.new("RGBA", (thumb, thumb), (0, 0, 0, 0))
        tile_draw = ImageDraw.Draw(tile)
        step = 16
        for cy in range(0, thumb, step):
            for cx in range(0, thumb, step):
                color = (224, 224, 224, 255) if (cx // step + cy // step) % 2 == 0 else (184, 184, 184, 255)
                tile_draw.rectangle((cx, cy, cx + step - 1, cy + step - 1), fill=color)
        with Image.open(path) as source:
            sprite = source.convert("RGBA")
            sprite.thumbnail((thumb - 12, thumb - 12), Image.Resampling.LANCZOS)
            px = (thumb - sprite.width) // 2
            py = (thumb - sprite.height) // 2
            tile.alpha_composite(sprite, (px, py))
        sheet.paste(tile.convert("RGB"), (x, y))
        draw.text((x + 8, y + thumb + 8), path.name, fill=(245, 245, 245), font=font)
    CONTACT_SHEETS.mkdir(parents=True, exist_ok=True)
    output = CONTACT_SHEETS / f"{family}.png"
    sheet.save(output, "PNG")
    print(f"Wrote {output}")
    return 0


def report_duplicates(family: str | None) -> int:
    manifest = load_manifest()
    report = duplicate_report(selected_families(manifest, family))
    REPORTS.mkdir(parents=True, exist_ok=True)
    output = REPORTS / "duplicates.json"
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    print(f"Wrote {output}")
    return 1 if report["exactDuplicates"] else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="THUKUNA Phase 11.4 art diagnostics")
    subparsers = parser.add_subparsers(dest="command", required=True)
    validate_parser = subparsers.add_parser("validate")
    validate_parser.add_argument("family", nargs="?")
    analyze_parser = subparsers.add_parser("analyze")
    analyze_parser.add_argument("family", nargs="?")
    sheet_parser = subparsers.add_parser("contact-sheet")
    sheet_parser.add_argument("family")
    duplicate_parser = subparsers.add_parser("duplicates")
    duplicate_parser.add_argument("family", nargs="?")
    args = parser.parse_args()
    if args.command == "validate":
        return validate(args.family)
    if args.command == "analyze":
        return analyze(args.family)
    if args.command == "contact-sheet":
        return make_contact_sheet(args.family)
    return report_duplicates(args.family)


if __name__ == "__main__":
    raise SystemExit(main())
