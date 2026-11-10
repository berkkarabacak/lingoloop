import json
import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
ITEMS = json.loads((ROOT / "content" / "seed.json").read_text(encoding="utf-8"))
OUT = ROOT / "server" / "media" / "posters"
OUT.mkdir(parents=True, exist_ok=True)
FONT = ROOT / "content" / "assets" / "NotoSansSC-Regular.ttf"
PALETTES = [("#202B3C", "#5CC8FF"), ("#2D2340", "#B38CFF"), ("#3B2B1E", "#FFB547"), ("#17352F", "#3DDC97")]

for index, item in enumerate(ITEMS):
    background, accent = PALETTES[index % len(PALETTES)]
    image = Image.new("RGB", (720, 1280), background)
    draw = ImageDraw.Draw(image)
    for offset in range(-200, 1400, 120):
        draw.line((0, offset, 720, offset - 300), fill="#2B3442", width=2)
    draw.rounded_rectangle((48, 50, 280, 102), radius=24, fill="#11151C")
    draw.text((70, 66), "LINGOLOOP  /  STUDY CLIP", font=ImageFont.truetype(str(FONT), 20), fill="#F5F6FA")
    size = 72 if len(item["headword"]) < 18 else 54
    font = ImageFont.truetype(str(FONT), size)
    lines = textwrap.wrap(item["headword"], width=18 if size == 72 else 24)
    y = 500 - len(lines) * 42
    for line in lines:
        box = draw.textbbox((0, 0), line, font=font)
        draw.text(((720 - (box[2] - box[0])) / 2, y), line, font=font, fill=accent)
        y += size + 24
    image.save(OUT / f"{item['slug']}.jpg", quality=88)
print(f"Created {len(ITEMS)} posters")
