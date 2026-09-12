from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
source_path = root / "assets" / "thukuna" / "animations" / "idle" / "idle_01.png"
output_directory = root / "assets" / "icons"
output_directory.mkdir(parents=True, exist_ok=True)

source = Image.open(source_path).convert("RGBA")
bounds = source.getbbox()
if bounds is None:
    raise RuntimeError("Canonical THUKUNA icon source is fully transparent")

character = source.crop(bounds)

def compose(size: int, padding_ratio: float = 0.06) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    padding = max(1, round(size * padding_ratio))
    available = size - padding * 2
    scale = min(available / character.width, available / character.height)
    rendered = character.resize(
        (max(1, round(character.width * scale)), max(1, round(character.height * scale))),
        Image.Resampling.LANCZOS,
    )
    x = (size - rendered.width) // 2
    y = (size - rendered.height) // 2
    canvas.alpha_composite(rendered, (x, y))
    return canvas

master = compose(256)
master.save(
    output_directory / "thukuna.ico",
    format="ICO",
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
compose(64, 0.08).save(output_directory / "tray.png", format="PNG", optimize=True)

print(output_directory / "thukuna.ico")
print(output_directory / "tray.png")
