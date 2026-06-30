"""Generate assets/icon.png (512x512) for Electron packaging."""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "icon.png"
SIZE = 512
MARGIN = 64

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Rounded app icon background with blurple gradient approximation
for y in range(SIZE):
    t = y / SIZE
    r = int(88 + (114 - 88) * t)
    g = int(101 + (137 - 101) * t)
    b = int(242 + (218 - 242) * t)
    draw.line([(0, y), (SIZE, y)], fill=(r, g, b, 255))

mask = Image.new("L", (SIZE, SIZE), 0)
mask_draw = ImageDraw.Draw(mask)
radius = 96
mask_draw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=radius, fill=255)
img.putalpha(mask)

draw = ImageDraw.Draw(img)
cx, cy = SIZE // 2, SIZE // 2
arrow_color = (255, 255, 255, 245)

# Two overlapping transform arrows
draw.polygon(
    [
        (cx - 90, cy + 10),
        (cx - 20, cy + 10),
        (cx - 20, cy + 55),
        (cx + 50, cy),
        (cx - 20, cy - 55),
        (cx - 20, cy - 10),
        (cx - 90, cy - 10),
    ],
    fill=arrow_color,
)
draw.polygon(
    [
        (cx + 90, cy - 10),
        (cx + 20, cy - 10),
        (cx + 20, cy - 55),
        (cx - 50, cy),
        (cx + 20, cy + 55),
        (cx + 20, cy + 10),
        (cx + 90, cy + 10),
    ],
    fill=(255, 255, 255, 200),
)

OUT.parent.mkdir(parents=True, exist_ok=True)
img.save(OUT, "PNG")
print(f"Wrote {OUT}")
