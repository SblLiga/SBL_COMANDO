"""Generate browser tab icons from public/logo.png."""
from pathlib import Path

from PIL import Image

pub = Path(__file__).resolve().parents[1] / "public"
src = Image.open(pub / "logo.png").convert("RGBA")
w, h = src.size
side = min(w, h)
left = (w - side) // 2
top = (h - side) // 2
sq = src.crop((left, top, left + side, top + side))

for name, size in [
    ("favicon-32.png", 32),
    ("favicon-192.png", 192),
    ("apple-touch-icon.png", 180),
]:
    out = sq.resize((size, size), Image.Resampling.LANCZOS)
    out.save(pub / name, optimize=True)
    print(name, (pub / name).stat().st_size)

ico_sizes = [(16, 16), (32, 32), (48, 48)]
imgs = [sq.resize(s, Image.Resampling.LANCZOS) for s in ico_sizes]
imgs[0].save(pub / "favicon.ico", format="ICO", sizes=ico_sizes)
print("favicon.ico", (pub / "favicon.ico").stat().st_size)
